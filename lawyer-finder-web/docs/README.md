# Documentation

**New here, or been away? Read [THE-PROJECT.md](./THE-PROJECT.md) first.** It explains what
this is, how a matter flows, who can read what, and what state everything is in.

> ⚠️ The four planning documents at the **repository root**
> (`project_scope_and_vision.md`, `mvp_project_plan.md`, `developer_project_plan.md`,
> `architecture_manual.md`) describe the **pre-restructure marketplace** and are marked
> superseded. Do not build from them.

## Start here

| Document | What it answers |
| --- | --- |
| **[NEXT-SESSION-BRIEF.md](./NEXT-SESSION-BRIEF.md)** | **Starting a new chat? Copy §1.** Context + the current task |
| **[THE-PROJECT.md](./THE-PROJECT.md)** | What is this, how does it work, what is built? |
| **[DIRECTION.md](./DIRECTION.md)** | What do we do next, and in what order? |
| **[OPEN-ITEMS.md](./OPEN-ITEMS.md)** | What is still outstanding — everything, with a decision each |
| **[REVENUE-MODEL.md](./REVENUE-MODEL.md)** | How does this make money, and what should change? |
| **[PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md)** | What stands between us and a real firm using it? |

## The legal restructure (Phases 0–8, complete)

| Document | What it answers |
| --- | --- |
| [restructure/HOW-IT-WORKS.md](./restructure/HOW-IT-WORKS.md) | **Why** each rule exists, in plain language. The best document here — read it before writing feature code |
| [restructure/LEGAL-GUARDRAILS.md](./restructure/LEGAL-GUARDRAILS.md) | The hard constraints. Violating one blocks the merge |
| [restructure/PROGRESS.md](./restructure/PROGRESS.md) | What was done, when, and what it cost to learn |
| [restructure/DATA-INVENTORY.md](./restructure/DATA-INVENTORY.md) | Every piece of personal data, whose it is, how long it lives |
| [restructure/QUESTIONS-FOR-COUNSEL.md](./restructure/QUESTIONS-FOR-COUNSEL.md) | What a lawyer still has to answer |
| [restructure/COUNSEL-MEETING-BRIEF.md](./restructure/COUNSEL-MEETING-BRIEF.md) | The questions to put to an attorney, in plain language — **ready to send** |
| [restructure/SYSTEM-REVIEW.md](./restructure/SYSTEM-REVIEW.md) | A whole-codebase review: remove, restructure, add |
| [restructure/ROADMAP.md](./restructure/ROADMAP.md) | The original phase plan (historical) |

## Operations

| Document | What it answers |
| --- | --- |
| [database-migrations.md](./database-migrations.md) | How schema changes ship. **Migrations only, never `db push`** |
| [encryption-key-custody.md](./encryption-key-custody.md) | Where the matter-encryption key lives, and what happens if it is lost |
| [scheduled-jobs.md](./scheduled-jobs.md) | What must run on a timer, and what to alert on |

## The five checks

A green `npm run build` proves none of the seven rules hold. These do:

```bash
npm run check:privilege   # 41 — who may read a matter
npm run check:firm        # 15 — who may be in a practice
npm run check:ai          # 49 — what the assistant may say
npm run check:billing     # 21 — what may be metered, and fee notes
npm run check:pdpa        # 67 — retention, erasure, consent, the notice register
```
