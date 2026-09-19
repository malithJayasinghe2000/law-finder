# Next Session Brief

> Updated 2026-09-20. **Copy §1 into a new chat as your first message.**
>
> Update this file at the end of every session. A brief that points at work already done is
> worse than no brief — the next session will trust it.

---

## 1. Prompt to start the new chat

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure.
Phases 0-8 are complete. On the AI service, RAG Stages 0, 1.1, 1.2, 1.2c are done
and 1.6 is measured. I need you to pick up where the last session left off.

REPOSITORY LAYOUT
  law-finder/
    lawyer-finder-web/   Next.js 16 + Prisma 7 + Postgres — the main product
    lawyer-rag/          Python Flask + ChromaDB + Ollama — the AI assistant
    lawyer-portfolio/    an untouched Vite template, ignore it

READ THESE FIRST, IN THIS ORDER:
  1. lawyer-finder-web/docs/THE-PROJECT.md      what this is, in two pages
  2. lawyer-finder-web/docs/TOUR.md             the whole system, feature by
                                                feature, and WHY each thing is
                                                built that way
  3. lawyer-finder-web/docs/OPEN-ITEMS.md       every outstanding item + a
                                                decision on each (read E1, E1b)
  4. lawyer-finder-web/docs/DIRECTION.md        what to build next, in order
  5. lawyer-rag/docs/RAG-ROADMAP.md             the AI plan. READ 1.6 and the
                                                "first attempt at 2.1" note
  6. lawyer-rag/docs/RUNNING.md                 how to run the AI service
  7. lawyer-rag/eval/results/STAGE-1.6.md       the model comparison + verdict
  8. lawyer-rag/eval/README.md                  what the eval measures, what it
                                                REFUSES to do, and its noise floor
  9. lawyer-rag/docs/RAG-REVIEW.md §4.18-4.23   recent findings

⚠️ IGNORE the four planning documents at the repository root
(project_scope_and_vision.md, mvp_project_plan.md, developer_project_plan.md,
architecture_manual.md). They describe the pre-restructure marketplace —
sponsored listings, commission on fees, reviews, lead generation — all unlawful
in Sri Lanka and removed. They are marked superseded.

GIT STATE
Branch restructure-booking-flow, tree clean. SEVEN commits NOT yet pushed.
Ask me before any destructive git command, and before pushing.

CURRENT CONFIG
lawyer-rag/.env: LLM_PROVIDER=ollama, LLM_MODEL=llama3.2:3b — the model the
measurement favoured. ENABLE_HYBRID_SEARCH is false and that is deliberate.

⚠️ MY MACHINE OVERHEATS UNDER SUSTAINED LOCAL INFERENCE. I stopped Ollama
mid-run once for exactly this. Do NOT start a 20+ minute local eval without
asking me first.

