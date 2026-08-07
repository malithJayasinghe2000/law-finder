# Phase 6 Brief — PDPA Compliance

> **Starting a new chat?** Paste the prompt in [§1](#1-prompt-to-start-the-new-chat),
> then read this whole file plus the documents it points to before writing code.

---

## 1. Prompt to start the new chat

Copy everything in the block below as your first message:

```
I'm continuing a legal restructure of lawyer-finder-web, a Sri Lankan legal
platform. Phases 0, 1, 2, 2.5, 3, 4 and 5 are complete and committed. We're
starting Phase 6 — PDPA compliance.

Before writing any code, read these in order:
  1. lawyer-finder-web/docs/restructure/HOW-IT-WORKS.md
  2. lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md
  3. lawyer-finder-web/docs/restructure/PROGRESS.md
  4. lawyer-finder-web/docs/restructure/PHASE-6-BRIEF.md
  5. lawyer-finder-web/docs/database-migrations.md

Then confirm back to me, in your own words:
  - what personal data this platform actually holds, and which of it is
    privileged rather than merely sensitive
  - what the PDPA requires of us as a processor for firms, and where our
    obligations differ from the firms' own
  - what Phase 6 has to deliver, and what it must not touch

Do not start coding until you've done that and I've agreed.

Working style, learned from the earlier phases:
  - Verify by running things, not by reading them. A green `npm run build`
    has repeatedly hidden real breakage — an invalid SQL migration, a seed
    broken for two sessions, a comparison against a deleted column that
    compiled because the row was cast to `any`, and an AI answer citing an
    Act that does not exist.
  - After removing a feature, grep for its callers. We have shipped dead
    handlers pointing at deleted endpoints more than once.
  - Status strings and enums in .tsx files compile fine while being silently
    wrong. Sweep for them after any enum or state-machine change.
  - Test migrations against a database seeded with the data that would break
    them, not just an empty one.
  - Run the seed on a clean database. It has caught a real break in three
    consecutive phases.
  - If a user is confused by a screen, that's a bug in the screen, not the user.
  - Run `npm run build`, `npx tsc --noEmit`, `npm run check:privilege`,
    `npm run check:ai` and `npm run check:billing` after every change set.
  - Schema changes ship as migrations: `npm run db:migrate -- --name <name>`.
    Never `prisma db push`.
  - Update docs/restructure/PROGRESS.md at the end of the session.

I'm a software engineer, not a lawyer. Make the legal calls yourself, pick the
conservative defensible option, and explain the reasoning in plain language
afterwards. Put anything genuinely unresolvable into QUESTIONS-FOR-COUNSEL.md
rather than blocking on it.
```

---

## 2. Where the project stands

**Positioning.** Repositioned from a legal-services *marketplace* into **software
that law firms run on**. The firm provides the legal service; we are the software
it runs on and we earn a flat licence fee that has nothing to do with how much law
is practised.

| Phase | Delivered |
| --- | --- |
| 0 | Commission, escrow, PayHere removed. Privilege gate on matter data. Disclaimers |
| 1 | Engagement state machine, conflict check, quotes, engagement letters |
| 2 | `LawFirm` / `FirmMember` / `FirmOffice`; the Rule 40 content limit; `Review` deleted |
| 2.5 | Stopped pricing on client volume; firm-first intake |
| 3 | Subscription moved to `LawFirm`; seats; `FeeNote` module; price columns dropped |
| 4 | Advertising split — non-legal advertisers only |
| 5 | AI compliance — server-side policy, mandatory citations, refusals, retention |

**Not started:** Phase 6 (this brief), 7 (growth).

**The three runnable checks** you must keep green — they exist because a green
build proves none of what they assert:

```
npm run check:privilege   10 cases   who may read a client's legal problem
npm run check:ai          49 cases   what the AI may say and must refuse
npm run check:billing     17 cases   fee notes and seats (needs a seeded db)
```

---

## 3. What Phase 6 delivers

### Why it matters

The **Personal Data Protection Act No. 9 of 2022** is Sri Lanka's first general
data-protection statute, with a Data Protection Authority established and
obligations phasing in. It matters here for a reason beyond the usual:

**Most of what we hold is not merely sensitive — a large part of it is
privileged.** A client's account of their legal problem is protected under
Evidence Ordinance s.126, and privilege can be *lost* if a third party is in the
conversation. So our PDPA work has an unusual property: getting retention or
access wrong does not only breach a statute, it can damage a client's position in
their own case.

The other structural point: for matter data we are a **processor** acting for the
firm, which is the **controller**. Those roles carry different duties and the
split has never been written down or contracted. Counsel question 4 asks whether a
processor agreement adequately preserves privilege where we host matter data — it
is unanswered, and Phase 6 is where it starts to bite.

### Scope

1. **A data inventory that is actually true.** Every model holding personal data,
   what it is for, its lawful basis, who can reach it, and how long it lives.
   Start from: `User`, `Booking` (+ `ConflictCheck`, `Quote`, `EngagementLetter`,
   `BookingPayment`), `Conversation`/`Message`, `AiConversation`/`AiMessage`,
   `FeeNote`, `LawyerProfile`, `Advertiser`. Write it down as a document, not a
   comment.
2. **Consent capture with purpose specification** — what we collect, why, and a
   record of the person agreeing. Distinguish consent from the other lawful bases;
   most matter data is contract/legitimate interest, not consent, and calling
   everything consent is a common and expensive error.
3. **Retention schedule + automated deletion**, extending the pattern already set
   by `AI_CONVERSATION_RETENTION_DAYS` and `npm run ai:purge`. Note the tension to
   resolve: conflict-check records may need *long* retention for professional
   reasons while chat logs need short retention.
4. **DSAR endpoints** — access, rectification, erasure, portability. The hard part
   is not the endpoints; it is deciding what a client may erase when the firm has
   a professional duty to keep it, and what the firm may see of a request.
5. **Access audit log across matter data** — who read what, when. `firms/access.ts`
   already decides *whether*; nothing records *that it happened*.
6. **Encryption at rest** for matter descriptions and messages.
7. **Data-processor agreement template** for firms, and DPO designation.

### Explicitly out of scope

- Anything that changes who may *read* matter data — `firms/access.ts` and its
  10 assertions are settled; Phase 6 records access, it does not widen it
- Growth features (Phase 7)
- Matter-scoped AI — still blocked on the confidentiality boundary and counsel
  question 4

---

## 4. Design decisions already made

**One policy file per rule.** `firms/access.ts` decides privilege,
`ads/eligibility.ts` decides advertising, `ai/policy.ts` decides AI output,
`firms/billing.ts` decides licensing. Phase 6 should add one for retention and
subject rights. Do not scatter the rule through route handlers.

**Assert the rule, don't promise it.** Add `npm run check:pdpa` in the same shape
as the other three: a runnable assertion that an expired record is actually
deleted, that an erasure request actually erases, and that an audit entry is
actually written.

**Conservative defaults, questions to counsel.** Where the answer is unclear, pick
the restrictive option, ship it, and record the question. Phase 5 did this with
counsel question 6 and it cost nothing.

---

## 5. Traps specific to Phase 6

| Trap | Why it bites |
| --- | --- |
| **Treating everything as consent-based** | Matter data is processed to perform a contract and to meet professional duties. Asking for consent implies it can be withdrawn, and then you must honour that |
| **Erasure that breaks a firm's professional duty** | An attorney may be required to retain conflict-check and engagement records. "Delete everything about me" cannot be honoured naively |
| **The audit log becoming a second privileged store** | A log of *who read a matter description* is fine. A log that copies the description into itself is a new place privilege leaks |
| **Encryption that breaks the privilege check** | If matter fields become ciphertext, `check:privilege` must still prove a paralegal cannot read them — verify the check still asserts something real |
| **Deleting a `User` and orphaning matters** | Matters reference firms and attorneys for years. Soft-delete is the existing convention; do not introduce hard deletes |
| **Fee notes are tax documents** | They contain personal data *and* a statutory retention need. They cannot simply expire on the AI schedule |
| **DSAR exposing one client's data to another** | A conflict-check record names *other* parties. An access request must not become a disclosure route |

---

## 6. Known issues carried forward

- **Counsel questions 16–18 gate everything.** Whether a consumer attorney
  directory may lawfully exist at all is unanswered
- **Counsel question 4** — does a processor agreement preserve privilege where we
  host matter data? Directly in Phase 6's path
- **Counsel question 10** — VAT/SSCL treatment, now load-bearing because fee notes
  compute VAT at a rate the firm sets
- Three Acts are in the vector store with no `LegalDocument` row, so their AI
  citations render as text rather than links. A data task: upload the PDFs
- The AI refusal patterns are **English-only**; `si` and `ta` locales bypass the
  pre-generation check entirely
- Advertiser billing has no module; invoicing happens outside the platform

---

## 7. How to verify Phase 6

Do not report it complete on a green build. Phase 2 built and typechecked clean
while still serving attorney adverts beside the AI chat; Phase 5's AI policy
passed 43 assertions while publishing a hallucinated Act; Phase 3's seed was
broken on a clean database.

- [ ] `npm run build` and `npx tsc --noEmit` clean
- [ ] `check:privilege`, `check:ai`, `check:billing` all still pass
- [ ] A new runnable check asserting retention, erasure and audit behaviour
- [ ] `npm run db:status` in sync; migrations committed
- [ ] Migration tested against a database seeded with data that would break it
- [ ] Seed runs end to end on a clean database
- [ ] Grep for callers of anything removed
- [ ] Guardrail sweep across all seven rules
- [ ] The data inventory is complete — every model checked, not just the obvious ones
- [ ] `PROGRESS.md` updated

---

## 8. Where things live

```
docs/restructure/
  HOW-IT-WORKS.md           plain-language explainer — Part 7 covers enforcement
  LEGAL-GUARDRAILS.md       the seven rules, Rule 40 limit, advertising, AI, seats
  PROGRESS.md               live status — update every session
  ROADMAP.md                all phases
  QUESTIONS-FOR-COUNSEL.md  open questions; 16-18 are existential
  PHASE-6-BRIEF.md          this file

src/lib/firms/access.ts            who may read a matter — the privilege policy
src/lib/firms/billing.ts           what a firm is licensed for
src/lib/ai/policy.ts               what the AI may say
src/lib/ads/eligibility.ts         who may advertise and where
src/lib/consultations/feeNote.ts   the firm's invoice to its own client

scripts/check-privilege-policy.ts  privilege assertions
scripts/check-ai-policy.ts         AI assertions
scripts/check-billing-policy.ts    billing assertions
scripts/purge-ai-conversations.ts  the retention pattern to extend
```
