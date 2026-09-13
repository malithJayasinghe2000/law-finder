# Next Session Brief

> Written 2026-09-13, after RAG Stage 0. Copy §1 into a new chat as your first message.
>
> Update this file at the end of each session so it always points at the next task.

---

## 1. Prompt to start the new chat

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure.
Phases 0-8 are complete. On the AI service, RAG Stage 0 (security and privacy),
Stage 1.1 (the golden evaluation set) and Stage 1.2 (the relevance floor and the
router) are complete. I need you to pick up where the last session left off.

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
  6. lawyer-rag/eval/results/STAGE-1.2.md       where answer quality stands now,
                                                and the guardrail gap it found
  7. lawyer-rag/eval/results/BASELINE.md        where it started
  8. lawyer-rag/eval/README.md                  how the evaluation set works

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

Stage 1.6 of lawyer-rag/docs/RAG-ROADMAP.md — settle the model, measured.

WHY NOW. Stage 1.2 fixed retrieval and routing, and the numbers moved a
long way (read lawyer-rag/eval/results/STAGE-1.2.md, it is short):

                      baseline    now
  retrieval recall@k    63.0%    84.8%
  citation accuracy     0.663    0.891
  refusal correctness   33.3%    96.7%
  not_in_corpus         12.5%   100.0%

What is left is judgement, and judgement is where a 3-billion-parameter
model fails. Both remaining problem areas are the model thinking, not the
retrieval:

  - The ReAct agent rewrites the user's question into a worse one. A
    question scoring 0.747 became a paraphrase scoring 0.604 (§4.15).
  - The intent router still misclassifies some questions.

WHAT TO DO

  1. `ollama pull qwen3.5:9b` is already done — it is on the machine.
     Set LLM_MODEL=qwen3.5:9b in lawyer-rag/.env, restart, and run:
       ./venv/bin/python -m scripts.eval --compare eval/results/stage-1.2.json
     Watch latency as well as quality: a 9B model on this hardware may be
     too slow for the Next.js caller's 60s timeout. Both numbers are
     printed.
  2. Try at least one hosted model too (Stage 3 wants hosted inference
     anyway — local Ollama needs a GPU host and is a second thing to
     operate). The policy gate runs server-side and the browser never
     calls a model, so the provider is an implementation detail — but
     answer quality is not.
  3. WHICHEVER WINS: name it in ONE place. config.py reads LLM_MODEL and
     app/core/llm.py builds the client; do not add a model name to a
     README or a docstring. There were four different ones in five files.
  4. Record the numbers as eval/results/<model>.json and write up the
     comparison the way STAGE-1.2.md does.

DO NOT re-tune RETRIEVAL_MIN_SCORE for a new model without re-running the
sweep. The thresholds (0.62 / 0.50) are properties of THIS embedding
model and THIS corpus. Changing the LLM does not move them; changing the
embedding model or the chunker does. The sweep is recorded in config.py.

AFTER THAT, in roadmap order: 1.3 (carry retrieval results through —
removes the duplicate searches Stage 1.2 knowingly added), 1.4 (delete
verify_answer_tool), 1.4b (the knowledge-graph delete bug, §4.11), 1.5
(derive the corpus list at runtime, which also fixes §4.12 — two Acts are
stored as "Act No. 24 of 2007/2025" and cost two answers outright).

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
      npm run check:ai          (52)
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
  - A guardrail pattern that LOOKS right can still miss. Stage 1.2 found
    "you may be personally liable for the company's debts" reaching a real
    user: the regex meant to catch it had no room for the adverb and required
    liable "to", not "for". Reading it, you would have said it was covered.
    When you widen one of these, add a case for the general form too — a
    check that refuses both sides of the line is as broken as one that
    answers both.
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

Stage 1.2 took the fixable retrieval and routing problems off the table. What remains is
**judgement**, and judgement is what a 3-billion-parameter model is worst at. The agent
rewrites a good question into a bad one (§4.15); the router still misreads some questions.
Both are the model thinking, not the pipeline around it.

That has been the known weak link since the review — *"nobody can say which model answers
a legal question, and the one actually running is a 3B"* — and until 2026-09-13 it could
not be acted on, because there was no way to tell whether a swap helped. Now there is, and
it is one command.

**A caution carried forward.** Stage 1.2 found a live rule 6 violation in the main product:
*"you may be personally liable for the company's debts"* was **published to a user**,
because the advice pattern had no room for an adverb and required liable *to* rather than
*for*. Neither policy layer caught it. It is fixed and asserted, but the lesson generalises
— **`check:ai` passing does not mean the rule holds; it means the cases someone thought of
hold.** The evaluation set found this one precisely because it drives real questions
through the real gate rather than fixtures.

## 3. What comes after Stage 1.6

1. **Book the counsel meeting.** Questions 16–18 have been top of "Next up" since Phase 2
   — seven phases — and nobody has asked.
   [COUNSEL-MEETING-BRIEF.md](./restructure/COUNSEL-MEETING-BRIEF.md) is ready to send.
2. **Talk to ten Sri Lankan law firms.** Nine phases of reasoning, zero users.
3. **RAG 1.3 → 1.5**, in that order, all measured against `stage-1.2.json`.
4. **Deploy the main product**, with backups and a *tested* restore, and move
   `MATTER_ENCRYPTION_KEYS` into a secrets manager. Back up `lawyer-rag/data/` at the same
   time — it is tracked in git today, which is luck rather than a backup.
5. **Load more legislation** (Stage 4.1). Land, Labour, Family, Penal Code. The assistant
   now says honestly that it does not hold them, which is correct and is also a product a
   lawyer stops opening.

Items 1 and 2 cannot be done by writing code, which is exactly why they keep not happening.

## 4. Keeping this file honest

At the end of each session, update §1's **YOUR TASK** block and §3. A brief that points at
work already done is worse than no brief — the next session will trust it.
