# Progress Log

> **Single source of truth for where the restructure stands.**
> Update at the end of every work session: move the phase status, add a dated entry,
> and leave the "Next up" section pointing at the exact next task.

## Status board

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Stop the bleeding (remove commission, escrow, PayHere; fix bugs; disclaimers) | 🟢 **Done** |
| 1a | Engagement state machine, conflict check, quotes | 🟢 **Done** |
| 1b | Engagement letter + triage/quote UI | 🟢 **Done** |
| 2 | Law firm entity | 🟢 **Done** |
| 3 | Billing restructure (SaaS licence) | ⚪ Not started |
| 4 | Advertising split | ⚪ Not started |
| 5 | AI compliance | ⚪ Not started |
| 6 | PDPA compliance | ⚪ Not started |
| 7 | Growth features | ⚪ Not started |

Legend: ⚪ not started · 🟡 in progress · 🟢 done · 🔴 blocked

## Next up

**Phase 3** — billing restructure. Move subscription pricing onto seats and
features so revenue cannot correlate with how much legal work flows through the
platform, and drop `ConsultationPricing.physicalPrice` / `onlinePrice` now that
nothing reads them.

**But first, and more urgent than Phase 3:** put counsel questions **16, 17 and
18** in front of a Sri Lankan Attorney-at-Law experienced in professional conduct.
They ask whether a consumer-facing attorney directory may lawfully exist at all,
and whether the **Intermeddlers with Suitors Ordinance No. 11 of 1894** creates
*criminal* exposure for the platform operator. Every phase after this one builds
on an answer we do not have. See
[the directory question](./LEGAL-GUARDRAILS.md#the-directory-question--our-largest-unresolved-risk).

Phases 0, 1 and 2 are complete. `npm run build`, `npx tsc --noEmit` and
`npm run check:privilege` all clean; migrations in sync.

## Decisions taken

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-07-31 | Reposition from marketplace to firm software ("the law firm part") | A commission-taking marketplace is the one shape this product cannot legally take in Sri Lanka. See [README](./README.md#why-it-is-being-restructured) |
| 2026-07-31 | Phase 0 before Phase 1 | Phase 0 is mostly deletion and kills live financial bugs (double-payment, PayHere charging 1% of fee) |
| 2026-07-31 | Design Phase 1 booking for firms from the start; solo lawyer = firm of one | Avoids a painful migration in Phase 2 |
| 2026-08-01 | `Booking` keeps `lawyerId` (who acts) and gains `firmId` (who was engaged), rather than making `lawyerId` nullable | Preserves the record of the client's own choice of attorney — the evidence for rule 4 — and avoids a nullable-`lawyerId` migration across ~20 files. The invariant that `lawyerId` belongs to `firmId` is enforced in one function |
| 2026-08-01 | Privilege scope defaults to *assigned attorney + firm principal/practice manager*; other attorneys and paralegals see that a matter exists but not what it says | Counsel question 8(b) is unanswered. Conservative default is cheap to loosen later and expensive to have got wrong. Asserted by `npm run check:privilege` |
| 2026-08-01 | Engagement letters now name the **firm** as the party and the attorney as acting; solo practices render identically to before | Rule 7. Existing letters are snapshotted so they are untouched |
| 2026-08-01 | Adopted a **Rule 40 content limit** as the spec for every attorney/firm-describing surface | Rule 40 lists what an attorney may display; treating it as exhaustive is the conservative reading and costs nothing |
| 2026-07-31 | Phase 0 disables *paths*, not schema. `Review`, `WithdrawRequest`, `ConsultationPricing` stay in the schema until Phase 3 | Do not break working flows to make a legal fix |

## Session log

### 2026-07-31 — Audit + plan

Read the full schema, booking APIs, payment/withdrawal flow, ad system, and AI
suggestion endpoint. Established the restructure direction and created these docs.

**Findings — the platform is half-migrated between two incompatible models, both live:**

*Legal exposure*
- `commissionRate` (15%) still computed on every booking, and still written on
  `accept` "to invoice the lawyer later" — deferring the commission does not fix
  fee-sharing
- Platform holds client money via `BookingPayment` → admin verification →
  `WithdrawRequest` payout. Functionally an unlicensed payment service
- `ADMIN` can read `Booking.description` — the client's legal problem in their own
  words. Privilege and PDPA exposure
- Zero disclaimers anywhere. Grepped `src` + `messages` for "disclaimer", "not legal
  advice", "attorney-client", "informational purposes" — **no matches**
- AI suggests lawyers ranked by `averageRating` and returns `subscriptionTier`.
  `reviews` API still fully functional despite commit `c917fdc "review system
  removed"` — the UI was removed, not the endpoint

*Live bugs*
- **Double payment.** `accept` has the client pay the lawyer directly, but
  `lawyer/withdraw` still lets the lawyer withdraw the same `lawyerFee` from a
  platform balance that never received it
- **PayHere mispriced.** `payment/route.ts` does `(totalAmount / 100).toFixed(2)`,
  treating LKR as cents when everything else uses whole rupees. A LKR 15,000
  consultation would charge **LKR 150**
- **Phantom refunds.** `reject` sets `refundAmount` + `refundStatus: PENDING` on
  bookings that were never paid
- **Duplicate state machines.** `accept`/`decline` and `approve`/`reject` are two
  different paths out of `AWAITING_LAWYER_APPROVAL`
- `bookingNumber` uses `count() + 1` — collides under concurrency
- `SlotHold` has no expiry sweeper; only cleaned when the same client books
- Booking creation 404s if the lawyer has no `ConsultationPricing`, in a flow that is
  supposed to have no prices

**Done this session:** created `docs/restructure/` (README, LEGAL-GUARDRAILS,
ROADMAP, PROGRESS); wired `AGENTS.md` so new sessions load this context.

### 2026-07-31 — Phase 0.1 + 0.2

**0.1 — commission removed.** `commissionRate` and `platformFee` are no longer
derived anywhere. Booking creation no longer reads `ConsultationPricing` (and no
longer 404s when it is absent). On `accept`, the lawyer's quoted fee is stored as
`lawyerFee` and `totalAmount`, with `platformFee` and `commissionRate` written as 0.

Also closed two price leaks the UI-only change had missed:
- `GET /api/consultations/availability` was returning `physicalPrice`,
  `onlinePrice`, `platformFee` and `commissionRate` in its public payload. Now
  returns non-monetary `consultationTerms` only
- `lawyers/[id]/page.tsx` was loading `consultationPricing` into the RSC payload,
  readable in page source even though the UI never rendered it. Removed

**0.2 — escrow removed.**
- New `GET /api/lawyer/consultations/income` — a bookkeeping record of fees quoted
  and marked received. No balance, no payout concept
- `POST /api/lawyer/withdraw` now returns **410 Gone**. `GET` retained read-only so
  existing requests stay visible
- `api/admin/withdraw` retained for reconciliation, flagged `retired: true`. PATCH
  still works so genuine legacy obligations can be settled — **but the platform
  holds no balance, so settlement must be reconciled manually**
- `api/admin/finances` no longer counts consultation fees as platform revenue.
  `platformTotalIncome` = subscriptions + ads only. Consultation figures are
  reported separately and explicitly labelled as not-revenue
- Lawyer earnings page rebuilt as **Consultation Income** (read-only, no withdraw
  form). Admin withdrawals page carries a retired-model warning. Sidebar labels
  updated

**Bugs fixed along the way**
- **Login 500s.** `clientIp` in `api/auth/login/route.ts` was block-scoped to the
  rate-limit check but referenced in the failed-attempt log — every mistyped
  password threw a ReferenceError and returned 500 instead of 401
- **Phantom refunds.** `reject` no longer writes a refund on unpaid bookings;
  `decline_reschedule` and `cancel` now check `paidAt` first
- **`bookingNumber` race.** Replaced `count() + 1` with a year-scoped max lookup in
  both `consultations/bookings` and `admin/bookings`
- `paymentInstructions` was missing from the client-side `Booking` interface
- `baseFeeRange` removed from the unused `OtherLawyer` type

**Verification:** `npx tsc --noEmit` clean (was 7 pre-existing errors — the project
did not typecheck before this session), `npm run build` passes.

**Open item for Phase 1:** `LawyerProfile.baseFeeRange` is still published publicly
via `GET /api/lawyers` and `ads/serve`. Left in place to avoid breaking the
directory mid-phase — decide its fate in Phase 1.

### 2026-07-31 — Phase 0.3–0.7 (Phase 0 complete)

**0.3 — PayHere removed.** It settled consultation fees into a *platform* merchant
account, which is the client-money problem the restructure exists to fix.
- Deleted `api/consultations/bookings/[id]/payment/webhook/` entirely
- Removed the `PAYHERE` branch from the payment route
- `BookingPaymentMethodEnum` is now `['BANK_TRANSFER', 'PAY_AT_OFFICE']`

Two bugs died with it:
- **Auth bypass.** The webhook set `isSandbox = !process.env.PAYHERE_MERCHANT_SECRET`
  and **skipped MD5 signature verification entirely** when the secret was unset —
  anyone could POST to it and mark a booking `PAID`
- **Mispricing.** `(totalAmount / 100).toFixed(2)` treated LKR as cents; a
  LKR 15,000 consultation would have charged LKR 150

**Refunds reframed.** The platform cannot refund money it never held. The lawyer
holds the fee, so the lawyer returns it and the platform only *records* that:
- `PATCH /api/consultations/refunds` now accepts the owning lawyer as well as admin
- `GET` opened to `LAWYER`, scoped to that lawyer's own refunds; the summary counts
  are scoped the same way (they previously reported platform-wide totals to anyone)
- Admin refunds page carries a notice that marking a refund records it, not makes it

**0.4 — `SlotHold`.** Correcting an earlier finding: expired holds never blocked
slots (availability filters `expiresAt > now`) and the route already swept them
per-lawyer. The real issue was unbounded row growth for lawyers who stopped
receiving hold requests. The sweep is now global.

**0.5 — privilege.** `subject`, `description` and `lawyerNotes` are redacted for
`ADMIN` in both booking read paths (Evidence Ordinance s.126). Also removed a
leftover `consultationPricing: { isNot: null }` filter that still excluded lawyers
without a pricing row.

**0.6 — disclaimers + neutral ranking.**
- New `components/shared/LegalDisclaimer.tsx` with `ai` / `library` / `directory`
  variants. Placed on the AI chat, both legal-library pages, and the public directory
- `suggest-lawyers` rewritten: no rating, no `subscriptionTier` returned at all,
  alphabetical ordering, optional district filter. Returns neutral criteria only
  (practice areas, district, languages, years of experience)
- Chat heading changed from "Recommended Legal Counsel" to "Attorneys practising in
  this area" — the platform recommends nobody
- Removed leftover `platformFee` / `retainedPlatformFee` displays across the admin
  consultations, refunds, and API surfaces

**0.7 — verification.** `npx tsc --noEmit` clean, `npm run build` compiles
successfully (77 static pages). Guardrail sweep confirms: no commission derived
anywhere, no PayHere code paths, no way to create a withdrawal request.

### 2026-07-31 — Phase 1a (engagement state machine)

**Context change:** the user confirmed this project is **not in production**. The
Neon URL in `.env` is commented out; the live datasource is a local Postgres
(`localhost:5432/lawfinder`) with 7 dev bookings. That removed the need for
backwards-compatible schema work, so Phase 1a cleaned up rather than accreted.

**Architecture correction.** The roadmap had called for a new `EngagementRequest`
model with a migration off `Booking`. Rejected: `Booking` already *is* an
engagement request, and a parallel table would have meant dual code paths through
every dashboard, email and admin screen. We evolve `Booking` in place instead.
ROADMAP.md updated to match.

**Schema**
- `BookingStatus` rewritten as the engagement lifecycle. Old states deleted
  outright (no production data to preserve)
- New `ConflictCheck` model — outcome, screened parties, firm-internal notes.
  Privileged: not readable by the client *or* by `ADMIN`
- New `Quote` model — versioned with `@@unique([bookingId, version])`, fee basis,
  scope/exclusions, the firm's own payment instructions, and an expiry
- `Booking.termsAcceptedAt` added
- **Deleted for good:** `Booking.platformFee`, `Booking.commissionRate`,
  `Booking.retainedPlatformFee`, `ConsultationPricing.commissionRate`,
  `BookingPayment.payhere*`, the `WithdrawRequest` model and `WithdrawStatus` enum,
  and `PAYHERE` from `BookingPaymentMethod` (still present in the Prisma enum after
  Phase 0.3 — only the Zod schema had been updated)

**State machine.** `src/lib/consultations/bookingStatus.ts` is now the single
source of truth: allowed transitions, slot-blocking vs slot-releasing sets,
terminal states, and client-facing labels. Every route guards through
`canTransition()`. This kills the two competing state machines — `accept`/`decline`
and `approve`/`reject` were separate paths out of the same state doing different
things.

**New routes**
- `POST/GET [id]/conflict-check` — only the attorney handling the request may run
  or read it. A non-clear outcome declines the request and tells the client only
  that the firm cannot act, never why (the reason belongs to the other client)
- `GET/POST/PATCH [id]/quotes` — firm issues, client accepts/declines. Issuing a
  new quote supersedes any outstanding one. Accepting an expired quote is refused
  with 410 and the request moves to `QUOTE_EXPIRED`
- `[id]/payment` reduced to a client *notification*; admin verification removed.
  Only the firm confirming receipt (`confirm_payment_received`) moves a request to
  `SCHEDULED`

**Removed:** `api/lawyer/withdraw`, `api/admin/withdraw`, the admin withdrawals
page, and their sidebar entries.

**Dev data:** the 7 local bookings were remapped to the new statuses before
`prisma db push` rather than dropped.

**Verification:** `npx tsc --noEmit` clean, `npm run build` compiles, schema in
sync with the local database.

**Note for later:** `prisma/migrations/` is badly out of sync — `0_init` creates 22
tables and contains no `Booking` at all. The project runs on `db push`. Before
production there needs to be a real migration baseline.

### 2026-07-31 — Migration baseline + Phase 1b

**Migrations baselined.** The history was unusable: `0_init` created 22 tables and
had no `Booking`, there was no `migration_lock.toml`, and both migrations showed as
*unapplied* even though the tables existed — `migrate deploy` would have failed on
`CREATE TABLE`. Deleted the stale migrations, generated a fresh `0_init` (47 tables,
31 enums), added the lock file, and marked it applied.

Caught by testing rather than trusting: the first generated file was **invalid SQL**.
`prisma.config.ts` loads dotenv, which prints a banner to stdout, and that banner
landed as line 1. Only surfaced by deploying to a scratch database. The stored
checksum was corrected afterwards. `docs/database-migrations.md` documents the trap.

Verified: deploy to a clean database →
`migrate diff --from-config-datasource --to-schema` reports "No difference detected".
Added `db:status` / `db:migrate` / `db:deploy` / `db:reset` / `db:studio` /
`db:generate` scripts.

**Phase 1b.**
- New `EngagementLetter` model, created through the new migration workflow
  (`20260731172750_add_engagement_letter`) — its first real use
- `src/lib/consultations/engagementLetter.ts` renders the letter as Markdown:
  parties, scope, fee basis, payment terms, confidentiality/privilege (Evidence
  Ordinance s.126), PDPA, termination, governing law — and states explicitly that
  the **firm** provides the legal service while the platform is only software
- Generated inside the quote-acceptance transaction, with content **snapshotted**
  rather than joined at read time, so the letter always reflects the terms as
  accepted
- `GET [id]/engagement-letter` — readable by client and firm, **not** platform
  staff. Records `clientViewedAt` on first open, as evidence terms were communicated
- New components: `ConflictCheckDialog`, `QuoteComposerDialog`, `QuoteReviewDialog`,
  `EngagementLetterDialog`
- Lawyer console rewired to the engagement flow (conflict check → quote → confirm
  payment received); client console gains quote review and letter access
- Intake wizard now explains what happens next, and states that submitting creates
  no lawyer-client relationship and no fee

**Removed:** the admin "Payments & Commission" page — it `PATCH`ed a payment
verification endpoint that no longer exists, and platform staff have no business
adjudicating a transfer into a firm's own account.

**Also fixed:** stale status strings across the admin, lawyer and client pages that
compiled fine but would have silently queried statuses that no longer exist.

**Verification:** `npm run build` compiles, `npx tsc --noEmit` clean, guardrail
sweep finds no commission, no PayHere, no withdrawals, no pre-Phase-1 statuses.

**Still open:** the engagement letter wording is a good-faith draft and needs
BASL-member counsel review before real clients see it (open question #3).

### 2026-07-31 — Post-test fixes (Phase 1 hardening)

The user walked the full flow and found real problems. All fixed, plus three more
found by auditing for the same *class* of bug.

**Reported and fixed**
1. **Engagement letter downloaded as `.md`** — wrong artefact for a legal document.
   Added a print-ready A4 route (`/[locale]/engagement-letter/[id]`) rendered
   through the browser's "Save as PDF". No PDF library needed
2. **"I have paid" stayed enabled after submission** — the client could resubmit as
   if nothing happened. Now shows "Update payment details" once recorded, or
   "Correct payment details" if the firm sent it back
3. **"Payment received" auto-scheduled with no review** — replaced with
   `PaymentReviewDialog`: the firm sees the bank details, reference, and receipt
   image, then confirms or rejects with a reason. New `reject_payment` action puts
   it back to the client. `confirm_payment_received` now refuses when no payment
   was recorded
4. **"Complete" was clickable before the consultation date** — guarded server-side
   (and disabled client-side) until the end time has passed. Same guard on
   `no_show` from the start time
5. **No lawyer-side refund management** — added
   `/dashboard/lawyer/consultations/refunds` plus sidebar entries. The API was
   already scoped to the owning lawyer in Phase 0.3; there was simply no page

**Found by audit, not reported**
6. **Expired quotes blocked slots forever.** A quote only expired when the client
   happened to open it. `QUOTED` is a slot-blocking status, so an unanswered quote
   silently held a slot off the calendar indefinitely. Added
   `src/lib/consultations/expireQuotes.ts`, swept lazily on the bookings list
7. **Dead handlers still shipping.** `handleAcceptSubmit` (called the removed
   `accept` action) and `handleVerifyPayment` (called the removed payment `PATCH`)
   were still in the lawyer page with their state, after their modals were deleted
   in Phase 1b. Both would have 400/404'd. Removed
8. **`NO_SHOW` was unreachable** — no UI path existed. Guard added; UI exposure
   still outstanding

**UX confusion is a bug, not a user error.** The conflict-check modal did not
explain what a conflict of interest is or what "parties screened" means — the first
real user had no idea. Rewritten with a plain-language explanation. Fee-basis
options now say when to use each rather than restating their names.

**Also:** created [QUESTIONS-FOR-COUNSEL.md](./QUESTIONS-FOR-COUNSEL.md) — 15
questions across 3 priority tiers, each stating what we built, why we believe it is
permissible, and what needs confirming, with an answer log to fill in.

**Verification:** `npm run build` compiles, `npx tsc --noEmit` clean.

**Still outstanding:** `NO_SHOW` has no UI trigger; `IN_PROGRESS` is unreachable
(may be fine — consider removing); the flow has not been re-tested end to end since
these fixes.

### 2026-08-01 — Settings cleanup, refund evidence, Phase 2 brief

**Found a live guardrail violation.** `Consultation Settings` still had
`COMMISSION_RATE = 0.15` hardcoded and showed lawyers "client pays = your fee +
platform fee" — the exact thing the restructure deleted, sitting in the lawyer's
own settings screen. Surfaced only because the user asked whether the section was
still needed. Removed, along with the obsolete pricing-model and consultation-fee
cards. The page keeps what still matters: minimum advance notice, free initial
consultation, and default bank details used to pre-fill quotes.

Also closed a second RSC price leak: `lawyers/[id]/book/page.tsx` still loaded
`consultationPricing` into the payload (the same bug fixed on the profile page in
Phase 0.1, missed here).

**Section review** (in answer to "are these still needed?"):
- *Availability Management* — keep, core to booking, unaffected by the restructure
- *Consultation Settings* — reworked as above
- *Consultation Income* — keep; becomes richer in Phase 3 with fee notes

**Refunds were not good enough.** Marking a refund with a note rested entirely on
the firm's word: no proof, no way for the client to confirm or contest it. Extended
to a real lifecycle:

```
NONE -> PENDING -> PROCESSED -> CONFIRMED   (client acknowledged receipt)
                        |
                        +-----> DISPUTED    (client says it never arrived)
                -> DECLINED
```

- Recording a refund now **requires** method, transaction reference, and date sent,
  with optional proof upload
- The client sees that evidence and either confirms receipt or disputes it
- A dispute shows on the firm's refunds page with the client's reason, and can be
  cleared by a fresh evidenced record
- New migrations: `refund_evidence_and_acknowledgement`, `refund_evidence_fields`

**Phase 2 brief written.** [PHASE-2-BRIEF.md](./PHASE-2-BRIEF.md) — a copy-paste
prompt for a fresh session, current state, scope, design decisions already made,
Phase-2-specific traps, carried-forward known issues, and a verification checklist
that explicitly says a green build is not sufficient evidence.

**Verification:** `npm run build` compiles, `npx tsc --noEmit` clean, migrations in
sync.

### 2026-08-01 — Phase 2 (law firm entity)

**A correction to the guardrails came first.** The user supplied research from a
separate project (`PROJECT-PLAN.md`, `DATA-MODEL.md`, `COMPLIANCE-RULES.md` at the
repository root) describing a stricter B2B product. Two instruments in it were
missing from our guardrails entirely and materially change the risk picture:

- **Intermeddlers with Suitors Ordinance No. 11 of 1894** — touting is a *criminal*
  offence and reaches the **intermediary**, not only the attorney. Our guardrails
  had been written entirely around attorney discipline, which understates our own
  exposure
- **Supreme Court Rule 40** — specifies what an attorney may *display*: name,
  professional qualifications, academic qualifications, office hours. That reads as
  an exhaustive permission, not a floor

Both added to LEGAL-GUARDRAILS.md, along with a new binding
[Rule 40 content limit](./LEGAL-GUARDRAILS.md#the-rule-40-content-limit--binding-on-every-profile-surface)
for every profile surface, a red-flag phrase list, and counsel questions 16–18 —
which ask the prior question nobody had asked: *may a consumer attorney directory
lawfully exist at all?*

**Live guardrail violations found and fixed** (all pre-existing, none introduced
by Phase 2):

1. **Attorneys were buying top placement in the lawyer directory.** `SponsoredListing`
   rendered "★ Sponsored" attorney cards above the alphabetical list on `/lawyers`
   and on the home page, sold through `AdCampaign`. That is selling position and
   visibility to a lawyer — rule 3, and the surface where the 1894 Ordinance bites
   hardest. Removed from both. The ad system itself is untouched; Phase 4 still owns
   the lawyer/non-lawyer advertiser split
2. **`GET /api/lawyers` published `averageRating`, `reviewCount` and `baseFeeRange`**
   on the public directory
3. **The public attorney profile rendered the subscription plan name as a badge** —
   a client could see which attorneys pay us more — and serialized reviews,
   `baseFeeRange` and the full subscription object into the RSC payload
4. **The home page loaded attorneys with a bare `findMany`** (every column into the
   page source) with no `orderBy`, under the variable name `topLawyers`

**Removed for good:** the `Review` model, `/api/reviews`, the admin reviews page and
its sidebar entries, and `LawyerProfile.baseFeeRange` with every input that fed it.

**Phase 2 proper**

*Schema* — `LawFirm`, `FirmMember`, `FirmOffice`; `FirmRole`
(`FIRM_OWNER`/`FIRM_ADMIN`/`ATTORNEY`/`PARALEGAL`), `FirmMemberStatus`,
`FirmVerificationStatus`, `FirmType`. `LawyerProfile.firmId`, `Booking.firmId` +
`assignedById`/`assignedAt`/`assignmentNote`.

*Migration* `20260801210442_law_firm_entity` — creates the tables **and backfills**:
every `LawyerProfile` becomes a firm of one with the attorney as `FIRM_OWNER`, their
address as the registered office, and every existing `Booking` mapped to that firm.
A firm of one inherits the verification standing of its only member.

*Privilege* — [`src/lib/firms/access.ts`](../../src/lib/firms/access.ts) is now the
only place that decides who may read a client's account of their legal problem.
Applied in the booking list, booking detail, conflict check and engagement letter.

*Routing* — a matter lands with the attorney the client chose and is visible to the
whole firm; only a principal or practice manager can reassign it, only within the
same firm, and only after checking the receiving attorney's own diary for a clash.

*Engagement letter* — now names the **firm** as the party to the retainer and the
attorney as the person acting. A solo practice renders exactly as before, because
the two names are identical and the template collapses them. Letters already issued
are snapshotted and untouched.

*New surfaces* — `/api/firms`, `/api/firms/me` (+ `members`, `offices`),
`/api/admin/firms`, `/api/consultations/bookings/[id]/assign`; a firm console at
`/dashboard/lawyer/firm`, admin firm verification at `/dashboard/admin/firms`, a
public firm page at `/firms/[slug]`, and `AssignMatterDialog`.

**Carried-forward issues closed**
- **`NO_SHOW` had no UI trigger** — button added, guarded until the appointment time
  has passed, mirroring the server guard
- **`IN_PROGRESS` was unreachable** — removed from the enum
  (`20260801211623_drop_in_progress_status`) and swept out of the state machine,
  Zod schemas, status labels and the client console

**Verification** — and note that a green build was explicitly not treated as evidence:
- `npm run build` compiles; `npx tsc --noEmit` clean
- Migration tested **three ways** before being trusted: deployed to an empty scratch
  database (valid SQL), `migrate diff` reports *No difference detected*, and the
  backfill was run against a seeded database containing **two attorneys with the same
  name** (slug collision handled: `nimal-perera-p-1` / `nimal-perera-p-3`), an
  attorney with an empty address (office correctly skipped), and three bookings
  (0 mismatched firm mappings). Then applied to dev: 5 profiles → 5 firms, 5 owners,
  0 unlinked bookings
- **New: `npm run check:privilege`** — asserts all nine access cases plus redaction.
  10/10 pass. Written because `build` and `tsc` both pass happily on a version of
  `access.ts` that lets a paralegal read a client's legal problem
- Caller grep after every removal: no references to `/api/reviews`,
  `dashboard/admin/reviews`, `pendingReviews`, `pendingReviewCount`, or
  `SponsoredListing` remain
- Status-string sweep: all 14 enum values present in code, no `IN_PROGRESS`, no
  pre-Phase-1 statuses
- Guardrail sweep: no commission, no escrow, no PayHere, no paid ranking, no rating
  in any ordering

**Also added:** [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) — a plain-language explanation
of what a law firm is, what each of the seven rules actually means and why, how a
matter flows end to end, why the data model looks the way it does, and a list of
normal product features that are illegal here. Written for an engineer with no legal
background.

**Still open**
- Counsel questions 16–18 (may a directory exist at all) — **blocks everything**
- Counsel question 8(b) — may non-attorney firm staff read matter detail
- The engagement letter wording is still an unreviewed good-faith draft (question 3)
- `ConsultationPricing.physicalPrice` / `onlinePrice` still exist, always 0 — Phase 3
- The ad system still has attorneys as the only advertisers — Phase 4
