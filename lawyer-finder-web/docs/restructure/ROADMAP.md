# Restructure Roadmap

Phases are ordered so risk drops fastest first. Each phase is independently
shippable and must not break the flows that exist when it starts.

Live status: [PROGRESS.md](./PROGRESS.md) · Constraints: [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md)

---

## Phase 0 — Stop the bleeding

**Goal:** remove live legal exposure and live financial bugs. Mostly deletion.
**Why first:** the double-payment bug and the mispriced PayHere path are exploitable today.

| # | Task | Files |
| --- | --- | --- |
| 0.1 | Remove commission / `platformFee` from the booking flow. Client pays exactly the quoted fee; platform computes nothing from it | `api/consultations/bookings/route.ts`, `bookings/[id]/route.ts`, `api/admin/bookings/route.ts`, `api/consultations/availability/route.ts` |
| 0.2 | Remove escrow: withdrawal requests, platform-held balance, lawyer "earnings" as a platform liability | `api/lawyer/withdraw/route.ts`, `api/admin/withdraw/route.ts`, `api/admin/finances/route.ts`, `dashboard/admin/withdrawals`, `dashboard/lawyer/consultations/earnings`, sidebars |
| 0.3 | Remove PayHere from the booking payment path (also fixes the `/100` cents bug that would charge 1% of the fee) | `bookings/[id]/payment/route.ts`, `payment/webhook/route.ts`, `schemas/consultation.schema.ts` |
| 0.4 | Fix phantom refunds (`reject` sets `refundAmount` on unpaid bookings), `bookingNumber` `count()+1` race, `SlotHold` expiry sweep | `bookings/[id]/route.ts`, `bookings/route.ts`, `api/consultations/holds/route.ts` |
| 0.5 | Gate matter descriptions from `ADMIN` (privilege) | `bookings/route.ts`, `bookings/[id]/route.ts`, `api/admin/bookings/route.ts`, admin consultation pages |
| 0.6 | Add not-legal-advice disclaimers; make lawyer suggestion neutral (drop `subscriptionTier` + rating weighting) | `api/ai-chat/suggest-lawyers/route.ts`, `chat/ChatClient.tsx`, legal library, i18n `messages/*` |
| 0.7 | `npm run build`, verify no flow broken | — |

**Deferred to later phases (do not do in Phase 0):** deleting the `Review` model,
deleting `WithdrawRequest` from the schema, removing `ConsultationPricing`. Phase 0
disables the *paths*; schema cleanup happens in Phase 3 once nothing reads them.

---

## Phase 1 — Rebuild the booking flow

**Goal:** replace "buy a consultation" with "request an engagement".
**Designed for firms from the start** so Phase 2 is not a painful migration — a solo
practitioner is modelled as a firm of one.

### Target state machine

```
REQUESTED -> CONFLICT_CHECK -> QUOTED -> CLIENT_ACCEPTED -> SCHEDULED -> COMPLETED
                   |             |             |
               DECLINED       EXPIRED      CANCELLED_BY_{CLIENT,FIRM} / NO_SHOW
```

Replaces today's `BookingStatus`, which has two duplicate paths out of
`AWAITING_LAWYER_APPROVAL` (`accept`/`decline` and `approve`/`reject`).

### Three features that make this better, not just safer

1. **Conflict check.** Every firm must run one before accepting a client — it is a
   professional duty. No Sri Lankan platform does this. It makes the "request" stage
   meaningful instead of a fake wait.
2. **Engagement letter, generated on acceptance.** Parties, scope, fee basis, payment
   terms, explicit statement that the *firm* is the service provider and the platform
   is only software, confidentiality, termination. Valid under ETA 2006. This is the
   artefact that makes the relationship clean.
3. **Payment as a record, not a transaction.** Firm states its fee and its own account
   details. The *firm* marks payment received. Platform never sees, holds, verifies, or
   moves money. Admin removed from the loop entirely.

### Architecture note (corrected during 1a)

An earlier draft of this roadmap called for a new `EngagementRequest` model with a
migration path off `Booking`. That was wrong: `Booking` already *is* an engagement
request (client, lawyer, subject, description, schedule, status). A parallel table
would have meant dual code paths through every dashboard, email and admin screen —
exactly the "break a working flow" risk the guardrails warn against.

**We evolve `Booking` in place** and add `ConflictCheck` / `Quote` /
`EngagementLetter` as related models. Same end state, far less risk.

