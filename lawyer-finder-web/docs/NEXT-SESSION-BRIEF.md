# Next Session Brief

> Written 2026-09-13. **Copy §1 into a new chat as your first message.**
>
> Update this file at the end of every session. A brief that points at work already done is
> worse than no brief — the next session will trust it.

---

## 1. Prompt to start the new chat

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure.
Phases 0-8 are complete. On the AI service, RAG Stages 0, 1.1, 1.2 and 1.2c are
complete. I need you to pick up where the last session left off.

REPOSITORY LAYOUT
  law-finder/
    lawyer-finder-web/   Next.js 16 + Prisma 7 + Postgres — the main product
    lawyer-rag/          Python Flask + ChromaDB + Ollama — the AI assistant
    lawyer-portfolio/    an untouched Vite template, ignore it

READ THESE FIRST, IN THIS ORDER:
  1. lawyer-finder-web/docs/THE-PROJECT.md      what this is, in two pages
  2. lawyer-finder-web/docs/TOUR.md             the whole system feature by
                                                feature, and WHY each thing is
                                                built the way it is
  3. lawyer-finder-web/docs/OPEN-ITEMS.md       every outstanding item, with a
                                                decision on each
  4. lawyer-finder-web/docs/DIRECTION.md        what to do next and in what order
  5. lawyer-rag/docs/RAG-ROADMAP.md             the staged plan for the AI
  6. lawyer-rag/docs/RUNNING.md                 how to run the AI service —
                                                READ THIS BEFORE STARTING IT
  7. lawyer-rag/eval/results/STAGE-1.2.md       where answer quality stands

⚠️ IGNORE the four planning documents at the repository root
(project_scope_and_vision.md, mvp_project_plan.md, developer_project_plan.md,
architecture_manual.md). They describe the pre-restructure marketplace —
sponsored listings, commission on fees, reviews, lead generation — all of which
is unlawful in Sri Lanka and was removed. They are marked superseded. Building
from them rebuilds the illegal product.

GIT STATE
Branch restructure-booking-flow. Everything is committed and the tree is clean.
Two commits are NOT yet pushed (TOUR.md, and the multi-turn chat fix). Ask me
before any destructive git command, and before pushing.

HOW TO RUN IT
  # web app
  cd lawyer-finder-web && npm run dev          # http://localhost:3000
  # if it says "Another next dev server is already running":
  #   kill <PID>  &&  rm -f .next/dev/lock  &&  npm run dev

  # AI service, second terminal
  cd lawyer-rag && source venv/bin/activate
  ollama serve &
  gunicorn -c gunicorn.conf.py wsgi:app        # http://127.0.0.1:5001

  Seeded logins are password123 — citizen@thelawyr.lk, lawyer@thelawyr.lk,
  admin@thelawyr.lk.

YOUR TASK THIS SESSION

Stage 1.6 of lawyer-rag/docs/RAG-ROADMAP.md — settle the model, measured.

WHY THIS ONE. Retrieval and routing are fixed and the numbers moved a long
way. What is left is JUDGEMENT, and judgement is what a 3-billion-parameter
model is worst at. Two known problems are both the model thinking:

  - The ReAct agent rewrites the user's question into a WORSE one. A query
    scoring 0.747 became a paraphrase scoring 0.604 (RAG-REVIEW.md 4.15).
  - The intent router misclassifies real legal questions, including
    follow-ups (4.14, 4.16).

WHAT TO DO

  1. qwen3.5:9b is already pulled locally. Set LLM_MODEL=qwen3.5:9b in
     lawyer-rag/.env, restart the service, then:
       ./venv/bin/python -m scripts.eval --compare eval/results/stage-1.2b.json
     Watch LATENCY as well as quality — a 9B model on this hardware may
     blow the Next.js caller's 60s timeout. Both numbers are printed.
  2. Try at least one HOSTED model too. Stage 3 wants hosted inference
     anyway: local Ollama needs a GPU host and is a second thing to
     operate. The policy gate runs server-side and the browser never calls
     a model, so the provider is an implementation detail — answer quality
     is not.
  3. WHICHEVER WINS: name it in ONE place. config.py reads LLM_MODEL and
     app/core/llm.py builds the client. Do NOT put a model name in a
     README or a docstring — there were four different ones in five files.
  4. Save results as eval/results/<model>.json and write up the comparison
     the way eval/results/STAGE-1.2.md does.

DO NOT re-tune RETRIEVAL_MIN_SCORE for a new LLM. The thresholds
(0.62 / 0.50) are properties of the EMBEDDING model and the corpus, not the
chat model. Changing the embedding model or the chunker means re-running the
sweep, which is recorded in config.py. Changing the LLM does not.

