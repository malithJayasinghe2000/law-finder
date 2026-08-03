# Phase 5 Brief — AI Compliance

> **Starting a new chat?** Paste the prompt in [§1](#1-prompt-to-start-the-new-chat),
> then read this whole file plus the documents it points to before writing code.

---

## 1. Prompt to start the new chat

Copy everything in the block below as your first message:

```
I'm continuing a legal restructure of lawyer-finder-web, a Sri Lankan legal
platform. Phases 0, 1, 2, 2.5 and 4 are complete and committed. We're starting
Phase 5 — AI compliance.

Before writing any code, read these in order:
  1. lawyer-finder-web/docs/restructure/HOW-IT-WORKS.md
  2. lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md
  3. lawyer-finder-web/docs/restructure/PROGRESS.md
  4. lawyer-finder-web/docs/restructure/PHASE-5-BRIEF.md
  5. lawyer-finder-web/docs/database-migrations.md

Then confirm back to me, in your own words:
  - what the platform is being repositioned from and to, and why
  - what rule 6 requires, and why BASL's June 2021 note makes AI the
    highest-risk surface left
  - what Phase 5 has to deliver, and what it must not touch

Do not start coding until you've done that and I've agreed.

Working style, learned from the earlier phases:
  - Verify by running things, not by reading them. A green `npm run build`
    has repeatedly hidden real breakage — an invalid SQL migration, a seed
    that had been broken for two sessions, a comparison against a column
    that no longer existed but compiled because the row was cast to `any`.
  - After removing a feature, grep for its callers. We shipped dead handlers
    pointing at deleted endpoints more than once.
  - Status strings and placement enums in .tsx files compile fine while being
    silently wrong. Sweep for them after any enum or state-machine change.
  - Test migrations against a database seeded with the data that would break
    them, not just an empty one.
  - If a user is confused by a screen, that's a bug in the screen, not the user.
  - Run `npm run build`, `npx tsc --noEmit` and `npm run check:privilege`
    after every change set.
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
that law firms run on**. The firm is the provider of legal services; we are the
software it runs on and we earn a flat licence fee that has nothing to do with how
much law is practised.

| Phase | Delivered |
| --- | --- |
| 0 | Commission, escrow, PayHere removed. Privilege gate on matter data. Disclaimers |
| 1 | Engagement state machine, conflict check, quotes, engagement letters |
| 2 | `LawFirm` / `FirmMember` / `FirmOffice`; every attorney is a firm of one; firm intake routing; the Rule 40 content limit; `Review` model deleted |
| 2.5 | Stopped pricing on client volume (tiers sold enquiries and messages); firm-first intake — a client engages a firm, with no attorney and no appointment until the firm assigns and quotes |
| 4 | Advertising split — non-legal advertisers only, `PaidPromo` deleted, directory placements removed from the enum, adverts labelled and outbound |

**Not started:** Phase 5 (this brief), 3 remainder (firm seats, fee notes),
6 (PDPA), 7 (growth).

---

## 3. What Phase 5 delivers

### Why it matters, and why it is the sharpest thing left

Rule 6 says we never present the platform as giving legal advice. Two instruments
make this the highest-risk remaining surface:

- **BASL's cautionary note of June 2021** treats providing legal advice through an
  online platform as **touting** — which loops straight into the Intermeddlers with
  Suitors Ordinance No. 11 of 1894 and its criminal exposure for the intermediary.
- Unauthorised practice: giving legal advice without being an admitted
  Attorney-at-Law.

And a plainer reason: a person who acts on a chatbot's answer about their own case
can lose their house.

### Scope

1. **A not-legal-advice notice on every AI surface**, visible without scrolling or
   hovering — not a footer, not a tooltip. Audit every surface, not just the chat.
2. **Mandatory source citation.** An answer without a citable source is refused
   rather than generated. This is the hard one, and it is the point of the phase.
3. **Refusal behaviour.** The AI must decline to advise on the user's own matter —
   "what should I do", "will I win", "should I sign this" — and say plainly that it
   cannot, and why. Answering *about the law* is fine; answering *about your case*
   is not.
4. **Neutral suggestion, or none at all.** `suggest-lawyers` was made alphabetical
   and tier-blind in Phase 0. Re-audit it against counsel question 6 — whether the
   AI may suggest *categories* of practitioner at all — and against the firm-first
   model, since it still returns individuals rather than practices.
5. **A hard confidentiality boundary.** Matter data must never enter a shared model
   context. Check what actually reaches the model today, including anything derived
   from `Booking.description`.
6. **Logging and retention** for AI conversations, aligned with what Phase 6 will
   need for PDPA.

### Explicitly out of scope

- Billing (Phase 3 remainder)
- PDPA machinery (Phase 6)
- Matter-scoped AI as a paid firm feature — that is a Phase 7 growth item, and it
  cannot be built before the confidentiality boundary in item 5 exists

---

## 4. Design decisions already made

**One policy file per rule.** `src/lib/firms/access.ts` decides privilege;
`src/lib/ads/eligibility.ts` decides advertising. Phase 5 should add one for AI —
what may be answered, what must be refused, what must be cited. Do not scatter the
rule through route handlers.

**Assert the rule, don't promise it.** `npm run check:privilege` exists because a
green build says nothing about whether a paralegal can read a client's problem. The
AI rules deserve the same: a runnable check that a refusal prompt is actually
refused and an uncited answer is actually withheld.

**Conservative defaults, questions to counsel.** Where the answer is genuinely
unclear — question 6 on category suggestions is the live one — pick the
conservative option, ship it, and record the question.

---

## 5. Traps specific to Phase 5

| Trap | Why it bites |
| --- | --- |
| **The disclaimer exists but nobody reads it** | A notice under a fold is a notice that was not given. Placement is the compliance measure, not presence |
| **Citations that do not resolve** | A citation to a document the user cannot open is worse than none — it manufactures false authority |
| **"Informational" answers that are advice in substance** | "Generally, a tenant in this position may claim X" *is* advice when the user just described being that tenant. The test is whether the answer is about the law or about them |
| **Matter data reaching the model** | Check the whole path, not just the obvious prompt. Anything derived from `Booking.description` is privileged |
| **`suggest-lawyers` still returns individuals** | Since Phase 2.5 the client engages a *firm*. Returning attorneys reintroduces the shape the restructure removed |
| **Streaming responses bypass the citation check** | If sources are validated after generation, a streamed answer has already been read |

---

## 6. Known issues carried forward

- **Counsel questions 16–18 gate everything.** Whether a consumer attorney
  directory may lawfully exist at all is unanswered. Phase 5 does not depend on the
  answer, but the AI's lawyer-suggestion feature does
- **Counsel question 6** — may the AI suggest *categories* of practitioner
- Advertiser billing has no module; invoicing is outside the platform
- `ConsultationPricing.physicalPrice` / `onlinePrice` still exist, always 0
- Subscriptions are still per-attorney, not per-firm seats

---

## 7. How to verify Phase 5

Do not report it complete on a green build. Phase 2 built and typechecked clean
while still serving attorney adverts beside the AI chat; Phase 2.5 shipped with a
seed that had been broken since Phase 2.

- [ ] `npm run build` and `npx tsc --noEmit` clean
- [ ] `npm run check:privilege` passes
- [ ] `npm run db:status` in sync; migration committed
- [ ] A new runnable check asserting AI refusal and citation behaviour
- [ ] Every AI surface enumerated and confirmed to carry a visible notice
- [ ] Traced what actually reaches the model — no matter data
- [ ] `db:reset` works end to end on a clean database
- [ ] Grep for callers of anything removed
- [ ] Guardrail sweep across all seven rules
- [ ] `PROGRESS.md` updated

---

## 8. Where things live

```
docs/restructure/
  HOW-IT-WORKS.md           plain-language explainer — start here
  LEGAL-GUARDRAILS.md       the seven rules, Rule 40 limit, advertising rules
  PROGRESS.md               live status — update every session
  ROADMAP.md                all phases
  QUESTIONS-FOR-COUNSEL.md  18 questions; 16–18 are existential
  PHASE-5-BRIEF.md          this file
docs/database-migrations.md migration workflow and failure modes

src/lib/firms/access.ts     who may read a matter — the privilege policy
src/lib/ads/eligibility.ts  who may advertise and where
scripts/check-privilege-policy.ts   runnable assertion of the privilege rules

src/app/api/ai-chat/
  conversations/**          chat threads and messages
  suggest-lawyers/route.ts  neutral attorney suggestion — re-audit in Phase 5
src/components/shared/LegalDisclaimer.tsx   ai / library / directory variants
```
