# Phase 8 Brief — The Privacy Notice and the Data-Rights Screens

> **Starting a new chat?** Paste the prompt in [§1](#1-prompt-to-start-the-new-chat),
> then read this whole file plus the documents it points to before writing code.

---

## 1. Prompt to start the new chat

Copy everything in the block below as your first message:

```
I'm continuing a legal restructure of lawyer-finder-web, a Sri Lankan legal
platform. Phases 0 through 7 are complete and committed. We're starting Phase 8.

Before writing any code, read these in order:
  1. lawyer-finder-web/docs/restructure/HOW-IT-WORKS.md
  2. lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md
  3. lawyer-finder-web/docs/restructure/DATA-INVENTORY.md
  4. lawyer-finder-web/docs/restructure/PROGRESS.md
  5. lawyer-finder-web/docs/restructure/PHASE-8-BRIEF.md
  6. lawyer-finder-web/docs/restructure/SYSTEM-REVIEW.md
  7. lawyer-finder-web/docs/database-migrations.md

Then confirm back to me, in your own words:
  - the difference between the three things Phase 8 builds, and why the privacy
    notice has to be versioned rather than merely editable
  - which parts of the PDPA rights engine already exist and which are missing
  - what a subject-access export must NOT contain, and why

Phase 8 scope, in priority order:

  1. A versioned privacy notice an admin can edit and publish. There is a
     PRIVACY_NOTICE_VERSION constant stamped onto every consent record, and no
     document anywhere that it refers to. Today "they consented" points at
     wording nobody can produce.

  2. A public page that renders the current published notice, and a permanent
     URL for each past version, so a consent record can link to exactly what was
     agreed on the day.

  3. A "your data" screen where a person can actually exercise their PDPA
     rights: see what we hold, toggle the three consents, download an export,
     and request erasure. The whole engine exists in src/lib/privacy/ and
     /api/privacy/* and has ZERO callers today — no user can exercise any right.

  4. A firm-side screen for subject requests referred to the firm
     (/api/firms/me/subject-requests, also with no callers). The firm decides on
     matter data, not us.

Do the legal reasoning yourself, take the conservative defensible option, and
explain it in plain language afterwards. Put anything genuinely unresolvable
into QUESTIONS-FOR-COUNSEL.md rather than blocking on it. If you find things
that should be added, changed or removed along the way, document them.

Working style, learned the hard way over seven phases:
  - Verify by RUNNING, not by reading. A green `npm run build` has hidden an
    invalid SQL migration, a seed broken for two sessions, an AI citing an Act
    that does not exist, star ratings still being collected two phases after
    they were reported removed, and — in Phase 7 — a firm-membership system that
    granted nothing at all to non-attorney staff across four separate layers.
  - Phase 7's lesson specifically: the checks passed because a fixture described
    a paralegal as `actorRole: 'LAWYER'`, a person who cannot exist. When a test
    passes, ask whether it describes a real actor.
  - Drive the actual app. Start the dev server on a spare port (`PORT=3210 npm
    run dev` — port 3000 may hold another project), log in as the seeded users
    in prisma/seed.ts, and click through what you built.
  - After removing a feature, grep for its callers. After fixing one route,
    check its siblings.
  - Status strings and enums in .tsx files compile fine while being silently
    wrong. Sweep after any enum change.
  - Test migrations against a database seeded with the data that would break
    them, not just an empty one. Run the seed on a clean database.
  - A failing check is not automatically a failing rule — check for a stale
    generated Prisma client (`npm run db:generate`) or a stale `.next` first.
  - If a user is confused by a screen, that's a bug in the screen.
  - Run `npm run build`, `npx tsc --noEmit`, and all five checks after every
    change set: check:privilege, check:firm, check:ai, check:billing, check:pdpa.
  - Schema changes ship as migrations: `npm run db:migrate -- --name <name>`.
    Never `prisma db push`.
  - Update docs/restructure/PROGRESS.md at the end of the session.

I'm a software engineer, not a lawyer. Make the legal calls yourself and explain
the reasoning in plain words afterwards.
```

---

## 2. Where the project stands

Phases 0–7 are complete and committed. The legal restructure itself is in good shape;
what is weak now is ordinary software — see [SYSTEM-REVIEW.md](./SYSTEM-REVIEW.md).

All five checks pass: `check:privilege` 41, `check:firm` 15, `check:ai` 49,
`check:billing` 21, `check:pdpa` 48. Migrations in sync. Seed runs clean.

**Still blocking everything and not code:** counsel questions 16–18 (may a consumer
attorney directory lawfully exist; does the 1894 Ordinance create criminal exposure for
the operator). Phase 8 is unaffected by the answer — data-protection rights apply to any
shape this product takes, including the B2B fallback.

---

## 3. What Phase 8 delivers

### The three things, and why they are different

This is the distinction to get right before writing anything.

| | What it is | Who uses it | Status today |
| --- | --- | --- | --- |
| **The privacy notice** | The legal text: what we collect, why, on what basis, how long, who it goes to | Anyone, before signing up | **Does not exist at all** |
| **Its version history** | Each published version kept forever, addressable by URL | Anyone checking what they agreed to | Version *numbers* exist; documents do not |
| **The "your data" screen** | Where a person *acts*: consents, export, erasure | A signed-in user | Engine complete, **zero callers** |

### Scope

1. **A versioned, admin-editable privacy notice.**
   - A model holding published versions (body, version label, publishedAt, publishedBy).
   - An admin screen to draft, preview and publish.
   - Publishing creates a **new version**; it never edits a published one in place.

2. **Public rendering.**
   - `/privacy` renders the current published version.
   - `/privacy/<version>` renders a specific past version, permanently.
   - Linked from the footer, the sign-up form, and every consent record.

3. **The "your data" screen** (`/dashboard/profile/privacy` or similar).
   - What we hold about you, in plain language, grouped by the four tiers.
   - The three consents with toggles — and only those three.
   - "Download my data" → `GET /api/privacy/export`.
   - "Ask us to delete my account" → `POST /api/privacy/requests`, showing honestly
     that erasure is **partial** and which duty required keeping each retained thing.
     `summariseErasure()` already returns exactly this shape.

4. **The firm-side subject-request screen.**
   - Requests referred to the firm, because the firm — not us — decides on matter data.
   - `/api/firms/me/subject-requests` already exists.

### Explicitly out of scope

- Changing anything in `src/lib/privacy/policy.ts` beyond adding the notice model.
  The rules were settled in Phase 6 and are asserted by 48 cases.
- Retention periods for matter files — counsel question 7(c), still unanswered.
- Cross-border transfer — counsel question 19.
- Anything in the permissions-system cleanup (SYSTEM-REVIEW §1.1). Separate work.

---

## 4. Design decisions already made

**Versioned, not merely editable.** If an admin edits the notice in place, every past
`ConsentRecord` silently starts pointing at wording nobody agreed to. "They consented" is
only demonstrable if the exact document can be produced. This is the same snapshot rule
already used for `EngagementLetter.body` and `FeeNote.content` — and for the same reason.

**`PRIVACY_NOTICE_VERSION` moves from a constant to a lookup.** It currently lives in
`src/lib/privacy/policy.ts` as `'2026-08-03'`. It should become "the version of the
currently published notice", resolved from the database, with the constant kept as the
seed value for the first version so existing consent records still resolve.

**Consent is for three things and matter data is not one of them.** `MARKETING_EMAIL`,
`PRODUCT_ANALYTICS`, `AI_HISTORY_RETENTION`. If the screen offers a fourth toggle,
something has gone wrong — matter data rests on contract and professional duty, and
implying it is withdrawable promises something we cannot deliver against a firm's
retention duty.

**The export contains no matter data.** A `ConflictCheck` names *other* firms' clients.
Answering one person's request by releasing it would breach several others'
confidentiality at once. The export names the firms to ask instead. This is already how
`buildSubjectExport` behaves — do not "improve" it.

**Erasure is anonymisation and it is partial.** The screen must say so plainly, with the
reason per retained model. A refusal that does not name the duty is not a defensible
refusal.

---

## 5. Traps specific to Phase 8

- **Do not let the notice become a marketing surface.** It is a legal document. No
  "we care about your privacy" hero. It is bound by nothing in Rule 40 — it is about us,
  not about an attorney — but it must be accurate, and accuracy is checkable against
  DATA-INVENTORY.md.
- **The notice must match the inventory.** If they disagree, one of them is a lie. The
  inventory is the source of truth; the notice is its plain-language rendering.
- **Do not add a content column to `DataAccessLog`.** Standing rule.
- **An export is a file a person downloads.** It will contain their AI conversations,
  which are sensitive. Serve it authenticated, do not cache it, and do not write it into
  `public/`. Identity documents already taught this lesson in Phase 7.
- **Deleting an account must not be one click with no explanation.** It is partial and
  irreversible for the parts that are not partial. Confirm, and say what survives.

---

## 6. Known issues to fix along the way

From [SYSTEM-REVIEW.md](./SYSTEM-REVIEW.md), cheap and adjacent:

- **Nothing runs on a timer.** `privacy:purge`, `ai:purge` and `ads/expire` are all
  manual. A retention schedule nobody runs is a retention *document*. Adding a scheduled
  job is squarely in the spirit of this phase (§3.2).
- **`MATTER_ENCRYPTION_KEYS` has no custody arrangement** (§3.4). Losing it destroys
  every matter description, conflict check, quote scope, engagement letter and client
  message. Document the backup and rotation procedure even if the infrastructure is not
  yours to build.

---

## 7. How to verify Phase 8

A green build proves none of it. In addition to the five checks:

- **Drive it.** `PORT=3210 npm run dev`, sign in as each seeded user
  (`admin@thelawyr.lk`, `lawyer@thelawyr.lk`, `citizen@thelawyr.lk`, all
  `password123`), and actually click: publish a notice, view it, toggle a consent,
  download an export, request erasure.
- **Open the exported file.** Confirm it contains the person's own data and **no matter
  data** — no `Booking.description`, no `ConflictCheck`, no engagement letter.
- **Request erasure on a user who has a matter**, and confirm the matter survives and the
  response says which duty required keeping it.
- **Publish a second version of the notice** and confirm the first is still readable at
  its own URL, and that an old `ConsentRecord` still resolves to it.
- Extend `check:pdpa` with cases for the notice: that publishing creates a version rather
  than mutating one, and that a consent record's version always resolves to a document.
- Test the migration against a database seeded with existing `ConsentRecord` rows
  carrying `noticeVersion: '2026-08-03'` — they must still resolve after the change.

---

## 8. Where things live

| Concern | File |
| --- | --- |
| The retention/consent/erasure rules | `src/lib/privacy/policy.ts` → `npm run check:pdpa` |
| Export and erasure engines | `src/lib/privacy/subject.ts` |
| The access log | `src/lib/privacy/audit.ts` |
| Existing DSAR endpoints (no callers) | `src/app/api/privacy/{requests,export,consents,me}` |
| Firm-side referrals (no callers) | `src/app/api/firms/me/subject-requests` |
| What we hold, and whose it is | `docs/restructure/DATA-INVENTORY.md` |
| Encryption at rest | `src/lib/privacy/encryption.ts`, inventory §11 |
