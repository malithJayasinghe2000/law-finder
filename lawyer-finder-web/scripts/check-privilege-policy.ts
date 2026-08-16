/**
 * Privilege policy check.
 *
 * Run with: npm run check:privilege
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this exists as a runnable script rather than a comment.
 *
 * `npm run build` and `npx tsc --noEmit` both pass happily on a version of
 * src/lib/firms/access.ts that lets a paralegal read a client's account of their
 * legal problem. A green build proves the code compiles, not that it protects
 * anything. This is the one rule in the codebase where being wrong exposes real
 * attorneys — and their clients — so it gets an assertion rather than a promise.
 *
 * Run it after ANY change to src/lib/firms/access.ts. If a case here starts
 * failing, that is either a bug or a legal decision; it is never a test to
 * "just update".
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 5) and counsel question 8(b).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  resolveMatterAccess,
  discloseMatter,
  discloseField,
  discloseFieldList,
  discloseMessage,
  resolveConversationAccess,
  WITHHELD_MARKER,
  type FirmMembership,
  type MatterAccess,
} from '../src/lib/firms/access';
import {
  encryptField,
  decryptField,
  isEncrypted,
  encryptionIsConfigured,
  UNDECRYPTABLE_MARKER,
  ENCRYPTED_FIELDS,
} from '../src/lib/privacy/encryption';
import type { FirmRole } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const MATTER_ID = 'booking-1';

const MATTER = {
  lawyerId: 'profile-A',
  firmId: 'firm-1',
  clientId: 'client-1',
};

const membership = (
  role: FirmRole,
  firmId = 'firm-1',
  profileId: string | null = null
): FirmMembership => ({
  firmId,
  firmName: 'Test & Co, Attorneys-at-Law',
  role,
  profileId,
  isSoloPractice: false,
});

type Case = {
  who: string;
  actor: Parameters<typeof resolveMatterAccess>[0];
  expect: { read: boolean; detail: boolean; act: boolean; assign: boolean };
  /** Why the expectation is what it is. */
  because: string;
};

