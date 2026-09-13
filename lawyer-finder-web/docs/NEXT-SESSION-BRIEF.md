# Next Session Brief

> Written 2026-09-13, after RAG Stage 0. Copy §1 into a new chat as your first message.
>
> Update this file at the end of each session so it always points at the next task.

---

## 1. Prompt to start the new chat

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure.
Phases 0-8 are complete. On the AI service, RAG Stage 0 (security and privacy)
and Stage 1.1 (the golden evaluation set) are complete. I need you to pick up
where the last session left off.

REPOSITORY LAYOUT
  law-finder/
    lawyer-finder-web/   Next.js 16 + Prisma 7 + Postgres — the main product
    lawyer-rag/          Python Flask + ChromaDB + Ollama — the AI assistant
    lawyer-portfolio/    an untouched Vite template, ignore it

READ THESE FIRST, IN THIS ORDER:
  1. lawyer-finder-web/docs/THE-PROJECT.md      what this is, how a matter flows,
                                                who may read what, what is built
  2. lawyer-finder-web/docs/OPEN-ITEMS.md       every outstanding item, with a
                                                decision on each
  3. lawyer-finder-web/docs/DIRECTION.md        what to do next and in what order
  4. lawyer-rag/docs/RAG-ROADMAP.md             the staged plan for the AI service
  5. lawyer-rag/docs/RUNNING.md                 how to run the AI service — read
                                                this before starting it, the
                                                service token trips everyone up
  6. lawyer-rag/eval/results/BASELINE.md        the first measurement of answer
                                                quality, and what it found
  7. lawyer-rag/eval/README.md                  how the evaluation set works

Read further only as needed:
  - lawyer-finder-web/docs/restructure/HOW-IT-WORKS.md   why each legal rule exists,
    in plain language. Read this before writing any feature code.
  - lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md   the hard constraints
  - lawyer-rag/docs/RAG-REVIEW.md   full review of the AI service. §2 and §3 are
    fixed; §4 (answer quality) is not, and §4.10 shows what that looks like live.
  - lawyer-finder-web/docs/PRODUCTION-READINESS.md, REVENUE-MODEL.md

⚠️ IGNORE the four planning documents at the repository root
(project_scope_and_vision.md, mvp_project_plan.md, developer_project_plan.md,
architecture_manual.md). They describe the pre-restructure marketplace —
sponsored listings, commission on fees, reviews, lead generation — all of which
is unlawful in Sri Lanka and was removed. They are marked superseded. Building
from them rebuilds the illegal product.

GIT STATE
Phases 0-8 and RAG Stage 0 are committed on branch restructure-booking-flow.
Nothing is pushed. Ask me before any destructive git command.

YOUR TASK THIS SESSION

Stage 1.2 of lawyer-rag/docs/RAG-ROADMAP.md — a relevance floor, and abstain.

WHY THIS ONE. Stage 1.1 built the golden evaluation set (76 questions,
`python -m scripts.eval`) and took the first baseline. Read
lawyer-rag/eval/results/BASELINE.md first — it is short. The headline:

  not_in_corpus   2/16  =  12.5%

Asked about legislation the corpus does NOT hold, the service answers
confidently 14 times out of 16. It described the powers of the Prevention
of Terrorism Act, said trademark registration follows the Companies Act,
and invented a five-year residence requirement for citizenship. None of
that law is in the corpus.

The cause is in RAG-REVIEW.md §4.4: search_documents returns the top k
regardless of score, so there is always "context", and the prompt hands
it to the model under a heading saying LEGAL CONTEXT FROM SRI LANKAN
LEGISLATION. The system cannot say "I do not have that" because nothing
ever tells it that it does not.

