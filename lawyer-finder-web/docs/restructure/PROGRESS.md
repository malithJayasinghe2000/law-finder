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
| 2.5 | Firm-first intake + stop pricing on client volume | 🟢 **Done** |
| 3 | Billing restructure (SaaS licence) | 🟢 **Done** |
| 4 | Advertising split | 🟢 **Done** |
| 5 | AI compliance | 🟢 **Done** |
| 6 | PDPA compliance | ⚪ Not started |
| 7 | Growth features | ⚪ Not started |

Legend: ⚪ not started · 🟡 in progress · 🟢 done · 🔴 blocked

## Next up

**Register the three missing Acts in the legal library.** The vector store holds the
Civil Procedure Code, Companies Act and Motor Traffic Act, but none of them has a
`LegalDocument` row — they were loaded by the ingestion script rather than through the
admin upload screen. So citations to them are correct but **not clickable**: the chat
shows "Not yet in the library" instead of a link. That is the honest failure mode, and
it is a data task, not a code one. Upload the three PDFs through
`/dashboard/admin/legal-documents` and the citations resolve. Do not hand-edit
`ragDocumentName` to force a match — guessing which Act a row refers to is how you end
up citing the wrong statute.

**Phase 6 — PDPA.** The natural next phase, and now the only one left before growth
work. Phase 5 left it the retention period, the purge script and a clean picture of
what personal data the AI holds; Phase 3 left it a `FeeNote` model holding client
names and work narrations that will need the same treatment.



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
| 2026-08-02 | `Booking.lawyerId` and the whole schedule become **nullable**; `firmId` becomes **required** | Firm-first intake needs a matter that exists before anyone is assigned and before any appointment. Faking it (defaulting `lawyerId` to the principal) would have misrepresented the client's choice, which is the one thing rule 4 turns on |
| 2026-08-02 | New immutable `Booking.clientSelectedAttorneyId` | Records whether the *client* picked the practitioner, and survives reassignment. Also closes a hole from Phase 2, where reassigning a matter silently erased who the client had originally chosen |
| 2026-08-02 | A firm-first request carries **no appointment**; the attorney proposes one with the quote | Holding a diary slot before the firm has run a conflict check is a marketplace-booking habit. Nothing is scheduled until the firm has decided it can act and the client has accepted terms |
| 2026-08-01 | Adopted a **Rule 40 content limit** as the spec for every attorney/firm-describing surface | Rule 40 lists what an attorney may display; treating it as exhaustive is the conservative reading and costs nothing |
| 2026-07-31 | Phase 0 disables *paths*, not schema. `Review`, `WithdrawRequest`, `ConsultationPricing` stay in the schema until Phase 3 | Do not break working flows to make a legal fix |
| 2026-08-03 | The AI is generated **server-side only**; the browser never calls a model service | The chat page fetched the RAG service on a `NEXT_PUBLIC_` URL. Every AI rule was decoration while that was true — the page told anyone who looked where the model lived, and it answered without us |
| 2026-08-03 | An answer that trips the policy is **withheld whole**, never edited | Rewriting a model's legal prose to make it compliant means authoring legal content by hand, which is the thing rule 6 exists to stop |
| 2026-08-03 | Nothing streams | A streamed answer has been read by the time it can be checked. Streaming and post-generation checking are mutually exclusive, and the check is worth more than the typing effect |
| 2026-08-03 | The AI surfaces **no practitioner at all** — not by name, not by category | The conservative answer to counsel question 6, taken rather than deferred. If it turns out to be permissible, restoring it is a feature; if not, we never did it |
| 2026-08-03 | Citations resolve to an openable document or are shown unlinked; never a dead link | A citation the reader cannot open manufactures authority. Being honest that we do not hold the document is better than a link to nowhere |
| 2026-08-03 | Guest AI questions are **not stored at all** | A guest has no history to return to, so there is no product reason to keep their account of their legal problems. The cheapest way to hold data safely is not to hold it |
| 2026-08-03 | `Subscription` belongs to `LawFirm`, not `LawyerProfile` | An attorney paying a platform monthly looks like an attorney paying for access to clients. What we sell is practice-management software and a practice is what runs on it. Access follows from firm membership |
| 2026-08-03 | A **seat is a person who can sign in**, counted as an ACTIVE `FirmMember` | Counting only attorneys would let a firm add unlimited paralegals free. Seats are the one thing we may meter, because they count software users and not clients |
| 2026-08-03 | The migration **stands down** duplicate firm licences rather than deleting them | Where several attorneys at one firm each bought a licence, the extras become CANCELED with their end dates untouched. A CANCELED subscription is still honoured until it expires, so nobody loses access they paid for |
| 2026-08-03 | `FeeNote` carries **no platform-fee or commission column at all** | Not a nullable one, not one defaulting to zero. A column that exists is a column a future product decision can populate. The absence is the guardrail |
| 2026-08-03 | A cancelled fee note **keeps its number** | Sri Lankan tax practice expects an unbroken series. A gap is a question the firm would have to answer to a tax officer, created by our convenience |
| 2026-08-03 | Only a **firm principal** may buy or change the firm's licence | It now binds the whole practice and every seat in it. Any attorney could previously buy one because the subscription was theirs alone |

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