const CASES: Case[] = [
  {
    who: 'The client whose matter it is',
    actor: { actorUserId: 'client-1', actorRole: 'CLIENT', membership: null, matter: MATTER },
    expect: { read: true, detail: true, act: false, assign: false },
    because: 'They wrote it. They cannot act on the engagement — that is the firm\'s side.',
  },
  {
    who: 'Platform ADMIN',
    actor: { actorUserId: 'staff-1', actorRole: 'ADMIN', membership: null, matter: MATTER },
    expect: { read: true, detail: false, act: false, assign: false },
    because:
      'Evidence Ordinance s.126 — a third party who can read privileged material can be used to argue privilege was waived. Support can see a matter exists, never what it says.',
  },
  {
    who: 'The attorney the matter is assigned to',
    actor: {
      actorUserId: 'u-A', actorRole: 'LAWYER', actorProfileId: 'profile-A',
      membership: membership('ATTORNEY', 'firm-1', 'profile-A'), matter: MATTER,
    },
    expect: { read: true, detail: true, act: true, assign: false },
    because: 'They are doing the work. They do not reassign — that is the principal\'s call.',
  },
  {
    who: 'The firm\'s principal, matter assigned to someone else',
    actor: {
      actorUserId: 'u-O', actorRole: 'LAWYER', actorProfileId: 'profile-O',
      membership: membership('FIRM_OWNER'), matter: MATTER,
    },
    expect: { read: true, detail: true, act: false, assign: true },
    because:
      'Someone must be able to move a matter when an attorney is ill, leaves, or hits a conflict — but quoting and conflict-checking belong to whoever will do the work.',
  },
  {
    // NOTE THE PLATFORM ROLE. A practice manager need not be an admitted
    // attorney, so their platform `Role` is CLIENT. This case said 'LAWYER'
    // until Phase 7, which described a person who cannot exist — and hid a real
    // bug: the rule refused every non-attorney firm member outright, so a
    // FIRM_ADMIN got 403 on the diary they are employed to run.
    who: 'Practice manager (FIRM_ADMIN, not an attorney — platform role CLIENT)',
    actor: {
      actorUserId: 'u-M', actorRole: 'CLIENT', actorProfileId: null,
      membership: membership('FIRM_ADMIN'), matter: MATTER,
    },
    expect: { read: true, detail: true, act: false, assign: true },
    because:
      'Runs the diary and the queue, so needs the matter. Authority inside a firm comes from MEMBERSHIP, not from the platform role — gating on the platform role locks out every non-attorney member. Whether a non-attorney may see matter detail at all is counsel question 8(b); if the answer is no, THIS is the case that must change.',
  },
  {
    who: 'A different attorney at the same firm',
    actor: {
      actorUserId: 'u-B', actorRole: 'LAWYER', actorProfileId: 'profile-B',
      membership: membership('ATTORNEY', 'firm-1', 'profile-B'), matter: MATTER,
    },
    expect: { read: true, detail: false, act: false, assign: false },
    because:
      'Being in the same firm is not a reason to read a colleague\'s client\'s problem. Access is need-based and minimal.',
  },
  {
    who: 'A paralegal at the same firm (platform role CLIENT)',
    actor: {
      actorUserId: 'u-P', actorRole: 'CLIENT', actorProfileId: null,
      membership: membership('PARALEGAL'), matter: MATTER,
    },
    expect: { read: true, detail: false, act: false, assign: false },
    because: 'Can see that an appointment exists. Never what it concerns. Their platform role is CLIENT, because a paralegal is not an admitted attorney.',
  },
  {
    who: 'A CLIENT-role user with NO firm membership',
    actor: {
      actorUserId: 'u-stranger', actorRole: 'CLIENT', actorProfileId: null,
      membership: null, matter: MATTER,
    },
    expect: { read: false, detail: false, act: false, assign: false },
    because:
      'The other half of the membership rule. Loosening the platform-role guard must not let an ordinary signed-in client reach a firm\'s matters — membership is what separates a member from a stranger.',
  },
  {
    who: 'A paralegal at a DIFFERENT firm (platform role CLIENT)',
    actor: {
      actorUserId: 'u-P2', actorRole: 'CLIENT', actorProfileId: null,
      membership: membership('PARALEGAL', 'firm-2'), matter: MATTER,
    },
    expect: { read: false, detail: false, act: false, assign: false },
    because: 'A matter never crosses firms, for non-attorney staff either.',
  },
  {
    who: 'An attorney at a DIFFERENT firm',
    actor: {
      actorUserId: 'u-X', actorRole: 'LAWYER', actorProfileId: 'profile-X',
      membership: membership('FIRM_OWNER', 'firm-2', 'profile-X'), matter: MATTER,
    },
    expect: { read: false, detail: false, act: false, assign: false },
    because: 'A matter never crosses firms. Nothing about it leaks to another practice.',
  },
  {
    who: 'A lawyer belonging to no firm',
    actor: {
      actorUserId: 'u-Z', actorRole: 'LAWYER', actorProfileId: 'profile-Z',
      membership: null, matter: MATTER,
    },
    expect: { read: false, detail: false, act: false, assign: false },
    because: 'No membership, no route in.',
  },
];

let passed = 0;
const failures: string[] = [];

console.log('\nPrivilege policy — who may read a client\'s legal problem\n');