WHAT TO BUILD

  1. A relevance threshold in app/core/vectorstore.py, tuned AGAINST the
     evaluation set — not guessed. Raise it until not_in_corpus improves
     without answerable regressing. Both numbers are printed every run,
     which is the whole point of having built the set first.
  2. When nothing survives the floor, return a structured no-context
     result rather than an empty list, and let the pipeline say so
     plainly. Right now a caller has to infer a refusal from prose; the
     eval scorer has a list of phrase markers precisely because the
     service returns no structured outcome. Return one and delete those
     markers rather than tuning them.
  3. Re-run and compare every time:
       ./venv/bin/python -m scripts.eval --compare eval/results/baseline.json
     It prints better/WORSE per measure. Do not tune against one number:
     recall@k 63.0%, citation accuracy 0.663, grounding 91.8% and
     refusal correctness 33.3% all move together.

AND WHILE YOU ARE IN THERE — item 1.2b, which falls out of 1.2 for free.

13 of the 18 `answerable` failures never reached retrieval at all: the
router classified them `clarification_needed` and returned a canned
template with zero sources. Nine were Companies Act questions, which is
the whole reason that Act scores 5/16.

  "What does the Companies Act say about the duties of a director?"
    -> legal_query, 6 sources, correct answer

  "What standard of skill and care must a company director exercise?"
    -> clarification_needed, 0 sources, "tell me more about your
       specific situation"

Same question. Section 189 answers it in one sentence. Once you have a
relevance floor, clarify only when nothing clears it — searching first
makes this mostly disappear. Also rewrite the template: it currently
asks the person to describe their own situation and offers "my employer
fired me without notice" as the example, which routes them straight into
the situation_report path that the application then has to withhold. Offer
the GENERAL form of their question instead, the way policy.ts already
does. See RAG-REVIEW.md §4.14.

WATCH FOR: over-refusing. The set is built to catch it. cpc-009 to
cpc-013 ask about matrimonial and testamentary PROCEDURE, which the Civil
Procedure Code genuinely holds, and must still be answered. nic-001 and
nic-009 ask for the SUBSTANTIVE law underneath, which it does not hold,
and must be refused. A floor that refuses all seven is as broken as
today's system that answers all seven.

IF THERE IS TIME AFTERWARDS, Stage 1.6: re-run the set against a larger
model (qwen3.5:9b is already pulled locally) and compare. That comparison
was impossible last week and is one command now. A 3B model is unlikely
to survive it.

ALSO, NOT CODE, FIVE MINUTES: revoke the old LangSmith API key. It is
preserved commented out in lawyer-rag/.env marked REVOKE-ME. Tracing is
off, but that stops new data leaving — it does not un-send what was
already sent, and a key that still works is a key someone can turn back
on. There is a stale GROQ_API_KEY beside it; revoke that too.

WORKING STYLE — learned the hard way over nine phases and one RAG stage
  - Verify by RUNNING, not by reading. A green build has hidden an invalid SQL
    migration, a seed broken for two sessions, an AI citing an Act that does not
    exist, star ratings still being collected two phases after being reported
    removed, and a firm-membership system that granted nothing across four
    layers. In Stage 0 it hid a gunicorn setting that logged "Listening at ..."
    and then SIGSEGV'd every worker — an open port answering nothing. Drive it.
  - Reproduce a bug before you fix it. Stage 0 proved the path traversal, the
    error leak and the LAN bind against the running service first. A fix for a
    defect nobody demonstrated is a fix nobody can trust.
  - When a test passes, ask whether it describes a real actor. check:privilege
    passed for five phases because a fixture called a paralegal actorRole:
    'LAWYER' — a person who cannot exist.
  - A failing check is not automatically a failing rule. Check for a stale
    Prisma client (npm run db:generate) or a stale .next (rm -rf .next) first.
  - After removing a feature, grep for its callers. After fixing one route,
    check its siblings. (The roadmap said "both upload paths". There were three.)
  - If a user is confused by a screen, that is a bug in the screen.
  - Never break a working flow to make a legal fix — replace before removing.
  - Schema changes ship as migrations: npm run db:migrate -- --name <name>.
    Never prisma db push. Test a migration against a database seeded with the
    data that would break it.
  - Run all five checks after every change set, from lawyer-finder-web/:
      npm run check:privilege   (41)
      npm run check:firm        (15)
      npm run check:ai          (49)
      npm run check:billing     (21)
      npm run check:pdpa        (67)
    plus npm run build and npx tsc --noEmit. A green build proves none of the
    seven legal rules hold — that is what the checks are for.
  - For the AI service, from lawyer-rag/ with it running:
      ./venv/bin/python scripts/check_security.py       (46)
      ./venv/bin/python -m scripts.eval --compare eval/results/baseline.json
  - Write the answer key from the SOURCE, never from the retriever's output.
    Building the eval set caught two of my own labels being wrong: the Civil
    Procedure Code holds matrimonial and testamentary PROCEDURE, so "grounds
    for divorce" is subtler than "not in the corpus". Read the section first.
  - npm run db:reset is destructive and has been declined before. Use a scratch
    database instead (lawyer-finder-web/scripts/tmp/mkdb.js creates one).
  - Update the relevant docs at the end of the session: PROGRESS.md for the main
    product, RAG-REVIEW.md / RAG-ROADMAP.md for the AI service, and
    docs/NEXT-SESSION-BRIEF.md so the next session knows where to start.

