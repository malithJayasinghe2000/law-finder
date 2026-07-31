# Progress Log

> **Single source of truth for where the restructure stands.**
> Update at the end of every work session: move the phase status, add a dated entry,
> and leave the "Next up" section pointing at the exact next task.

## Status board

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Stop the bleeding (remove commission, escrow, PayHere; fix bugs; disclaimers) | 🟡 In progress |
| 1 | Rebuild booking as engagement request flow | ⚪ Not started |
| 2 | Law firm entity | ⚪ Not started |
| 3 | Billing restructure (SaaS licence) | ⚪ Not started |
| 4 | Advertising split | ⚪ Not started |
| 5 | AI compliance | ⚪ Not started |
| 6 | PDPA compliance | ⚪ Not started |
| 7 | Growth features | ⚪ Not started |

Legend: ⚪ not started · 🟡 in progress · 🟢 done · 🔴 blocked

## Next up

**Phase 0.3** — remove PayHere from the booking payment path.
Then 0.4 (`SlotHold` expiry sweep — the other 0.4 bugs are already fixed), 0.5
(gate matter descriptions from `ADMIN`), 0.6 (disclaimers + neutral AI suggestion),
0.7 (final verification).

### Phase 0 sub-status

| # | Task | Status |
| --- | --- | --- |
| 0.1 | Remove commission / `platformFee` | 🟢 Done |
| 0.2 | Remove escrow / withdrawals | 🟢 Done |
| 0.3 | Remove PayHere from booking | ⚪ Next |
| 0.4 | Booking bug fixes | 🟡 Partial — phantom refunds + `bookingNumber` race fixed; `SlotHold` sweep outstanding |
| 0.5 | Gate matter descriptions from `ADMIN` | ⚪ Not started |
| 0.6 | Disclaimers + neutral AI suggestion | ⚪ Not started |
| 0.7 | Build + verify | ⚪ Not started |

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
