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
| 2 | Law firm entity | ⚪ Not started |
| 3 | Billing restructure (SaaS licence) | ⚪ Not started |
| 4 | Advertising split | ⚪ Not started |
| 5 | AI compliance | ⚪ Not started |
| 6 | PDPA compliance | ⚪ Not started |
| 7 | Growth features | ⚪ Not started |

Legend: ⚪ not started · 🟡 in progress · 🟢 done · 🔴 blocked

## Next up

**Phase 2** — the `LawFirm` entity. Firms with members and roles
(`FIRM_OWNER` / `FIRM_ADMIN` / `ATTORNEY` / `PARALEGAL`), firm-level intake
routing, firm profiles. Every existing `LawyerProfile` migrates to a firm-of-one.
See [ROADMAP.md](./ROADMAP.md#phase-2--law-firm-entity).

Phase 0 and Phase 1 (1a + 1b) are complete. `npm run build` and
`npx tsc --noEmit` clean; migrations baselined and in sync.

## Decisions taken

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-07-31 | Reposition from marketplace to firm software ("the law firm part") | A commission-taking marketplace is the one shape this product cannot legally take in Sri Lanka. See [README](./README.md#why-it-is-being-restructured) |
| 2026-07-31 | Phase 0 before Phase 1 | Phase 0 is mostly deletion and kills live financial bugs (double-payment, PayHere charging 1% of fee) |
| 2026-07-31 | Design Phase 1 booking for firms from the start; solo lawyer = firm of one | Avoids a painful migration in Phase 2 |
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