for (const c of CASES) {
  const a = resolveMatterAccess(c.actor);
  const ok =
    a.canRead === c.expect.read &&
    a.canReadMatterDetail === c.expect.detail &&
    a.canAct === c.expect.act &&
    a.canAssign === c.expect.assign;

  if (ok) {
    passed++;
    console.log(`  PASS  ${c.who}`);
  } else {
    failures.push(
      `  FAIL  ${c.who}\n` +
        `        expected read=${c.expect.read} detail=${c.expect.detail} act=${c.expect.act} assign=${c.expect.assign}\n` +
        `        actual   read=${a.canRead} detail=${a.canReadMatterDetail} act=${a.canAct} assign=${a.canAssign}\n` +
        `        why it matters: ${c.because}`
    );
    console.log(`  FAIL  ${c.who}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message threads (DATA-INVENTORY.md §7 finding B)
// ─────────────────────────────────────────────────────────────────────────────
//
// Until Phase 7 there was no rule here to assert. `Conversation`/`Message` held
// client↔attorney communication and access was "do you have a participant row".
// These cases exist so the three holes that produced cannot come back quietly.

console.log('\nMessage threads — who may read privileged chat\n');

const THREAD = {
  firmId: 'firm-1',
  clientId: 'client-1',
  participantUserIds: ['client-1', 'u-A'],
};

type ThreadCase = {
  who: string;
  actor: Parameters<typeof resolveConversationAccess>[0];
  expect: { read: boolean; write: boolean };
  because: string;
};

const THREAD_CASES: ThreadCase[] = [
  {
    who: 'The client in the thread',
    actor: {
      actorUserId: 'client-1',
      actorRole: 'CLIENT',
      membership: null,
      conversation: THREAD,
    },
    expect: { read: true, write: true },
    because:
      'It is their conversation as much as the firm\'s. They must not lose their record of what their attorney told them because the attorney changed practice.',
  },
  {
    who: 'The attorney in the thread, still at the firm',
    actor: {
      actorUserId: 'u-A',
      actorRole: 'LAWYER',
      membership: membership('ATTORNEY', 'firm-1', 'profile-A'),
      conversation: THREAD,
    },
    expect: { read: true, write: true },
    because: 'The ordinary case: they are acting for the firm the client is talking to.',
  },
  {
    who: 'The same attorney AFTER LEAVING the firm',
    actor: {
      actorUserId: 'u-A',
      actorRole: 'LAWYER',
      membership: membership('ATTORNEY', 'firm-2', 'profile-A'),
      conversation: THREAD,
    },
    expect: { read: false, write: false },
    because:
      'THE HOLE THIS RULE EXISTS TO CLOSE. A participant row has no end date, so before Phase 7 leaving a practice removed access to the matter file and left the conversation about it wide open — including from inside a competing firm.',
  },
  {
    who: 'An attorney who left and now belongs to no firm',
    actor: {
      actorUserId: 'u-A',
      actorRole: 'LAWYER',
      membership: null,
      conversation: THREAD,
    },
    expect: { read: false, write: false },
    because: 'No membership is not a licence to keep reading. It is the absence of a basis.',
  },
  {
    who: 'Platform ADMIN — even if somehow made a participant',
    actor: {
      actorUserId: 'staff-1',
      actorRole: 'ADMIN',
      membership: null,
      conversation: {
        ...THREAD,
        participantUserIds: ['client-1', 'u-A', 'staff-1'],
      },
    },
    expect: { read: false, write: false },
    because:
      'Checked before participation, not after, so a future feature that puts a support user in a thread cannot hand them everything said before they arrived. Evidence Ordinance s.126.',
  },
  {
    who: 'The firm\'s principal, not in the thread',
    actor: {
      actorUserId: 'u-O',
      actorRole: 'LAWYER',
      membership: membership('FIRM_OWNER', 'firm-1', 'profile-O'),
      conversation: THREAD,
    },
    expect: { read: false, write: false },
    because:
      'DELIBERATELY NARROWER THAN THE MATTER RULE. A principal needs the matter file to triage and reassign; they do not need to read a conversation that already happened. Every extra reader is another person an opponent can name to argue privilege was waived.',
  },
  {
    who: 'A paralegal at the same firm, not in the thread',
    actor: {
      actorUserId: 'u-P',
      actorRole: 'LAWYER',
      membership: membership('PARALEGAL', 'firm-1'),
      conversation: THREAD,
    },
    expect: { read: false, write: false },
    because: 'Same firm is not a reason. Access is need-based and minimal.',
  },
  {
    who: 'A stranger with no participant row',
    actor: {
      actorUserId: 'u-X',
      actorRole: 'CLIENT',
      membership: null,
      conversation: THREAD,
    },
    expect: { read: false, write: false },
    because: 'Baseline. If this ever passes, the participant check has been dropped entirely.',
  },
  {
    who: 'A pre-Phase-7 thread with no firm recorded',
    actor: {
      actorUserId: 'u-A',
      actorRole: 'LAWYER',
      membership: null,
      conversation: { ...THREAD, firmId: null },
    },
    expect: { read: true, write: true },
    because:
      'Grandfathered so the migration cannot lock people out of their own history. It can never be WIDENED, because there is no firm to widen it to.',
  },
];

for (const c of THREAD_CASES) {
  const a = resolveConversationAccess(c.actor);
  const ok = a.canRead === c.expect.read && a.canWrite === c.expect.write;

  if (ok) {
    passed++;
    console.log(`  PASS  ${c.who}`);
  } else {
    failures.push(
      `  FAIL  ${c.who}\n` +
        `        expected read=${c.expect.read} write=${c.expect.write}\n` +
        `        actual   read=${a.canRead} write=${a.canWrite} (basis=${a.basis})\n` +
        `        why it matters: ${c.because}`
    );
    console.log(`  FAIL  ${c.who}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Encryption at rest
// ─────────────────────────────────────────────────────────────────────────────
//
// THE POINT OF THIS SECTION.
//
// Encrypting the privileged columns makes the previous section easy to pass for
// the wrong reason. If `discloseMatter` handed a withheld reader the stored
// ciphertext, every case above would still be green: `canReadMatterDetail` is
// false, the value returned is not the plaintext, and a check that only asked
// "did the plaintext leak?" would be satisfied. The reader would be holding an
// encrypted copy of a client's legal problem and one environment variable away
// from reading it.
//
// So these assertions are written to fail against exactly that implementation:
// they compare the disclosed value against the CIPHERTEXT as well as against
// the plaintext, and they prove real AEAD is in play rather than a passthrough
// that returns its input.
//
// If this whole section is skipped because no key is configured, the script
// says so loudly and exits non-zero. A check that quietly downgrades to
// "nothing to test" is how a security control disappears.

const PLAINTEXT = 'My neighbour has built a wall across the access road to my land.';
const ADMIN_ACCESS = resolveMatterAccess({
  actorUserId: 'staff-1',
  actorRole: 'ADMIN',
  membership: null,
  matter: MATTER,
});
const CLIENT_ACCESS = resolveMatterAccess({
  actorUserId: 'client-1',
  actorRole: 'CLIENT',
  membership: null,
  matter: MATTER,
});

function assert(label: string, condition: boolean, why: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(`  FAIL  ${label}\n        why it matters: ${why}`);
    console.log(`  FAIL  ${label}`);
  }
}

console.log('\nEncryption at rest — the disclosure gate\n');

if (!encryptionIsConfigured()) {
  console.error(
    '\n  MATTER_ENCRYPTION_KEYS is not set, so none of the encryption assertions\n' +
      '  can run. That is a failure, not a skip: the privilege cases above pass\n' +
      '  trivially against ciphertext, and this is the section that proves they\n' +
      '  do not. Generate a key:\n\n' +
      '    node -e "console.log(\'k1:\' + require(\'crypto\').randomBytes(32).toString(\'base64\'))"\n'
  );
  process.exit(1);
}

const ref = { model: 'Booking', recordId: MATTER_ID, field: 'description' };
const CIPHERTEXT = encryptField(ref, PLAINTEXT);

// 1. Encryption actually happened. A no-op `encryptField` that returned its
//    input would sail through every other assertion here.
assert(
  'encryptField produces an envelope, not the input',
  isEncrypted(CIPHERTEXT) && CIPHERTEXT !== PLAINTEXT,
  'A passthrough encrypt is the cheapest way to make this entire feature theatre.'
);

assert(
  'the ciphertext does not contain the plaintext',
  !CIPHERTEXT.includes(PLAINTEXT) && !CIPHERTEXT.includes('neighbour'),
  'If the plaintext survives inside the stored value, a database dump still reads it.'
);

// 2. Round trip. Without this, "nothing leaks" is satisfiable by storing junk.
assert(
  'a permitted reader gets the original words back',
  discloseField({ ...ref, access: CLIENT_ACCESS, stored: CIPHERTEXT }) === PLAINTEXT,
  'Encryption that cannot be reversed for the client is data loss, not confidentiality.'
);

// 3. THE ASSERTION THIS SECTION EXISTS FOR.
const withheld = discloseField({ ...ref, access: ADMIN_ACCESS, stored: CIPHERTEXT });

assert(
  'a withheld reader gets neither the plaintext NOR the ciphertext',
  withheld !== PLAINTEXT && withheld !== CIPHERTEXT && withheld === WITHHELD_MARKER,
  'Returning the stored ciphertext to platform staff passes a naive privilege check ' +
    'while handing them an offline-attackable copy of a client\'s legal problem. This ' +
    'is the exact failure mode the encryption work was at risk of shipping.'
);

assert(
  'the withheld value is not an empty string',
  withheld !== '' && withheld !== null,
  'A blank field reads as "the client wrote nothing", which is a different and ' +
    'misleading claim from "you may not read this".'
);

// 4. The same, through the whole-object path that routes actually call.
const disclosedForAdmin = discloseMatter(
  {
    id: MATTER_ID,
    subject: encryptField({ ...ref, field: 'subject' }, 'Land dispute'),
    description: CIPHERTEXT,
    lawyerNotes: encryptField({ ...ref, field: 'lawyerNotes' }, 'internal'),
  },
  ADMIN_ACCESS
);

assert(
  'discloseMatter withholds subject, description and notes from ADMIN',
  disclosedForAdmin.subject === WITHHELD_MARKER &&
    disclosedForAdmin.description === WITHHELD_MARKER &&
    disclosedForAdmin.lawyerNotes === null &&
    !isEncrypted(disclosedForAdmin.subject!) &&
    !isEncrypted(disclosedForAdmin.description!),
  'The object path is what routes call. Testing only the field helper would leave ' +
    'the real call site unproven.'
);

const disclosedForClient = discloseMatter(
  {
    id: MATTER_ID,
    subject: encryptField({ ...ref, field: 'subject' }, 'Land dispute'),
    description: CIPHERTEXT,
    lawyerNotes: null,
  },
  CLIENT_ACCESS
);

assert(
  'discloseMatter returns readable text to the client',
  disclosedForClient.subject === 'Land dispute' &&
    disclosedForClient.description === PLAINTEXT,
  'The client wrote it. Showing them base64 is a bug that a privilege check ' +
    'looking only for leaks would never notice.'
);

// 5. AEAD binding. This is what proves the ciphertext is tied to its row and
//    column rather than being a free-floating blob an insider could relocate
//    into a record they are allowed to read.
let movedRowRejected = false;
try {
  decryptField({ ...ref, recordId: 'a-different-booking' }, CIPHERTEXT);
} catch {
  movedRowRejected = true;
}
assert(
  'ciphertext moved to another row will not decrypt',
  movedRowRejected,
  'Without row binding, an insider with write access copies the ciphertext into ' +
    'their own matter and reads it through the application, entirely legitimately.'
);

let movedFieldRejected = false;
try {
  decryptField({ ...ref, field: 'subject' }, CIPHERTEXT);
} catch {
  movedFieldRejected = true;
}
assert(
  'ciphertext moved to another column will not decrypt',
  movedFieldRejected,
  'Column binding stops a long description being read out of a field that a ' +
    'different rule exposes.'
);

let tamperRejected = false;
try {
  const parts = CIPHERTEXT.split('.');
  parts[5] = Buffer.from('tampered payload here').toString('base64url');
  decryptField(ref, parts.join('.'));
} catch {
  tamperRejected = true;
}
assert(
  'tampered ciphertext is rejected rather than decrypted to garbage',
  tamperRejected,
  'GCM authentication is the difference between "confidential" and "confidential ' +
    'and unmodified". A matter description an insider could silently rewrite is evidence ' +
    'nobody can rely on.'
);

// 6. Failure is closed. A reader who MAY read, faced with something that will
//    not decrypt, must get a marker — never the stored value.
const undecryptable = discloseField({
  ...ref,
  recordId: 'a-different-booking',
  access: CLIENT_ACCESS,
  stored: CIPHERTEXT,
});
assert(
  'an undecryptable value fails closed, not open',
  undecryptable === UNDECRYPTABLE_MARKER && undecryptable !== CIPHERTEXT,
  'The tempting fallback — "if it will not decrypt, return what is stored" — hands ' +
    'the ciphertext to whoever asked, which is the same leak wearing an error message.'
);

// 7. Two encryptions of the same words differ, so nobody can tell from the
//    database that two clients described the same problem.
assert(
  'the same plaintext encrypts to different ciphertext each time',
  encryptField(ref, PLAINTEXT) !== encryptField(ref, PLAINTEXT),
  'A deterministic scheme lets anyone with the table group clients by what they ' +
    'wrote, without decrypting a single row.'
);

// 8. Lists (ConflictCheck.screenedParties) — the sharpest data in the schema,
//    because it names OTHER firms' clients.
const PARTIES = ['Silva Holdings (Pvt) Ltd', 'W. A. Perera'];
const encryptedParties = PARTIES.map((p, i) =>
  encryptField({ model: 'ConflictCheck', recordId: MATTER_ID, field: `screenedParties[${i}]` }, p)
);
const partiesRef = {
  model: 'ConflictCheck',
  recordId: MATTER_ID,
  field: 'screenedParties',
  stored: encryptedParties,
};

assert(
  'screened parties round-trip for the acting attorney',
  JSON.stringify(
    discloseFieldList({
      ...partiesRef,
      access: resolveMatterAccess({
        actorUserId: 'u-A',
        actorRole: 'LAWYER',
        actorProfileId: 'profile-A',
        membership: membership('ATTORNEY', 'firm-1', 'profile-A'),
        matter: MATTER,
      }),
    })
  ) === JSON.stringify(PARTIES),
  'The firm needs its own screening record back in readable form to run future checks.'
);

const withheldParties = discloseFieldList({ ...partiesRef, access: ADMIN_ACCESS });
assert(
  'screened parties are withheld from ADMIN as markers, not ciphertext',
  withheldParties.every((p) => p === WITHHELD_MARKER) &&
    withheldParties.every((p) => !isEncrypted(p)) &&
    !withheldParties.some((p) => PARTIES.includes(p)),
  'These are OTHER clients\' names. A subject-access request or a support screen that ' +
    'released them would breach several people\'s confidentiality at once.'
);

// 9. Message content, through the conversation gate.
const MESSAGE_ID = 'message-1';
const MESSAGE_TEXT = 'The other side has agreed to the settlement figure we discussed.';
const encryptedMessage = {
  id: MESSAGE_ID,
  content: encryptField(
    { model: 'Message', recordId: MESSAGE_ID, field: 'content' },
    MESSAGE_TEXT
  ),
};

const clientThreadAccess = resolveConversationAccess({
  actorUserId: 'client-1',
  actorRole: 'CLIENT',
  membership: null,
  conversation: THREAD,
});
const departedAttorneyAccess = resolveConversationAccess({
  actorUserId: 'u-A',
  actorRole: 'LAWYER',
  membership: membership('ATTORNEY', 'firm-2', 'profile-A'),
  conversation: THREAD,
});

assert(
  'a message round-trips for someone in the thread',
  discloseMessage(encryptedMessage, clientThreadAccess).content === MESSAGE_TEXT,
  'The participants must be able to read their own conversation.'
);

const withheldMessage = discloseMessage(encryptedMessage, departedAttorneyAccess).content;
assert(
  'a departed attorney gets neither the message NOR its ciphertext',
  withheldMessage !== MESSAGE_TEXT &&
    withheldMessage !== encryptedMessage.content &&
    withheldMessage === WITHHELD_MARKER,
  'Losing access must mean losing the words, not receiving an encrypted copy they ' +
    'could keep and attack later from inside a competing firm.'
);

// 10. Every column named in ENCRYPTED_FIELDS really is a column, and really is a
//    column this codebase writes through `encryptField`. Catches the drift where
//    a field is added to the list and nowhere else — the list would then be a
//    promise instead of a description.
const schemaText = readFileSync(
  join(__dirname, '..', 'prisma', 'schema.prisma'),
  'utf8'
);

for (const spec of ENCRYPTED_FIELDS) {
  const modelBlock = schemaText.split(`model ${spec.model} {`)[1]?.split('\n}')[0] ?? '';
  const missing = [...spec.scalar, ...spec.list].filter(
    (f) => !new RegExp(`^\\s*${f}\\s`, 'm').test(modelBlock)
  );

  assert(
    `ENCRYPTED_FIELDS: every listed column exists on ${spec.model}`,
    modelBlock.length > 0 && missing.length === 0,
    `${missing.join(', ') || 'the model'} is named in ENCRYPTED_FIELDS but not in ` +
      `schema.prisma, so the backfill would silently skip it and the column would ` +
      `stay in plaintext while the list claimed otherwise.`
  );
}

if (failures.length) {
  console.error('\n' + failures.join('\n\n'));
  console.error(`\n${passed} passed, ${failures.length} FAILED\n`);
  process.exit(1);
}

console.log(`\n${passed} passed, 0 failed\n`);