### 1a — state machine, conflict check, quote *(done)*
- Rewrite `BookingStatus` as the engagement lifecycle; delete the pre-Phase-1 states
- Centralise transitions in `src/lib/consultations/bookingStatus.ts`
- New models `ConflictCheck` and `Quote` (versioned, with expiry)
- New routes `[id]/conflict-check` and `[id]/quotes`
- Consolidate the duplicate `accept`/`approve` and `decline`/`reject` paths

### 1b — engagement letter + intake wizard *(next)*
- `EngagementLetter` model + generation on quote acceptance
- Rebuild `BookingWizardClient` as an intake wizard — no prices anywhere client-side
- Firm console: triage queue, conflict-check form, quote composer
- Client console: quote review, accept/decline, letter download
- Emails for each new transition

---

## Phase 2 — Law firm entity

**Goal:** the structural change the whole restructure depends on.

- `LawFirm` model: registration details, practice areas, offices, client-account details
- `FirmMember` with roles: `FIRM_OWNER`, `FIRM_ADMIN`, `ATTORNEY`, `PARALEGAL`
- Migrate every existing `LawyerProfile` to a firm-of-one (no data loss, no downtime)
- Firm-level intake routing: requests land in a firm queue, an admin assigns an attorney
- Firm profile pages; firm-level verification (replaces per-lawyer only)
- RBAC extension across existing subscription permission system

---

## Phase 3 — Billing restructure

**Goal:** move revenue from fee share to software licence.

- Flat SaaS subscription billed to **firms**, priced on seats + features
- Retire per-matter money model; drop `commissionRate`, `WithdrawRequest`,
  `BookingPayment` escrow fields from the schema
- **Fee note module**: the firm issues its own invoice to its own client under the
  firm's TIN/VAT. Platform generates the document, never the transaction
- Client-account ledger for firms (record-keeping only — see counsel question #5)
- Our own tax handling: VAT / SSCL on platform revenue

---

## Phase 4 — Advertising split

**Goal:** separate the neutral directory from a compliant ad business.

- Neutral lawyer directory: no paid position ever, disclosed ranking criteria
- New `Advertiser` entity for **non-legal** advertisers; ad campaigns move to it
- Retire `PaidPromo` and lawyer-bought `AdCampaign` placements
- Keep the existing placement/slot/analytics engine — it is good, just repoint it

---

## Phase 5 — AI compliance

- Mandatory not-legal-advice notice on every AI surface
- Mandatory source citation; refuse to answer where sources are absent
- Suggestion ranking neutral and disclosed; never weighted by what a lawyer pays
- Hard confidentiality boundary — client matter data never enters a shared model context
- **Matter-scoped AI** as a paid firm seat (research assistant over the firm's own files)

---

## Phase 6 — PDPA compliance

- Consent capture with purpose specification
- Retention schedule + automated deletion
- DSAR endpoints (access, rectification, erasure, portability)
- Access audit log across all matter data
- Encryption at rest for matter descriptions and messages
- Data-processor agreement template for firms; DPO designation

---

## Phase 7 — Growth features

Ordered by my estimate of value:

1. **Court date diary with cause-list integration.** Sri Lankan courts publish cause
   lists. Auto-matching them to firm matters and pushing reminders is the single
   most-loved feature we could ship — missing a court date is a lawyer's nightmare.
2. **Matter management + time recording.** What firms actually pay for, every month.
3. **Sri Lankan document automation.** Deeds, affidavits, plaints, MOUs. Pair with
   notary support given Notaries Ordinance protocol requirements — the notarial deed
   register is crying out for digitisation.
4. **Sinhala and Tamil legal NLP.** Genuinely underserved. A real moat.
5. **Pro bono / Legal Aid Commission module.** Cheap, builds BASL goodwill, opens
   donor and CSR funding.
6. **Corporate panel management.** Enterprise tier.
7. **CPD tracking**, **case law citator** over the existing RAG corpus.

---

## Parallel track — BASL engagement

Not a code task, but the highest-leverage thing on this list.

Approach BASL **now**, before scaling, and seek a formal view or an MOU. The biggest
regulatory risk is also the biggest potential moat: "the platform BASL endorses" is a
position no competitor can copy. Use the answers to seed
[open questions for counsel](./LEGAL-GUARDRAILS.md#open-questions-for-counsel).