### 2026-08-02 — Phase 2.5 (firm-first intake + repricing)

Two changes that belong together: the first removes the reason the old pricing
existed, the second replaces the flow it was priced around.

**1. The pricing page was the biggest remaining violation.**

Subscription tiers metered — and the public pricing page advertised —
`inquiries_per_month` (10 → 50 → 200 → unlimited),
`chat_messages_per_month` (50 → 500 → 2,000 → unlimited) and
`promo_campaigns_per_month` (0 → 2 → 10 → unlimited).

Read plainly: **an attorney paid us more money to receive more clients.** That is
pay-per-lead in a subscription tier, which guardrail rule 1 names exactly — *"the
moment pricing correlates with how much legal work flows through the platform, it
is fee-sharing again under a different name"* — and rule 3 forbids selling leads
at all. Charging per client *message* is the same defect: charging for the
connection. Worse than the sponsored listings removed in Phase 2, because this was
the stated business model on a public page.

All three deleted from `Feature`, `FeatureLimitConfig`, `FeatureUsage`, the seed
and the pricing page. Tiers now differ on `firm_seats`, `storage_gb`,
`articles_per_month`, `document_templates` and `ai_research_queries_per_month` —
how many people use the software and what it can do, never how many clients reach
the firm through it.

**Found while doing it:** `prisma/seed.ts` still wrote `baseFeeRange`, a column
deleted in Phase 2 — so `npm run db:reset` had been **broken since that session**
and nobody noticed because the seed was never run. Fixed, and the seed now
provisions a firm of one for every attorney it creates, mirroring what approval
does.

**2. Firm-first intake.**

Phase 2 created firms but the client journey still made a client pick an
individual attorney and a slot in that attorney's diary. Two problems: it made the
individual look like the provider of legal services, and it held a diary slot
before the firm had decided whether it could even act.

There are now two lawful ways in, and both are the **client** choosing:

```
ATTORNEY-FIRST (unchanged)          FIRM-FIRST (new)
client picks an attorney            client engages a firm
  + a slot from their diary           no attorney, no appointment
        │                                   │
        ▼                                   ▼
  conflict check                      firm assigns an attorney
        │                                   │
        ▼                                   ▼
  quote (fee only)                    conflict check
        │                                   │
        ▼                                   ▼
  client accepts                      quote (fee + proposed appointment)
                                            │
                                            ▼
                                      client accepts
```

*Schema* (`20260802212804_firm_first_intake`) — `Booking.lawyerId`, `date`,
`startTime`, `endTime`, `duration` all nullable; `firmId` now **required**; new
immutable `clientSelectedAttorneyId`; `Quote` gains `proposedDate` /
`proposedStartTime` / `proposedEndTime`.

*New surfaces* — `/firms` (alphabetical, unpurchaseable, Rule 40 bound),
`/firms/[slug]/engage` (deliberately **not** a booking form: no calendar, no fee,
and a four-step explanation of what submitting does and does not do), a "Law Firms"
entry in the site header ahead of the attorney directory.

*Behaviour* — a firm-first matter blocks no calendar until an appointment exists;
the quote composer collects a proposed time when the matter has none and holds
that slot while the quote is outstanding; the conflict check and quote both refuse
on an unassigned matter and say who must assign it; assignment skips the clash
check when there is nothing to clash with; unassigned matters carry an
**Unassigned** marker in the firm's list and never appear on the calendar.

