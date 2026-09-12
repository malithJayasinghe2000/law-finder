# Encryption Key Custody

How `MATTER_ENCRYPTION_KEYS` is held, backed up and rotated — and what happens
if it is lost.

> Written 2026-09-06, Phase 8. The rotation *code* has existed since Phase 7;
> this is the operational half, which did not.

---

## The risk, stated plainly

Since Phase 7, these columns are encrypted at rest with AES-256-GCM:

| Model | Columns |
| --- | --- |
| `Booking` | `subject`, `description`, `lawyerNotes` |
| `ConflictCheck` | `notes`, `screenedParties[]` |
| `Quote` | `scopeOfWork`, `exclusions`, `declineReason` |
| `EngagementLetter` | `body`, `matterSubject`, `scopeOfWork`, `exclusions` |
| `Message` | `content` |

**Losing the key destroys every one of those values in every row.** Not
"degrades", not "requires a support ticket" — the plaintext is unrecoverable and
there is no second copy anywhere. `decryptField` throws rather than degrading to
its input, on purpose, so the failure is loud and total rather than quiet and
partial.

That risk was created deliberately, in exchange for a database dump being worth
nothing to whoever takes it. It is only an acceptable trade if the key is
actually looked after, which is what this document is for.

**The data at stake is not ours.** It is the firm's matter file, which the firm
may be professionally required to produce. Losing our key destroys a record an
attorney can be compelled to produce and cannot reconstruct. That is a worse
outcome for the firm than for us, and it is why `FeeNote` — a tax document with
a statutory retention period — is deliberately *not* encrypted.

---

## Format

```
MATTER_ENCRYPTION_KEYS="k1:<base64 32 bytes>,k2:<base64 32 bytes>"
MATTER_ENCRYPTION_ACTIVE_KEY="k2"
```

- Each entry is `<keyId>:<base64-encoded 32 bytes>`. A key id is alphanumeric
  (plus `_` and `-`) because **it is stored in the envelope of every value**:
  `enc.v1.<keyId>.<iv>.<tag>.<ciphertext>`.
- `MATTER_ENCRYPTION_ACTIVE_KEY` is the key **new writes** use. Every other key
  in the ring is kept only so existing rows still decrypt.

Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Where it must live

**Not in this repository, and not on the same host as the database.**

Those two rules are the whole point. A key stored next to the ciphertext it
protects protects nothing: whoever takes the database dump takes the key with
it, and the encryption becomes a formality that cost real availability risk and
bought nothing.

| Requirement | Why |
| --- | --- |
| A secrets manager — AWS Secrets Manager, GCP Secret Manager, 1Password, Vault | Access-controlled, audited, and recoverable by more than one person |
| A second copy in **different custody** from the first | A single secrets account is a single point of failure, and the failure is total |
| **Never** in git, a Dockerfile, a CI log, an issue tracker, or a screenshot | Once it is in history it is compromised, and rotation is then mandatory, not optional |
| **Never** on the database host | See above — it defeats the entire control |

`.env` is acceptable in local development only, against a database holding
nothing real.

### Who holds it

At least two people, and it must be written down which two. A key one person can
lose is a key the business can lose; a key nobody can produce during an incident
is the same thing arriving more slowly.

---

## Backup

1. Store the key in the secrets manager **before** it is ever used to encrypt
   anything. A key that has encrypted a row it can outlive is already a risk.
2. Take a second copy into separate custody (a different provider, or a sealed
   offline copy held by a second person).
3. **Test the restore.** An untested backup is a belief. Restore the key into a
   scratch environment, point it at a database dump, and confirm a matter
   description comes back as words. Do this when the arrangement changes, and at
   least annually.
4. Record the date of the last successful restore test somewhere durable. If
   nobody can say when it last worked, it has not been tested.

---

## Rotation

The envelope carries the key id, so rotation is incremental and does not require
downtime. Rotate on a schedule, and immediately on any suspicion of exposure.

```bash
# 1. Generate a new key and ADD it to the ring, keeping the old one.
#    MATTER_ENCRYPTION_KEYS="k1:<old>,k2:<new>"
#    MATTER_ENCRYPTION_ACTIVE_KEY="k2"

# 2. Deploy. New writes use k2; existing rows still decrypt under k1.

# 3. Re-encrypt everything written under the old key. Idempotent — it reports
#    how many rows it changed and how many were already current, so it is safe
#    to run, check, and run again.
npm run privacy:encrypt

# 4. Only once step 3 reports 0 rows remaining under k1, remove k1 from the ring.
```

> **The trap.** Removing a retired key from `MATTER_ENCRYPTION_KEYS` before
> `privacy:encrypt` has re-encrypted every row written under it destroys those
> rows exactly as surely as losing the key. `decryptField` will throw
> `it was written with key "k1", which is not in the key ring` — and by then the
> only fix is to put the key back, which is only possible if you still have it.
> Retire a key from the *active* slot first; remove it from the *ring* last.

---

## If the key is lost

There is no recovery path. Say so honestly and quickly rather than investigating
for a week:

1. Confirm it is genuinely gone — every secrets store, every custodian, every
   environment, and any host that ever ran the application with it set.
2. If it is: the affected columns are unrecoverable. Under the PDPA this is a
   **loss of availability of personal data**, which is a personal-data breach —
   not only a leak. It is notifiable.
3. **Notify each affected firm.** They are the controller of that matter data
   and we are their processor; our duty on a breach runs to them, and their
   duties to their clients and to the Authority follow from what we tell them.
4. Do not silently re-encrypt the columns with a new key. Rows would then hold
   ciphertext nobody can read, indistinguishable from working data until
   somebody opens a matter.

## If the key is exposed

Rotate immediately using the procedure above, then treat every row written under
the exposed key as compromised for notification purposes. Ciphertext that has
left the building does not become safe again because the key changed — it
becomes safe only if the attacker never had both.

---

## Related

- [DATA-INVENTORY.md §12](./restructure/DATA-INVENTORY.md#12-encryption-at-rest) — what is encrypted and why
- `src/lib/privacy/encryption.ts` — the implementation
- `npm run check:privilege` — asserts ciphertext is never a return value
- `npm run privacy:encrypt` — the backfill and re-encryption tool