AFTER THAT, in roadmap order: 1.3 (carry retrieval results through — removes
the duplicate searches 1.2 knowingly added), 1.4 (delete verify_answer_tool),
1.4b (the knowledge-graph delete bug, 4.11), 1.5 (derive the corpus list at
runtime, which also fixes 4.12 — two Acts are stored as "Act No. 24 of
2007/2025" and cost two evaluation answers outright).

TWO THINGS ONLY I CAN DO — please remind me if I have not:
  - Revoke the old LangSmith API key and the stale Groq key. Both are
    preserved commented out in lawyer-rag/.env marked REVOKE-ME. Tracing is
    off, but that stops NEW data leaving; it does not un-send what was
    already sent, and a key that still works can be turned back on.
  - Email a Sri Lankan Attorney-at-Law about counsel questions 16-18.
    lawyer-finder-web/docs/restructure/COUNSEL-MEETING-BRIEF.md is written
    and has been ready since Phase 6.

ONE DECISION I OWE YOU: OPEN-ITEMS.md E0b — should a signed-out guest be
able to hold a conversation with the assistant? Today they cannot.

WORKING STYLE — learned the hard way over nine phases and four RAG stages
  - Verify by RUNNING, not by reading. A green build has hidden an invalid
    SQL migration, a seed broken for two sessions, an AI citing an Act that
    does not exist, star ratings still being collected two phases after
    being reported removed, a firm-membership system that granted nothing
    across four layers, and a gunicorn setting that logged "Listening at"
    and then SIGSEGV'd every worker. Drive the actual app.
  - Reproduce a bug before you fix it. Stage 0 proved the path traversal,
    the error leak and the LAN bind against the running service first.
  - A test suite can be deep and narrow at once. The eval set was 76
    questions and ONE TURN WIDE, and a user found a broken follow-up that
    it could never have caught. When you fix a bug, ask what shape of test
    was missing — not just what value was wrong.
  - A guardrail pattern that LOOKS right can still miss. "you may be
    personally liable for the company's debts" reached a real user: the
    regex had no room for the adverb and required liable "to", not "for".
    When you widen one, add a case for the general form too — a check that
    refuses both sides of a line is as broken as one that answers both.
  - When a test passes, ask whether it describes a real actor.
    check:privilege passed for five phases because a fixture called a
    paralegal actorRole: 'LAWYER' — a person who cannot exist.
  - A failing check is not automatically a failing rule. Check for a stale
    Prisma client (npm run db:generate) or a stale .next (rm -rf .next).
  - After removing a feature, grep for its callers. After fixing one route,
    check its siblings. (The roadmap said "both upload paths". There were
    three.)
  - Never break a working flow to make a legal fix — replace before removing.
  - Schema changes ship as migrations: npm run db:migrate -- --name <name>.
    Never prisma db push. Test a migration against a database seeded with
    the data that would break it (scripts/tmp/mkdb.js makes a scratch DB).
  - lawyer-rag/data/ is TRACKED IN GIT and running the service dirties it.
    Check /api/documents total_chunks before assuming data loss, then
    git checkout -- lawyer-rag/data/. It is also the only backup that
    exists of the vector store.
  - Run all five checks after every change set, from lawyer-finder-web/:
      npm run check:privilege   (41)
      npm run check:firm        (15)
      npm run check:ai          (55)
      npm run check:billing     (21)
      npm run check:pdpa        (67)
    plus npm run build and npx tsc --noEmit. A green build proves none of
    the seven legal rules hold — that is what the checks are for.
  - For the AI service, from lawyer-rag/ with it running:
      ./venv/bin/python scripts/check_security.py                 (46)
      ./venv/bin/python -m scripts.eval --compare eval/results/stage-1.2b.json
  - npm run db:reset is destructive and has been declined before.
  - Update the docs at the end of the session: PROGRESS.md for the main
    product, RAG-REVIEW.md / RAG-ROADMAP.md for the AI service, TOUR.md if
    a feature changed, and docs/NEXT-SESSION-BRIEF.md so the next session
    knows where to start.

I am a software engineer, not a lawyer. Make the legal calls yourself and
explain the reasoning in plain words afterwards.
```

---

## 2. Where things actually stand

### Done, and committed

| | |
| --- | --- |
| **Phases 0–8** | The legal restructure of the main product |
| **RAG Stage 0** | Security and privacy on the AI service — 8 fixes, 46 assertions |
| **RAG Stage 1.1** | The golden evaluation set — 83 questions, first baseline |
| **RAG Stage 1.2** | Relevance floor + the router fix |
| **RAG Stage 1.2c** | Multi-turn chat, after a user found follow-ups broken |
| **docs/TOUR.md** | The whole system, feature by feature, and why |

### The AI numbers

| | baseline | now |
| --- | --- | --- |
| retrieval recall@k | 63.0% | **84.3%** |
| citation accuracy | 0.663 | **0.882** |
| grounding | 91.8% | **96.3%** |
| refusal correctness | 33.3% | **96.9%** |
| `not_in_corpus` | 12.5% | **100%** |

### Found and fixed along the way, worth remembering

- An **unauthenticated remote file write** on the AI service, reproduced before fixing.
- **Every legal question was being sent to LangSmith's US cloud.** Off now; **the key still
  needs revoking.**
- A **live rule 6 violation in the main product** — *"you may be personally liable for the
  company's debts"* was published to a user. Neither policy layer caught it.
- `DELETE /api/documents/<name>` **silently strips knowledge-graph entities from other
  Acts** (`RAG-REVIEW.md` §4.11). Unfixed; back up before calling it.

### The five things that have not moved in nine phases

1. **Nobody has asked counsel** about Q16–18 — whether the consumer directory may lawfully
   exist at all. Top of "next up" since Phase 2.
2. **Nobody has talked to a law firm.** Nine phases of reasoning, zero users.
3. **Never deployed.** No CI, no TLS, no backups, no monitoring.
4. **`MATTER_ENCRYPTION_KEYS` has no custody arrangement.** Losing it destroys every matter.
5. **Nothing runs on a timer.** `jobs:daily` exists; nothing calls it.

Items 1 and 2 cannot be done by writing code, which is exactly why they keep not happening.
