# Next Session Brief

> Updated 2026-09-19. **Copy §1 into a new chat as your first message.**
>
> Update this file at the end of every session. A brief that points at work already done is
> worse than no brief — the next session will trust it.

---

## 1. Prompt to start the new chat

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure.
Phases 0-8 are complete. On the AI service, RAG Stages 0, 1.1, 1.2 and 1.2c are
complete. Stage 1.6 is MEASURED but not settled. I need you to pick up where
the last session left off.

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
  5. lawyer-rag/docs/RAG-ROADMAP.md             the staged plan for the AI —
                                                READ 1.6, it is half done
  6. lawyer-rag/docs/RUNNING.md                 how to run the AI service —
                                                READ THIS BEFORE STARTING IT
  7. lawyer-rag/eval/README.md                  what the eval measures, what it
                                                REFUSES to do, and its noise floor
  8. lawyer-rag/docs/RAG-REVIEW.md §4.18-4.21   the four findings from last session

⚠️ IGNORE the four planning documents at the repository root
(project_scope_and_vision.md, mvp_project_plan.md, developer_project_plan.md,
architecture_manual.md). They describe the pre-restructure marketplace —
sponsored listings, commission on fees, reviews, lead generation — all of which
is unlawful in Sri Lanka and was removed. They are marked superseded. Building
from them rebuilds the illegal product.

GIT STATE
Branch restructure-booking-flow, tree clean. FOUR commits are NOT yet pushed.
Ask me before any destructive git command, and before pushing.

⚠️ lawyer-rag/.env currently has LLM_PROVIDER=google, LLM_MODEL=gemini-3.6-flash.
That is the WORSE model by measurement — see below. To go back:
LLM_PROVIDER=ollama, LLM_MODEL=llama3.2:3b.

⚠️ MY MACHINE OVERHEATS UNDER SUSTAINED LOCAL INFERENCE. I stopped Ollama
mid-run last session for exactly this reason. Do NOT start a 30-50 minute local
eval run without asking me first. The hosted path costs the machine nothing.

HOW TO RUN IT
  cd lawyer-finder-web && npm run dev          # http://localhost:3000
  # if it says "Another next dev server is already running":
  #   kill <PID>  &&  rm -f .next/dev/lock  &&  npm run dev

  cd lawyer-rag && source venv/bin/activate
  ollama serve &                               # only if LLM_PROVIDER=ollama
  gunicorn -c gunicorn.conf.py wsgi:app        # http://127.0.0.1:5001

  Seeded logins are password123 — citizen@thelawyr.lk, lawyer@thelawyr.lk,
  admin@thelawyr.lk.

YOUR TASK THIS SESSION

Pick up after Stage 1.6. Read lawyer-rag/eval/results/STAGE-1.6.md FIRST — it
holds both Gemini runs and the verdict.

WHAT WAS MEASURED (do not redo it)
  gemini-3.6-flash, two full runs of the 83-question golden set. IT IS WORSE
  than the llama3.2:3b it would replace:

                        llama3.2:3b   gemini run 1   run 2 (tighter prompts)
    grounding              96.3%         82.9%           86.6%
    ungrounded citations      —          28.4%           21.4%
    answerable             82.4%         78.4%           82.4%
    must_refuse            93.3%         86.7%           86.7%
    median latency          5.0s         16.4s           14.4s

  Gemini cites sections that were never retrieved — 21.4% of everything it
  names, even after the prompt fix. The failures are the LONG answers: a
  stronger model writes a more thorough reply and the thoroughness comes out
  of its own memory. The policy gate withholds them, so nobody is misled, but
  the feature degrades.

  Also done: one model named in one place (LLM_PROVIDER + LLM_MODEL, no
  default for LLM_MODEL at all); message_text() in llm.py because Gemini 3.x
  returns content as a LIST not a string (every answer would have rendered
  EMPTY); AGENT_MAX_ITERATIONS raised to 18 because 10 was tuned for llama.