**Verification**
- `npm run build` and `npx tsc --noEmit` clean; `npm run check:privilege` 10/10;
  migrations in sync
- Making `lawyerId` nullable surfaced **70 type errors** across 11 files — every
  place that had silently assumed a matter always has an attorney and a date. All
  fixed rather than suppressed; that error list *was* the sweep, and is the reason
  nullable was the right call over faking an assignment
- Migration tested against a database seeded **before** it, including a booking
  deliberately created with no firm: the guard repaired it from the attorney's firm
  instead of failing on `SET NOT NULL`. Historic matters had
  `clientSelectedAttorneyId` backfilled from `lawyerId`, since attorney-first was
  the only path that existed
- `npm run db:reset` exercised end to end on a clean database: seed succeeds, 5
  attorneys → 5 firms → 5 principals, tiers carry no client-volume metering
- Both intake paths driven end to end against a real database (14 assertions):
  firm-first creates unassigned with no appointment, survives assignment, gets its
  appointment from the quote, reaches QUOTED; attorney-first unchanged;
  reassignment does not erase the client's original choice; the database itself
  forbids a matter without a firm and permits one without an attorney
- Guardrail sweep clean on all seven rules

**Still open**
- Counsel questions 16–18 — **blocks everything**
- Subscriptions are still per-attorney, not per-firm seats (Phase 3)
- Fee-note module not built (Phase 3)
- `PaidPromo` and lawyer-owned `AdCampaign` still exist (Phase 4)
- `ConsultationPricing.physicalPrice` / `onlinePrice` still present, always 0

### 2026-08-03 — Phase 4 (advertising split) + directory merge

**A correction to what Phase 2 claimed.** Phase 2 reported removing attorney-bought
placement. It removed it from the *directory only*. `AdBanner`, `SidebarAd` and
`StickyBottomAd` still rendered `ad.lawyer.fullName` and linked to `/lawyers/{id}`
on the homepage, the blog, blog posts — and **the AI chat sidebar**, where a person
describes their legal problem and an attorney who paid us appeared beside the
answer. That is rules 3 and 4 together on the surface where the 1894 Ordinance
bites hardest.

**The split.**

Advertising is now sold to non-legal advertisers only, and the rule is structural
rather than procedural: `AdCampaign` belongs to an `Advertiser` and has **no
relation to `LawyerProfile` or `LawFirm` at all**. A lawyer cannot buy an advert
because the schema gives them nowhere to be.

*Schema* (`20260803095511_advertising_split`) — new `Advertiser` with
`AdvertiserCategory` / `AdvertiserStatus`; `AdCampaign.lawyerId` → `advertiserId`;
`PaidPromo` and `PromoStatus` **deleted**, not repurposed; `DIRECTORY_TOP` and
`DIRECTORY_INLINE` removed from the `AdPlacement` enum entirely so restoring them
needs a migration rather than an admin toggle; `LEGAL_LIBRARY_SIDEBAR` added.

*The gate.* `Advertiser.nonLegalConfirmed` records that a named `ADMIN` positively
confirmed the organisation neither practises law nor sells legal services, with the
date and their id. Nothing runs without it, and it is checked three times — at
review, at campaign creation, and in the serve query itself. Changing an
advertiser's name, legal name or category withdraws the confirmation and pauses
live campaigns.

*Refused by category, not case by case* — legal consultancies, claims-management
companies, document-drafting services, legal-expenses insurers, litigation funders,
debt-recovery agencies. "Not an attorney" is not sufficient: those businesses either
practise law unlicensed or channel work to those who do, and we would be the
channel. A plain-text screen surfaces these terms to the reviewer as an aid, not a
substitute for looking.

*Units* — every advert is labelled **"Advertisement"** (not "Sponsored", which reads
as editorial endorsement), never shaped like a listing card, and always links
**outward** with `rel="sponsored"`. `SponsoredListing` — an attorney's profile card
with a star on it — was deleted and is not replaced.

*Removed* — `/api/lawyer/ads`, the lawyer ads dashboard, `/api/admin/paid-promo` and
its page, `/api/admin/ads/invoice`, `LawyerCreateAdSchema`, the `card-grid`
placement preview, and ad invoicing through the lawyer-keyed `Invoice` model
(advertisers are billed outside the platform until there is a proper advertiser
billing module).