I am a software engineer, not a lawyer. Make the legal calls yourself and
explain the reasoning in plain words afterwards.
```

---

## 2. Why this is the next task

Stage 1.1 replaced opinion with numbers. The worst of them is `not_in_corpus` at
**12.5%** — asked about law the corpus does not contain, the service answers anyway,
with citations, 14 times out of 16.

That is not a polish item. It is the system stating Sri Lankan law it does not have, to
people who cannot tell the difference, and it is the same mechanism that produced the
invented *"Employment (Amendment) Ordinance No. 14 of 2017"* in Phase 5. The application's
policy layer catches the subset that reads as advice — it refused the unfair-dismissal
question at both ends — but a plainly-worded question about the Prevention of Terrorism
Act is not advice-shaped, and nothing stops it.

The relevance floor is the direct fix, and it is now measurable rather than arguable.

**One caution carried forward from the baseline.** A wrong answer passed the grounding
check, and would have passed `policy.ts` too: asked for the grounds for divorce, the model
cited Civil Procedure Code s.597 — real, retrieved, and procedural, expressly deferring
the grounds to law the corpus does not hold. **Citation-matching is the ceiling of what
either layer can currently verify.** Claim-level faithfulness needs a judge model. Do not
read a green `grounding` number as "the answer is correct".

## 3. What comes after Stage 1.2

1. **Book the counsel meeting.** Questions 16–18 have been top of "Next up" since Phase 2
   — seven phases — and nobody has asked.
   [COUNSEL-MEETING-BRIEF.md](./restructure/COUNSEL-MEETING-BRIEF.md) is ready to send.
2. **Talk to ten Sri Lankan law firms.** Nine phases of reasoning, zero users.
3. **Stage 1.6 — settle the model**, measured against the baseline. Then 1.3 (the citation
   chain), 1.4 (delete `verify_answer_tool`), 1.4b (the knowledge-graph delete bug,
   RAG-REVIEW §4.11), 1.5 (derive the corpus list at runtime, which also fixes §4.12).
4. **Deploy the main product**, with backups and a *tested* restore, and move
   `MATTER_ENCRYPTION_KEYS` into a secrets manager. Back up `lawyer-rag/data/` at the same
   time — it is tracked in git today, which is luck rather than a backup.
5. **Load more legislation** (Stage 4.1). Land, Labour, Family, Penal Code. The baseline
   shows what the system does instead of admitting it lacks them.

Items 1 and 2 cannot be done by writing code, which is exactly why they keep not happening.

## 4. Keeping this file honest

At the end of each session, update §1's **YOUR TASK** block and §3. A brief that points at
work already done is worse than no brief — the next session will trust it.
