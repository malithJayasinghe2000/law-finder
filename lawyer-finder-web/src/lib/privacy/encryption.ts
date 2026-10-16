/**
 * Encryption at rest for privileged matter data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR, IN ONE PARAGRAPH.
 *
 * The client's account of their legal problem is privileged under Evidence
 * Ordinance s.126, and `src/lib/firms/access.ts` already decides who may read
 * it. But that decision only binds code that goes through the application. A
 * database dump, a restored backup, a misconfigured replica, or a platform
 * engineer with a psql prompt all sit underneath it. This file closes that gap:
 * the privileged columns hold ciphertext, and the only way to plaintext is
 * through a function that has already been handed a `MatterAccess` saying the
 * reader may have it.
 *
 * THE THING THIS FILE MUST NEVER DO IS RETURN CIPHERTEXT TO A CALLER.
 *
 * That is the whole trap. An "encryption at rest" feature where the redaction
 * path hands back `enc.v1.k1.…` instead of the plaintext looks like it works,
 * passes a naive privilege check, and has protected nothing — the reader now
 * holds the ciphertext and the key is one environment variable away. So
 * `decryptField` throws rather than degrading, and every disclosure runs through
 * `discloseField` in `firms/access.ts`, which returns plaintext or a withheld
 * marker and has no third branch.
 *
 * Asserted by `npm run check:privilege`. A green `npm run build` proves none of
 * this: it compiles just as happily on a `decryptField` that returns its input.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SHAPE OF A STORED VALUE
 *
 *   enc.v1.<keyId>.<iv>.<authTag>.<ciphertext>      (each part base64url)
 *
 * AES-256-GCM. The key id travels with the value so a key can be rotated
 * without rewriting every row: new writes use the active key, old rows keep
 * decrypting under the key that wrote them.
 *
 * ADDITIONAL AUTHENTICATED DATA
 *
 * Every value is bound to `<model>:<recordId>:<field>`. GCM verifies that
 * binding on decrypt, so ciphertext copied from one row to another — or from
 * `description` into `subject` — fails to decrypt instead of revealing itself.
 * This is not theoretical tidiness: the reader we are defending against in rule
 * 5 is a platform insider, and an insider with write access who could relocate
 * ciphertext into a row they are allowed to read would walk straight around the
 * access rules. That is why record ids are generated in application code before
 * the insert rather than left to the database default.
 *
 * KEY MANAGEMENT, AND THE RISK IT CARRIES
 *
 * Losing the key destroys the data. That is a real operational risk and it is
 * the reason `FeeNote` is deliberately NOT encrypted here — a fee note is a tax
 * document the firm can be compelled to produce, and making a statutory record
 * depend on our key custody is a worse failure than the one we are fixing. See
 * `UNENCRYPTED_TIER1_FIELDS` at the bottom of this file, which states every
 * such gap and why.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits, the GCM standard
const KEY_BYTES = 32; // AES-256
const ENVELOPE_PREFIX = 'enc';
const ENVELOPE_VERSION = 'v1';
const ENVELOPE_PARTS = 6;

/** Shown when a value cannot be decrypted. Never the ciphertext. */
export const UNDECRYPTABLE_MARKER = '[Unavailable - this record could not be decrypted]';

// ─────────────────────────────────────────────────────────────────────────────
// The key ring
// ─────────────────────────────────────────────────────────────────────────────

export type KeyRing = {
  keys: Map<string, Buffer>;
  activeKeyId: string;
};

let cachedRing: KeyRing | null | undefined;

/**
 * Parse `MATTER_ENCRYPTION_KEYS` into a key ring.
 *
 * Format: `k1:<base64 32 bytes>[,k2:<base64 32 bytes>…]`
 * Active key: `MATTER_ENCRYPTION_ACTIVE_KEY`, defaulting to the last listed.
 *
 * Returns null when nothing is configured. Callers decide what that means —
 * reads tolerate it (so a developer can still open a plaintext dev database),
 * writes do not (see `assertEncryptionConfigured`). A silent fallback to
 * plaintext writes is exactly the kind of quiet downgrade this codebase has
 * been bitten by before.
 */