**Directory merge.** `/firms` and `/lawyers` were showing the same four people —
every firm is currently a firm of one, so a sole practitioner appeared once as a
person and once as their own practice. They are now two lenses on one browse
surface with a Practices / People toggle, and the site nav carries one entry
instead of two. Fewer ways to be channelled, which also matters for counsel
question 18.

**Verification**
- `npm run build`, `npx tsc --noEmit`, `npm run check:privilege` (10/10), migrations
  in sync
- Migration tested against a database seeded **with the data that would break it**:
  two attorney-owned campaigns, one on a `DIRECTORY_TOP` placement, plus slot
  bookings, analytics and a `PaidPromo` row. The generated SQL would have failed
  twice — on the enum rewrite and on `ADD COLUMN advertiserId NOT NULL` against a
  populated table — so the migration deletes the attorney-owned advertising first,
  which is the thing it exists to remove
- **17-assertion ad test** against a real database: no `lawyerId` column survives,
  `PaidPromo` is gone, directory placements are not expressible, every DB placement
  is permitted in code, pending/unconfirmed/suspended advertisers all serve nothing,
  a confirmed one serves, and the text screen catches a law firm, a legal
  consultancy and a claims manager while passing a bank
- `db:reset` exercised end to end — **and it caught a real break**: the seed still
  wrote the two directory placements, so a fresh database would have failed. Fixed
- Guardrail sweep found two silent leftovers: a dead `LawyerCreateAdSchema` with no
  callers, and `c.lawyerId === lawyer.id` in admin finances comparing against a
  column that no longer exists — it compiled only because the row was cast to
  `any`, and would have reported zero forever

**Still open**
- Counsel questions 16–18 — **blocks everything**
- Advertiser billing has no module; invoicing happens outside the platform
- Phase 3 remainder: firm seats, fee notes, `ConsultationPricing` price columns
- Phases 5 (AI), 6 (PDPA), 7 (growth)

### 2026-08-03 — Phase 5 (AI compliance)

**The finding that reshaped the phase.** The brief assumed the AI needed disclaimers,
citations and refusals bolted on. The actual problem was structural: the chat page
called the RAG service **directly from the browser** on `NEXT_PUBLIC_RAG_API_URL`, then
posted the answer it had received back to us to be stored. Our application never saw
the question or the answer.

Two consequences, neither survivable. No rule could be enforced — a refusal check on
our side would have been decoration, because the page told anyone who looked where the
model lived and it answered without us. And the stored transcript was whatever the
client said it was: `assistantMessage` and `sources` arrived as request-body fields, so
"this answer was properly cited" was a claim the caller made about itself.

So Phase 5 is mostly one change — **every AI answer is now generated server-side, by
one route, behind one policy file** — and the scope items follow from it.

**What was actually running**

The RAG service was not neutral about lawyers. It had a `lawyer_request` intent and a
`situation_report` post-processor that, between them, produced:

> "Based on our conversation, I'd recommend consulting **a Property Lawyer** for your
> situation. I've found some matching lawyers on our platform below who may be able to
> help you."

> "💡 **Would you like me to recommend a lawyer who specializes in this area?**"

Both fired off the back of the user describing their own legal problem — the platform
selecting practitioners from privileged material, on the surface where the 1894
Ordinance bites hardest. Rules 3, 4 and 5 in one sentence. Also found: the chat's empty
state read *"Hi, I'm Your Personal Lawyer"* over *"begin a case review"*, and the
conversational prompt instructed the model to tell users it ran "an internal
verification tool to self-check citations before answering" — **a tool that does not
exist**.

**Built**

- **`src/lib/ai/policy.ts`** — one policy file, the sibling of `firms/access.ts` and
  `ads/eligibility.ts`. Classifies the request, evaluates the answer, resolves
  citations. Refuses `OWN_MATTER_ADVICE`, `OUTCOME_PREDICTION`, `DOCUMENT_DECISION`,
  `REPRESENTATION_REQUEST` before the model is called; withholds `ADVICE_IN_ANSWER`,
  `PRACTITIONER_STEERING`, `UNSUPPORTED_CITATION`, `NO_CITABLE_SOURCE` after