HOW TO RUN IT
  cd lawyer-finder-web && npm run dev          # http://localhost:3000
  cd lawyer-rag && source venv/bin/activate
  ollama serve &                               # skip if Ollama.app is running
  gunicorn -c gunicorn.conf.py wsgi:app        # http://127.0.0.1:5001

  Changes to lawyer-rag/app/** need a gunicorn RESTART.
  Changes to lawyer-finder-web/src/** hot-reload.

  Seeded logins are password123 — citizen@thelawyr.lk, lawyer@thelawyr.lk,
  admin@thelawyr.lk.

YOUR TASK THIS SESSION — in this order

1. LOAD LAND / PROPERTY LAW. The highest-value item on the whole roadmap
   (Stage 4.1). The corpus holds only Companies, Civil Procedure, Motor
   Traffic, Computer Crimes and one SSCL amendment, so most real questions
   get a correct-but-useless "I do not hold that".

   Source: https://lankalaw.net/consolidated-acts-2024/  — this is where the
   EXISTING corpus came from; it is printed on page 1 of the Companies Act
   PDF ("Published By www.lankalaw.net"), so the format already matches.
   Start with Partition, Prescription, Penal Code, then Land Acquisition,
   Land Development, Registration of Documents, Notaries.

   Note the two official sources are currently broken: lawnet.gov.lk serves
   a parked page, and documents.gov.lk was rebuilt and holds only ~174
   recent Acts.

   BEFORE INGESTING:
     - Back up lawyer-rag/data/graph/knowledge_graph.json. Ingest steals
       shared entity nodes between Acts (RAG-REVIEW 4.11, unfixed).
     - lawyer-rag/data/ is TRACKED IN GIT and is the only backup of the
       vector store.
   AFTER INGESTING:
     - Re-run ./venv/bin/python -m scripts.sweep_retrieval (free, no model)
     - Relabel eval/questions.yaml: several not_in_corpus questions become
       answerable, and would start failing for the right reason.

2. ADD LAY-WORDED QUESTIONS TO THE EVAL SET. The golden set was written by
   reading the corpus, so it uses STATUTORY vocabulary — and it is therefore
   blind to the single most common real failure, which is lay vocabulary
   ("register a company" vs "incorporation"). Add lay-worded variants
   pointing at the SAME expected sections. Without this, step 3 cannot be
   measured and will look like it changed nothing.

3. REDO HYBRID SEARCH PROPERLY (roadmap 2.1). It is built and switched OFF
   because as built it does nothing — I ranked BM25 candidates by DENSE
   score, so the lexical half got no vote. Read the "first attempt at 2.1"
   note in RAG-ROADMAP.md before touching it. The fix needs two changes
   together: rank by Reciprocal Rank Fusion, and let a strong keyword match
   clear the relevance gate at a lower dense score. That changes what the
   floor means, so measure not_in_corpus with scripts/sweep_retrieval.py —
   it needs no model and runs in seconds.

4. LLAMA CONTROL RUN. The tightened citation prompts and the impersonal-
   writing instruction ship today but were only ever measured on Gemini.
   20 questions is enough. ASK ME FIRST (heat).

THREE THINGS ONLY I CAN DO — please remind me if I have not:
  - ROTATE RAG_SERVICE_TOKEN. I pasted the live one into a chat on
    2026-09-19. Generate a new one and set it in BOTH .env files:
      python -c "import secrets; print(secrets.token_urlsafe(48))"
  - Revoke the old LangSmith and Groq keys, commented out in lawyer-rag/.env
    marked REVOKE-ME. Tracing is off, but that stops NEW data leaving; a key
    that still works can be turned back on.
  - Email a Sri Lankan Attorney-at-Law about counsel questions 16-18.
    docs/restructure/COUNSEL-MEETING-BRIEF.md has been ready since Phase 6.

WORKING STYLE — learned the hard way, and re-learned yesterday
  - Verify by RUNNING, not by reading. Every real defect this project has
    found came from driving the actual app.
  - SAMPLE PROPERLY BEFORE DECLARING A FIX. An intermittent bug at ~40%
    survived six clean runs and two confident wrong diagnoses in one
    session. If a failure is intermittent, run it a dozen times and count.
  - A PROMPT IS A PREFERENCE; THE GATE IS THE RULE. Telling the model to
    write impersonally removed the wording but not the structure the gate
    was matching. Fix the layer that actually decides.
  - Reproduce a bug before you fix it, and capture the transcript.
  - THE MEASURING INSTRUMENT IS ALSO CODE AND IT HAS HAD BUGS. Before
    trusting a comparison, ask what the scorer does with an answer that is
    correct but unusual, and what it does if the service is simply down.
    Both were wrong here.
  - A failure that reads as a fact about the world is the worst kind. "I do
    not hold that legislation" was a statement about Sri Lankan law when the
    truth was "the model host is off". Never let infrastructure failure
    share a return value with a domain answer.
  - A guardrail pattern that LOOKS right can still miss. Four misses so far:
    a missing adverb, a possessive instead of a verb, a plural, and a
    numbered list it could not tell from a statutory procedure. When you
    widen one, ALWAYS pin the general form that must still be answered — a
    check that refuses both sides of a line is as broken as one that answers
    both.
  - After fixing one route, check its siblings. After removing a feature,
    grep for callers.
  - Never break a working flow to make a legal fix — replace before removing.
  - Schema changes ship as migrations: npm run db:migrate -- --name <name>.
    Never prisma db push. npm run db:reset is destructive and has been
    declined before.
  - Running the RAG service dirties git (data/ is tracked). Check
    /api/documents total_chunks, then git checkout -- lawyer-rag/data/.
  - Run all five checks after every change set, from lawyer-finder-web/:
      npm run check:privilege   (41)
      npm run check:firm        (15)
      npm run check:ai          (80)
      npm run check:billing     (21)
      npm run check:pdpa        (67)
    plus npx tsc --noEmit. A green build proves none of the seven legal
    rules hold — that is what the checks are for.
  - For the AI service, from lawyer-rag/ with it running:
      ./venv/bin/python scripts/check_security.py            (46)
      ./venv/bin/python -m scripts.sweep_retrieval           (free, no model)
      ./venv/bin/python -m scripts.eval --compare <results>  (slow, costs money)
    If check_security reports fewer than 46, an earlier crashed run left
    probe files behind: clear PWNED/corrupt/etc_passwd/tmp_pwned .pdf from
    data/uploads and run it again.
  - Update the docs at the end of the session: PROGRESS.md, RAG-REVIEW.md,
    RAG-ROADMAP.md, TOUR.md if a feature changed, and this brief.

I am a software engineer, not a lawyer. Make the legal calls yourself and
explain the reasoning in plain words afterwards.
```

---

## 2. Where things actually stand

### Committed, not yet pushed (7 commits)

| | |
| --- | --- |
| **RAG Stage 1.6** | One model in one place; Gemini measured twice and it is WORSE |
| **§4.18** | An outage was answered as a false statement about the law → now 503 |
| **§4.19–4.20** | Two eval-harness defects, and the noise floor quantified |
| **§4.22** | A real user's own-matter question passed the guardrail (possessive) |
| **plural + adverb** | Two more guardrail misses of the same family |
| **query expansion** | "registration" → "incorporation", as a rescue only |
| **hybrid search** | Built, measured, does nothing, switched OFF |
| **advice gate** | Was refusing statutory procedures 5 times in 12 |

`check:ai` went **55 → 80** across the session.

### The AI numbers

| | `llama3.2:3b` | `gemini-3.6-flash` |
| --- | --- | --- |
| **grounding** | **96.3%** | 86.6% |
| answerable | 82.4% | 82.4% |
| must_refuse | 93.3% | 86.7% |
| median latency | **5.0s** | 14.4s |

**The hosted model lost.** `.env` is back on `llama3.2:3b`. Full detail, and the two
integration defects that would have shipped, in `eval/results/STAGE-1.6.md`.

### What is NOT done

1. **Corpus breadth** — the limiting factor now, not the code.
2. **Lay-worded eval questions** — without them the vocabulary problem is unmeasurable.
3. **Hybrid search, properly** — RRF plus a lexical path through the gate.
4. **The llama control run** — today's prompts were only measured on Gemini.
5. **Token rotation**, LangSmith/Groq revocation, counsel email.

### The five things that have not moved in nine phases

1. **Nobody has asked counsel** about Q16–18 — whether the consumer directory may lawfully
   exist at all. Top of "next up" since Phase 2.
2. **Nobody has talked to a law firm.** Nine phases of reasoning, zero users.
3. **Never deployed.** No CI, no TLS, no backups, no monitoring.
4. **`MATTER_ENCRYPTION_KEYS` has no custody arrangement.**
5. **Nothing runs on a timer.** `jobs:daily` exists; nothing calls it.

Items 1 and 2 cannot be done by writing code, which is exactly why they keep not happening.