export function loadKeyRing(): KeyRing | null {
  if (cachedRing !== undefined) return cachedRing;

  const raw = process.env.MATTER_ENCRYPTION_KEYS?.trim();
  if (!raw) {
    cachedRing = null;
    return null;
  }

  const keys = new Map<string, Buffer>();

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf(':');
    if (separator < 1) {
      throw new Error(
        `MATTER_ENCRYPTION_KEYS: entry "${trimmed.slice(0, 12)}…" is not in <keyId>:<base64> form.`
      );
    }

    const keyId = trimmed.slice(0, separator);
    const material = Buffer.from(trimmed.slice(separator + 1), 'base64');

    if (material.length !== KEY_BYTES) {
      throw new Error(
        `MATTER_ENCRYPTION_KEYS: key "${keyId}" is ${material.length} bytes; AES-256 needs ${KEY_BYTES}. ` +
          `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
      );
    }

    if (!/^[A-Za-z0-9_-]+$/.test(keyId)) {
      throw new Error(
        `MATTER_ENCRYPTION_KEYS: key id "${keyId}" must be alphanumeric - it is stored in the envelope.`
      );
    }

    keys.set(keyId, material);
  }

  if (keys.size === 0) {
    cachedRing = null;
    return null;
  }

  const requestedActive = process.env.MATTER_ENCRYPTION_ACTIVE_KEY?.trim();
  const activeKeyId = requestedActive || [...keys.keys()][keys.size - 1];

  if (!keys.has(activeKeyId)) {
    throw new Error(
      `MATTER_ENCRYPTION_ACTIVE_KEY is "${activeKeyId}" but no such key is in MATTER_ENCRYPTION_KEYS.`
    );
  }

  cachedRing = { keys, activeKeyId };
  return cachedRing;
}

/** Test seam. Never call this from application code. */
export function __resetKeyRingCache(): void {
  cachedRing = undefined;
}

export function encryptionIsConfigured(): boolean {
  return loadKeyRing() !== null;
}

/**
 * Refuse to write privileged data without a key.
 *
 * Writes fail closed on purpose. The alternative — writing plaintext with a
 * warning — means a misconfigured deploy silently stores privileged material in
 * the clear and nobody notices until the dump leaks.
 */
export function assertEncryptionConfigured(): void {
  if (encryptionIsConfigured()) return;

  throw new Error(
    'MATTER_ENCRYPTION_KEYS is not set, so privileged matter data cannot be stored. ' +
      'This is deliberate: writing it in plaintext instead would be a silent downgrade. ' +
      'Generate a key with:\n' +
      '  node -e "console.log(\'k1:\' + require(\'crypto\').randomBytes(32).toString(\'base64\'))"\n' +
      'and put it in .env as MATTER_ENCRYPTION_KEYS. See docs/restructure/DATA-INVENTORY.md §11.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The envelope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is this stored value one of ours?
 *
 * Anything that is not is treated as legacy plaintext on read. That tolerance is
 * what lets the backfill run incrementally instead of needing a stop-the-world
 * migration — but `scripts/check-privilege-policy.ts` asserts that nothing in a
 * seeded database is still plaintext, so the tolerance cannot go quiet.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split('.');
  return (
    parts.length === ENVELOPE_PARTS &&
    parts[0] === ENVELOPE_PREFIX &&
    parts[1] === ENVELOPE_VERSION
  );
}

export type FieldRef = {
  /** Prisma model name, capitalised as in schema.prisma — e.g. `Booking`. */
  model: string;
  /** The row's primary key. Must be known before the insert. */
  recordId: string;
  /** The column name — e.g. `description`. */
  field: string;
};

/**
 * The additional authenticated data binding a value to its row and column.
 *
 * Changing this format invalidates every existing value, so it is a migration,
 * not an edit.
 */
function aadFor(ref: FieldRef): Buffer {
  return Buffer.from(`${ref.model}:${ref.recordId}:${ref.field}`, 'utf8');
}

const b64u = (b: Buffer) => b.toString('base64url');
const unb64u = (s: string) => Buffer.from(s, 'base64url');

/**
 * Encrypt one privileged field.
 *
 * Returns the stored form. Null and empty input pass through untouched — an
 * absent note is not a secret, and encrypting empty strings would make "is this
 * set?" queries impossible for no benefit.
 */
export function encryptField(ref: FieldRef, plaintext: string): string;
export function encryptField(ref: FieldRef, plaintext: string | null | undefined): string | null;
export function encryptField(
  ref: FieldRef,
  plaintext: string | null | undefined
): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return plaintext === undefined ? null : (plaintext as string | null);
  }

  assertEncryptionConfigured();
  const ring = loadKeyRing()!;
  const key = ring.keys.get(ring.activeKeyId)!;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aadFor(ref));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    ENVELOPE_VERSION,
    ring.activeKeyId,
    b64u(iv),
    b64u(authTag),
    b64u(ciphertext),
  ].join('.');
}

/** Encrypt every element of a string array field (e.g. `screenedParties`). */
export function encryptFieldList(ref: FieldRef, values: string[]): string[] {
  return values.map((v, i) =>
    encryptField({ ...ref, field: `${ref.field}[${i}]` }, v) ?? ''
  );
}

/**
 * Decrypt one privileged field.
 *
 * THROWS on any failure. It does not return the ciphertext, it does not return
 * a placeholder, and it does not return the input. Every caller goes through
 * `discloseField` in `firms/access.ts`, which turns a throw into a withheld
 * marker — so the "I could not decrypt this" path and the "you may not read
 * this" path produce text, never a secret in a form the reader could take away
 * and attack offline.
 *
 * Legacy plaintext (written before this module existed) is returned as-is. That
 * is checked for explicitly rather than falling out of an error path.
 */
export function decryptField(ref: FieldRef, stored: string): string {
  if (!isEncrypted(stored)) return stored; // legacy plaintext

  const ring = loadKeyRing();
  if (!ring) {
    throw new Error(
      `Cannot decrypt ${ref.model}.${ref.field}: MATTER_ENCRYPTION_KEYS is not set.`
    );
  }

  const [, , keyId, ivPart, tagPart, ctPart] = stored.split('.');
  const key = ring.keys.get(keyId);

  if (!key) {
    throw new Error(
      `Cannot decrypt ${ref.model}.${ref.field}: it was written with key "${keyId}", ` +
        `which is not in the key ring. Retired keys must stay in MATTER_ENCRYPTION_KEYS ` +
        `until every row written under them has been re-encrypted.`
    );
  }

  const decipher = createDecipheriv(ALGORITHM, key, unb64u(ivPart));
  decipher.setAAD(aadFor(ref));
  decipher.setAuthTag(unb64u(tagPart));

  // Throws on tag mismatch — which is exactly what happens when ciphertext has
  // been moved to another row or column.
  return Buffer.concat([
    decipher.update(unb64u(ctPart)),
    decipher.final(),
  ]).toString('utf8');
}

/** Decrypt every element of a string array field. */
export function decryptFieldList(ref: FieldRef, stored: string[]): string[] {
  return stored.map((v, i) => decryptField({ ...ref, field: `${ref.field}[${i}]` }, v));
}

/**
 * Constant-time equality, used by the checks rather than by request handling.
 *
 * Exported so `check:privilege` can compare a disclosure against the stored
 * ciphertext without the comparison itself becoming a timing oracle in a test
 * that later gets copied into a route.
 */
export function valuesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

// ─────────────────────────────────────────────────────────────────────────────
// What is encrypted, and what is not
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The columns this module covers. Kept as data so the checks and the backfill
 * script agree with each other instead of each carrying their own list.
 *
 * `idField` is the column holding the record id used in the AAD. It is the
 * primary key everywhere except `ConflictCheck`, which is keyed 1:1 on
 * `bookingId` — that is stable and known before the upsert, so it does not need
 * an id generated for it.
 */
export const ENCRYPTED_FIELDS: {
  model: string;
  prismaModel: string;
  idField: string;
  scalar: string[];
  list: string[];
}[] = [
  {
    model: 'Booking',
    prismaModel: 'booking',
    idField: 'id',
    scalar: ['subject', 'description', 'lawyerNotes'],
    list: [],
  },
  {
    model: 'ConflictCheck',
    prismaModel: 'conflictCheck',
    idField: 'bookingId',
    scalar: ['notes'],
    list: ['screenedParties'],
  },
  {
    model: 'Quote',
    prismaModel: 'quote',
    idField: 'id',
    scalar: ['scopeOfWork', 'exclusions', 'declineReason'],
    list: [],
  },
  {
    // `matterSubject`, `scopeOfWork` and `exclusions` are copies of encrypted
    // values on `Booking` and `Quote`. Leaving the copies in the clear would
    // have made encrypting the originals pointless for every matter that ever
    // reached acceptance — the leak would have been a plaintext column three
    // tables away from the one anybody was looking at.
    model: 'EngagementLetter',
    prismaModel: 'engagementLetter',
    idField: 'id',
    scalar: ['body', 'matterSubject', 'scopeOfWork', 'exclusions'],
    list: [],
  },
  {
    model: 'Message',
    prismaModel: 'message',
    idField: 'id',
    scalar: ['content'],
    list: [],
  },
  {
    // A request a practice opened for a client, waiting for the client to
    // confirm it. Wiped once the invitation is no longer pending.
    model: 'ClientIntakeInvitation',
    prismaModel: 'clientIntakeInvitation',
    idField: 'id',
    scalar: ['subject', 'description'],
    list: [],
  },
];

/**
 * Tier 1 material that is deliberately NOT encrypted, and why.
 *
 * Written down because an inventory that lists only what we did protect is not
 * an inventory. Each of these is a decision someone can disagree with, which is
 * the point — see DATA-INVENTORY.md §11.
 */
export const UNENCRYPTED_TIER1_FIELDS: { field: string; reason: string }[] = [
  {
    field: 'FeeNote.content, FeeNote.lineItems',
    reason:
      'A fee note is a tax document the firm can be compelled to produce, with a ' +
      'statutory retention period measured in years. Making it undecryptable if we ' +
      'mislay a key trades a confidentiality risk for a compliance failure the firm ' +
      'cannot argue its way out of. Encrypt these once key escrow is designed - ' +
      'counsel question 4(c) and the key-custody note in DATA-INVENTORY.md §11.',
  },
  {
    field: 'FeeNote.clientName, FeeNote.clientAddress, FeeNote.clientEmail',
    reason:
      'Identity (tier 3), not the client’s account of their problem, and they are ' +
      'printed on the face of a document the client already holds.',
  },
  {
    field: 'FeeNote.lineItems narration',
    reason:
      'The narration is typed by the firm when it raises the note, not copied from ' +
      'anything the client wrote - so unlike the engagement letter it is not a ' +
      'plaintext copy of an encrypted column. It is still tier 1 and still access-' +
      'gated; it shares the tax-document reason above.',
  },
  {
    field: 'Booking.cancelReason, Booking.assignmentNote',
    reason:
      'Short operational strings written by the firm about its own scheduling, not the ' +
      'client’s account of their legal problem. Still access-gated by firms/access.ts.',
  },
];