- **`POST /api/ai/ask`** — the only route that produces an AI answer. Refuse → generate
  → evaluate → persist, in that order. Refusing first means the user's account of their
  own matter is never transmitted. Guest allowance moved server-side (it was in
  `localStorage`, resettable from the console)
- **`npm run check:ai`** — 49 assertions. Written because `build` and `tsc` pass happily
  on a policy that answers "should I sign this contract"
- **`npm run ai:purge`** — 180 days from last use, `updatedAt` not `createdAt` so an
  active conversation is not deleted underneath someone

**Removed** — `/api/ai-chat/suggest-lawyers`; `POST /api/ai-chat/conversations/[id]/messages`
(the client-writable transcript); `AiMessage.lawyerSuggestions` and `.sources`; the
`ChatWidget` "Legal Assistant" panel on `/about`, whose input had **no handler at all**
while it offered to assist with your legal needs; and in `lawyer-rag`,
`lawyer_recommend_tool`, `detect_practice_areas_tool`, `PRACTICE_AREA_KEYWORDS`,
`generate_lawyer_response`, the situation-report upsell, and web-search grounding.

**Citations now resolve, or say they do not.** A citation comes from retrieval
metadata, never the model, so the list cannot be hallucinated — the *prose* can, which
is why prose Act mentions are checked against what was actually retrieved. Where a
citation maps to a `LegalDocument` it links to it; where it does not it is shown as
text marked "Not yet in the library", never as a link to nowhere.

**Confidentiality** — the AI path touches `aiConversation`, `aiMessage` and
`legalDocument`, and nothing else. `buildModelContext()` takes a question and this
chat's own history; there is no parameter through which matter data could travel. The
RAG service also stopped writing every question and answer to a plaintext JSONL file —
and one such file was **committed to the repository**. It now logs metrics only, and
`data/chat_logs/` is gitignored.

**Verification — and two real holes that only running it found**

`npm run build`, `npx tsc --noEmit`, `check:privilege` 10/10, `check:ai` 49/49,
migrations in sync. Migration tested against a scratch database seeded with the data
that would break it (populated `sources` and `lawyerSuggestions`): message text
preserved, columns dropped, `migrate diff` reports *No difference detected*. Seed
replayed end to end on a clean database.

None of that caught what mattered. Driving the real assistant against the real model
did. Asked *"my employer fired me without notice and refused to pay my final salary"*,
it replied:

> "I'm sorry to hear that you've been **unfairly dismissed**... In Sri Lanka, unfair
> dismissal is governed by the **Employment (Amendment) Ordinance No. 14 of 2017**...
> you may want to consider the following steps: 1. Review your employment contract..."

Two defects, both in code that had just passed 43 assertions:

1. **The unsupported-citation regex could not see past a parenthesis.** Sri Lankan
   legislation is routinely named "X (Amendment) Ordinance", and the pattern required
   plain capitalised words — so the most common form of Act name was skipped entirely.
   The corpus holds no employment legislation at all; that Ordinance was invented, had
   six unrelated Companies Act citations attached, and was published.
2. **The advice scan missed the two shapes the model actually uses** — characterising
   what happened to the user in legal terms ("you have been unfairly dismissed" is a
   finding, not sympathy), and the numbered plan of action.

Both fixed, both added as permanent cases, and the same request now returns
`ADVICE_IN_ANSWER` while *"What does the Companies Act say about the duties of a
director?"* still publishes with six citations. **Having sources is not the same as
being sourced** — that is the lesson worth carrying forward.

**Still open**
- Counsel questions 16–18 — **blocks everything**
- Counsel question 6 answered conservatively rather than resolved
- Three Acts are in the vector store with no library row, so their citations do not
  resolve. See *Next up* — it is a data task
- The refusal patterns are English-only; the platform ships `si` and `ta` locales, and
  a question asked in Sinhala or Tamil bypasses the pre-generation check entirely. The
  post-generation checks are also English-only. Recorded as counsel/product question
  rather than fixed, because it needs translation review, not more regexes
- Advertiser billing has no module; invoicing happens outside the platform
- Phase 3 remainder: firm seats, fee notes, `ConsultationPricing` price columns
- Phases 6 (PDPA), 7 (growth)

### 2026-08-03 — Phase 3 remainder (firm seats + fee notes)

The revenue model, made structural. Three changes that all follow from the same
sentence: **the firm provides the legal service and we provide software.**

**1. The licence belongs to the firm.**