WHAT IS STILL OWED
  1. THE LLAMA CONTROL RUN — the one real risk outstanding. The tightened
     citation prompts in legal_agent.py and rag_chain.py are now the SHIPPED
     prompts and have ONLY ever been measured on Gemini. If the system is
     pointed back at Ollama it runs a prompt nobody has tested on it.
     20 questions (~5 min) is enough:
       ./venv/bin/python -m scripts.eval --label answerable --out eval/results/control-llama.json
     ASK ME FIRST — see the heat warning.

  2. Decide the model properly once 1 is done. The measurement says llama.

  3. Add an `errored` category to the eval scorer, so "Sorry, need more steps"
     stops counting as a refusal (it currently scores as an abstention, which
     for must_refuse/not_in_corpus is a PASS).

  4. Store `sources` in the eval result rows — their absence is why fu-006
     could not be replayed through the real policy gate offline.

  5. Corpus breadth (Stage 4.1) is now the highest-value item. A real user
     asked about someone cutting a tree on their property and got a correct
     "I do not hold that" — the corpus has no land, property or tort law. The
     refusal was right; the product was useless. That is content, not code.

BEFORE YOU TRUST ANY COMPARISON — read RAG-REVIEW.md §4.19 and §4.20
  The eval harness had two defects that would have corrupted this exact
  measurement, and a noise floor nobody had quantified:
    - A closing "consult a qualified lawyer" was scored as a REFUSAL, which
      penalises a better-behaved model for behaving better. Fixed.
    - An outage scored 100% refusal correctness and wrote a results file.
      Fixed: pre-flight demands /api/health == healthy, and any mid-run HTTP
      error aborts and writes NOTHING.
    - Same model, same corpus, two runs: answerable 42/51 vs 40/51, and the
      router classified 4 of 83 questions differently. ANY DIFFERENCE BELOW
      ~±2 QUESTIONS IS NOT EVIDENCE. Use the per-question fixed/broke lists
      that --compare now prints, not the averages.

  Watch fu-001, fu-002, adv-002, adv-003 specifically — those are the four
  whose routing moved, so a better model should show up there first (§4.21).

  Watch LATENCY too. --compare prints p95, the slowest question, and how many
  answers land past the Next.js caller's 60s timeout. An answer at 70s is not
  a slow answer, it is a failed one, and a median hides that cliff.

DO NOT re-tune RETRIEVAL_MIN_SCORE. The thresholds (0.62 / 0.50) are
properties of the EMBEDDING model and the corpus, not the chat model, and
embeddings stay local on every provider.

