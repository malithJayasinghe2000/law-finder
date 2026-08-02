# Phase 2 Brief — Law Firm Entity

> **Starting a new chat?** Paste the prompt in [§1](#1-prompt-to-start-the-new-chat),
> then read this whole file plus the four documents it points to before writing code.

---

## 1. Prompt to start the new chat

Copy everything in the block below as your first message:

```
I'm continuing a legal restructure of lawyer-finder-web, a Sri Lankan legal
platform. Phases 0 and 1 are complete and committed; we're starting Phase 2.

Before writing any code, read these in order:
  1. lawyer-finder-web/docs/restructure/README.md
  2. lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md
  3. lawyer-finder-web/docs/restructure/PROGRESS.md
  4. lawyer-finder-web/docs/restructure/PHASE-2-BRIEF.md
  5. lawyer-finder-web/docs/database-migrations.md

Then confirm back to me, in your own words:
  - what the platform is being repositioned from and to, and why
  - the seven hard rules, and which ones Phase 2 could break
  - what Phase 2 has to deliver

Do not start coding until you've done that and I've agreed.

Working style, learned from phases 0 and 1:
  - Verify by running things, not by reading them. A previous session generated
    an invalid SQL migration that looked fine and reported success — it was only
    caught by deploying to a scratch database.
  - After removing a feature, grep for its callers. Twice we shipped dead handlers
    that pointed at deleted endpoints.
  - Status strings in .tsx files compile fine while being silently wrong. Sweep
    for them after any state-machine change.
  - If a user is confused by a screen, that's a bug in the screen, not the user.
  - Run `npm run build` and `npx tsc --noEmit` after every change set.
  - Schema changes ship as migrations: `npm run db:migrate -- --name <name>`.
    Never `prisma db push`.
  - Update docs/restructure/PROGRESS.md at the end of the session.
```

---

## 2. Where the project stands

**Positioning.** Repositioned from a legal-services *marketplace* (which it cannot
legally be in Sri Lanka — an attorney may not share fees with a non-lawyer, may not
advertise or solicit, and client money must sit in the attorney's own client
account) into **software that law firms run on**.

**Complete:**

| Phase | Delivered |
| --- | --- |
| 0 | Removed commission, escrow/withdrawals, PayHere. Privilege gate on matter data. Disclaimers + neutral ranking. Fixed a login 500, phantom refunds, a `bookingNumber` race |
| 1a | Engagement state machine (`REQUESTED → CONFLICT_CHECK → QUOTED → ACCEPTED → SCHEDULED → COMPLETED`), `ConflictCheck` and `Quote` models, centralised transitions |
| 1b | `EngagementLetter` generation, conflict-check and quote-composer UI, client quote review, PDF export |
| — | Prisma migrations baselined; `docs/database-migrations.md` written |
| — | Post-test hardening: payment review step, completion guard, lawyer refunds page, refund evidence + client confirmation |

**Not started:** Phase 2 (this brief), 3 (billing), 4 (advertising split), 5 (AI
compliance), 6 (PDPA), 7 (growth).

---

## 3. What Phase 2 delivers

**Why it matters.** This is the structural change the whole restructure depends on.
Everything so far assumes an individual `LawyerProfile`. The target model is that a
**firm** is the service provider — that is what makes the platform software rather
than a marketplace, and it is what "the law firm part" referred to.

### Scope

1. **`LawFirm` model** — registration details, practice areas, offices, client
   account details, verification status.
2. **`FirmMember`** with roles: `FIRM_OWNER`, `FIRM_ADMIN`, `ATTORNEY`, `PARALEGAL`.
3. **Migrate every existing `LawyerProfile` to a firm-of-one.** No data loss. This
   is why Phase 1 was designed firm-first — `Quote.issuedById` and
   `ConflictCheck.checkedById` are already `User` ids, not profile ids.
4. **Firm-level intake routing** — a request lands in the firm's queue; a firm admin
   assigns it to an attorney. Today it goes straight to one lawyer.
5. **Firm profile pages** and firm-level verification.
6. **RBAC** extending the existing subscription permission system.

### Explicitly out of scope

- Billing changes (Phase 3) — do not touch subscription pricing
- Advertising (Phase 4)
- Anything that reintroduces a fee percentage, escrow, or paid ranking

---

## 4. Design decisions already made

**Evolve, don't duplicate.** In Phase 1 the roadmap called for a new
`EngagementRequest` table alongside `Booking`. That was rejected: `Booking` already
*was* an engagement request, and a parallel table meant dual code paths through
every dashboard, email and admin screen. `Booking` was evolved in place instead.

**Apply the same reasoning here.** Do not create a parallel `FirmProfile` beside
`LawyerProfile`. `LawFirm` is a genuinely new concept (one firm, many attorneys), so
it is a new table — but `LawyerProfile` should gain a `firmId` and keep working,
not be replaced.

**Solo lawyer = firm of one.** Every migration path must preserve this. A solo
practitioner should not have to think about "firms" at all.

---

## 5. Traps specific to Phase 2

| Trap | Why it bites |
| --- | --- |
| **Booking ownership** | `Booking.lawyerId` points at `LawyerProfile`. Requests will now arrive for a *firm* and be assigned to an attorney. Decide early whether `Booking` gains a `firmId` alongside `lawyerId`, and keep both consistent |
| **Privilege scope widens** | Today only the owning attorney reads the conflict check. With firms, *which* members can? A paralegal? Another attorney? This is [counsel question 8(b)](./QUESTIONS-FOR-COUNSEL.md) — do not guess |
| **Availability** | Attached to `LawyerProfile`. A firm has many calendars. Do not collapse them |
| **Verification** | `LawyerProfile.isVerified` is per-attorney (BASL number). Firm verification is a different thing. Keep both |
| **Directory neutrality** | Firms in the directory must not become a way to buy prominence. Guardrail rule 3 still applies |
| **The engagement letter** | Snapshots `firmName` and `firmBaslNumber` from `LawyerProfile`. Once firms exist, decide which entity is named — and remember existing letters must keep rendering |

---

## 6. Known issues to fix along the way

Carried forward from Phase 1. None block Phase 2, but they are cheap to fix while
in the same files:

- **`NO_SHOW` has no UI trigger.** The server guard exists; no button calls it
- **`IN_PROGRESS` is unreachable.** Nothing transitions into it. Either wire it up
  or remove it from the enum
- **`LawyerProfile.baseFeeRange`** is still published publicly via `GET /api/lawyers`
  and `ads/serve`. Flagged as doubtful in
  [counsel question 2(d)](./QUESTIONS-FOR-COUNSEL.md); we lean toward deleting it
- **The `Review` model** still exists with star ratings. The endpoint is live even
  though the UI was removed. [Counsel question 2(e)](./QUESTIONS-FOR-COUNSEL.md);
  we lean toward deleting it
- **`ConsultationPricing`** still stores `physicalPrice`/`onlinePrice`, now always
  written as 0. Drop the columns in Phase 3 once nothing reads them

---

## 7. How to verify Phase 2

Do not report it complete on a green build alone. Phase 1 built and typechecked
clean while shipping dead handlers and unreachable states.

- [ ] `npm run build` and `npx tsc --noEmit` clean
- [ ] `npm run db:status` reports in sync; migration committed
- [ ] An existing solo lawyer still works end to end with no visible change
- [ ] A multi-member firm can receive a request, assign it, quote, and complete it
- [ ] Guardrail sweep: no commission, no escrow, no paid ranking, no privilege leak
- [ ] Grep for callers of anything removed
- [ ] Status strings swept after any state-machine change
- [ ] `PROGRESS.md` updated

---

## 8. Where things live

```
docs/restructure/
  README.md                 entry point, positioning, ground rules
  LEGAL-GUARDRAILS.md       the seven hard rules + revenue model
  ROADMAP.md                all phases
  PROGRESS.md               live status — update every session
  QUESTIONS-FOR-COUNSEL.md  15 questions awaiting a lawyer's answers
  PHASE-2-BRIEF.md          this file
docs/database-migrations.md migration workflow and failure modes

src/lib/consultations/
  bookingStatus.ts          state machine — single source of truth
  engagementLetter.ts       letter rendering
  expireQuotes.ts           lazy quote expiry sweep

src/app/api/consultations/bookings/[id]/
  route.ts                  lifecycle actions
  conflict-check/route.ts   firm-internal screening
  quotes/route.ts           issue / accept / decline
  engagement-letter/route.ts
  payment/route.ts          client payment notification only
```