`Subscription` moved from `LawyerProfile` to `LawFirm`. An attorney paying a platform
every month looks like an attorney paying for access to clients; a practice paying for
practice-management software is what we actually are. Access now follows from firm
membership, resolved in the new
[`src/lib/firms/billing.ts`](../../src/lib/firms/billing.ts) — the only file that
answers "what is this firm subscribed to".

`Invoice` gained `firmId` (the party billed) and `lawyerId` became nullable (who raised
it). Only a **principal** may now buy or change a licence, since it binds every seat in
the practice.

**2. A seat is a person, and nothing else may be metered.**

Seats count `ACTIVE` `FirmMember` rows — everyone the firm has given access to,
attorney or not. Enforced on adding a member *and* on reactivating a removed one, since
"remove then re-add" would otherwise be a way around the licence. Surfaced on the firm
console so nobody meets a 402 by surprise.

**Found while sweeping, and this is the important part.** Phase 2.5 removed
`inquiries_per_month` and `chat_messages_per_month` from the pricing tiers. The same
defect was still live somewhere else: `GET /api/chat/conversations` showed an attorney
without an active plan only their **five oldest client conversations**, replacing the
rest with *"Locked Conversation — Please upgrade to view this conversation."*

That is rule 1 exactly — revenue rising with how many clients reach an attorney — and
worse than the pricing page was, because it withheld a **client's own message from
their own lawyer** over an unpaid software bill, putting us inside a relationship we
are not part of. Removed from the API, and the blur, lock icon and upsell removed from
`ChatInterface` too.

**3. Fee notes.**

New `FeeNote` model and module: the firm bills **its own client**, under its own TIN and
VAT number, into its own bank account. We render the document and are not in the
transaction. Not to be confused with `Invoice`, which is us billing a firm for software.

- **No platform-fee column and no commission column exist on the model.** The absence
  is the guardrail; a column that exists is a column a future decision can populate
- Content is **snapshotted at issue** like the engagement letter — a fee note is a tax
  document and must still say what it said on the day it was sent
- Numbers are sequential per firm per year; a cancelled note keeps its number, because
  a gap in the series is a question the firm has to answer
- "Record as paid" **records**; there is no admin approval, because we never saw the money
- Platform staff cannot read one: it names the client and narrates the work

Also: `ConsultationPricing.physicalPrice` / `onlinePrice` dropped — the last published
"buy a consultation at this price" fields in the schema, forced to 0 since Phase 0 and
read by nothing.

**Verification**

`npm run build`, `npx tsc --noEmit`, `check:privilege` 10/10, `check:ai` 49/49,
migrations in sync. New **`npm run check:billing`** — 17 assertions against a real
database covering the arithmetic, the document wording, snapshot immutability, the
numbering series, and that seats answer without reference to matters or clients.

The migration was tested against a database seeded with the data that would break it:
**one firm with two attorneys each holding their own ACTIVE licence.** The more valuable
survived as ACTIVE, the other was stood down to CANCELED with its end date untouched so
no access was lost. The orphan guard was tested by deliberately detaching an attorney
from their firm — it raised and aborted rather than silently dropping a paid licence.

**Two things the type checker could not have caught, both found by sweeping:**
- `admin/subscriptions/usage` renders `record.lawyerName` while the API now sends
  `firmName` — it would have rendered blank forever
- A sidebar badge keyed to a nav item labelled **"Payments & Commission"**, a page
  deleted back in Phase 1b. The condition had matched nothing since, and it was the last
  use of the word "commission" in the UI

And one the *seed* caught: `db:reset` on a clean database failed because `prisma/seed.ts`
still created subscriptions with `lawyerId`. That is the third phase running in which
seeding a clean database found a real break that the build did not.

**Still open**
- Counsel questions 16–18 — **blocks everything**
- Counsel question 6 answered conservatively rather than resolved
- Counsel question 10 (VAT/SSCL treatment) now matters more: fee notes compute VAT at a
  rate the firm sets, and neither we nor the firm has had that reviewed
- Advertiser billing still has no module; invoicing happens outside the platform
- Three Acts are in the vector store with no library row, so their AI citations do not
  resolve — a data task, see above
- The AI refusal patterns are English-only while the platform ships `si` and `ta`
- Phases 6 (PDPA), 7 (growth)