AFTER THAT, in roadmap order: 1.3 (carry retrieval results through — removes
the duplicate searches 1.2 knowingly added), 1.4 (delete verify_answer_tool),
1.4b (the knowledge-graph delete bug, §4.11), 1.5 (derive the corpus list at
runtime, which also fixes §4.12 — two Acts are stored as "Act No. 24 of
2007/2025" and cost two evaluation answers outright).

TWO THINGS ONLY I CAN DO — please remind me if I have not:
  - Revoke the old LangSmith API key and the stale Groq key. Both are
    preserved commented out in lawyer-rag/.env marked REVOKE-ME. Tracing is
    off, but that stops NEW data leaving; it does not un-send what was
    already sent, and a key that still works can be turned back on.
  - Email a Sri Lankan Attorney-at-Law about counsel questions 16-18.
    lawyer-finder-web/docs/restructure/COUNSEL-MEETING-BRIEF.md is written
    and has been ready since Phase 6.

WORKING STYLE — learned the hard way over nine phases and five RAG stages
  - Verify by RUNNING, not by reading. A green build has hidden an invalid
    SQL migration, a seed broken for two sessions, an AI citing an Act that
    does not exist, star ratings still being collected two phases after
    being reported removed, a firm-membership system that granted nothing
    across four layers, and a gunicorn setting that logged "Listening at"
    and then SIGSEGV'd every worker. Drive the actual app.
  - Reproduce a bug before you fix it. Stage 0 proved the path traversal,
    the error leak and the LAN bind against the running service first.
    Stage 1.6 captured the outage-as-false-answer transcript before fixing
    it, and then proved the 503 from both directions.
  - THE MEASURING INSTRUMENT IS ALSO CODE, AND IT HAD BUGS. Before comparing
    anything, ask what the scorer would do with an answer that is correct
    but unusual, and what it would do if the service were simply down. Both
    of those were wrong here, and both were silent.
  - A failure that reads as a fact about the world is the worst kind. "I do
    not hold that legislation" was a statement about Sri Lankan law when the
    truth was "the model host is off". Never let an infrastructure failure
    share a return value with a domain answer.
  - A test suite can be deep and narrow at once. The eval set was 76
      questions and ONE TURN WIDE, and a user found a broken follow-up that
      it could never have caught. When you fix a bug, ask what shape of test
      was missing — not just what value was wrong.
  - A guardrail pattern that LOOKS right can still miss. "you may be
    personally liable for the company's debts" reached a real user: the
    regex had no room for the adverb and required liable "to", not "for".
    When you widen one, add a case for the general form too.
  - When a test passes, ask whether it describes a real actor.
    check:privilege passed for five phases because a fixture called a
    paralegal actorRole: 'LAWYER' — a person who cannot exist.
  - A failing check is not automatically a failing rule. Check for a stale
    Prisma client (npm run db:generate) or a stale .next (rm -rf .next).
  - After removing a feature, grep for its callers. After fixing one route,
    check its siblings. (Changing search_documents' contract broke an
    assertion in check_security.py — which is exactly what it is for.)
  - Never break a working flow to make a legal fix — replace before removing.
  - Schema changes ship as migrations: npm run db:migrate -- --name <name>.
    Never prisma db push.
  - lawyer-rag/data/ is TRACKED IN GIT and running the service dirties it.
    Check /api/documents total_chunks before assuming data loss, then
    git checkout -- lawyer-rag/data/. It is also the only backup that
    exists of the vector store.
  - Run all five checks after every change set, from lawyer-finder-web/:
      npm run check:privilege   (41)
      npm run check:firm        (15)
      npm run check:ai          (66)
      npm run check:billing     (21)
      npm run check:pdpa        (67)
    plus npm run build and npx tsc --noEmit. A green build proves none of
    the seven legal rules hold — that is what the checks are for.
  - For the AI service, from lawyer-rag/ with it running:
      ./venv/bin/python scripts/check_security.py                 (46)
      ./venv/bin/python -m scripts.eval --compare <a results file>
    The eval count is data-dependent in one place: check_security's upload
    loop fires once per probe file that lands, so a crashed earlier run that
    skipped its own cleanup makes the next run report FEWER assertions. If
    you see 43 instead of 46, clear data/uploads of PWNED/corrupt/
    etc_passwd/tmp_pwned .pdf and run it again.
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

### Done, and **NOT committed** — review the diff first

| | |
| --- | --- |
| **RAG Stage 1.6 (the seam half)** | One model in one place; a Gemini provider seam, untested |
| **§4.18 fixed** | An outage is no longer answered as a false statement about the law |
| **§4.19 fixed** | Two evaluation-harness defects that would have corrupted the comparison |
| **§4.20, §4.21 recorded** | The eval's noise floor, and a follow-up hitting the lawyer refusal |
| **E0b decided** | Guests keep the single-shot chat — option (a) |

### The AI numbers

**Unchanged since Stage 1.2c, because nothing was measured this session.** The last valid
figures are from `eval/results/stage-1.2b.json` (llama3.2:3b, 83 questions):

| | baseline | stage 1.2b |
| --- | --- | --- |
| retrieval recall@k | 63.0% | **84.3%** |
| citation accuracy | 0.663 | **0.882** |
| grounding | 91.8% | **96.3%** |
| refusal correctness | 33.3% | **96.9%** |
| `not_in_corpus` | 12.5% | **100%** |

> ⚠️ Those were scored by the **old** scorer, which failed correct answers that ended in a
> disclaimer (§4.19a). They are not directly comparable to anything measured from now on,
> which is why the control run has to be redone rather than reused.

### Found and fixed along the way, worth remembering

- An **unauthenticated remote file write** on the AI service, reproduced before fixing.
- **Every legal question was being sent to LangSmith's US cloud.** Off now; **the key still
  needs revoking.**
- A **live rule 6 violation in the main product** — *"you may be personally liable for the
  company's debts"* was published to a user. Neither policy layer caught it.
- **An outage was reported to the user as a fact about Sri Lankan law** (§4.18). Fixed.
- **The evaluation harness rewarded the wrong behaviour and scored an outage as perfect**
  (§4.19). Fixed.
- `DELETE /api/documents/<name>` **silently strips knowledge-graph entities from other
  Acts** (§4.11). Unfixed; back up before calling it.

### The five things that have not moved in nine phases

1. **Nobody has asked counsel** about Q16–18 — whether the consumer directory may lawfully
   exist at all. Top of "next up" since Phase 2.
2. **Nobody has talked to a law firm.** Nine phases of reasoning, zero users.
3. **Never deployed.** No CI, no TLS, no backups, no monitoring.
4. **`MATTER_ENCRYPTION_KEYS` has no custody arrangement.** Losing it destroys every matter.
5. **Nothing runs on a timer.** `jobs:daily` exists; nothing calls it.

Items 1 and 2 cannot be done by writing code, which is exactly why they keep not happening.
