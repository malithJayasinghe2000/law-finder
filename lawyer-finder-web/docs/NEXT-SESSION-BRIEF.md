# Next Session Brief

> Updated 2026-09-21, after an overnight session on the RAG service.
> **Copy §1 into a new chat as your first message.**
>
> Update this file at the end of every session. A brief that points at work already done is
> worse than no brief — the next session will trust it.

---

## 0. Read this before anything else

**0a. The router could send a legal question to the path with no retrieval — fixed
2026-09-21.** *"what is the process of register a company"* was classified
`conversational` (small talk), which skips retrieval entirely, and the service invented
company law: a "Sri Lanka Companies Registration Department database", a "Memorandum and
Articles of Association" (abolished by the 2007 Act), a "Share Capital Deed". It reached
the user as a *legal-advice refusal*, which is what made it visible. Nothing downstream
could catch it — an answer that cites nothing gives the citation check nothing to compare.
Now only exact greeting matches skip the search; the router's `conversational` verdict is
overruled by evidence, exactly as `clarification_needed` already was. RAG-REVIEW §4.35.

⚠️ **`lawyer_request` is the one intent that still short-circuits on the model's opinion.**
Same shape of risk. Worth closing next.

Two more things from the overnight session you need to know in the first minute.

**0b. The corpus was re-extracted and re-chunked, and it fixed a WRONG CITATION that
was being published.** The service used to cite **Penal Code s.368** for the punishment
for theft. It is **s.367**; s.368 is theft of cattle. Five Civil Procedure Code sections
were mis-attributed the same way. The cause was the PDF's two-column layout — marginal
note, section number and body are three separate blocks on one line, and the old
extractor interleaved them. See RAG-REVIEW §4.29.

**0c. That fix made every retrieval number worse, and it was kept anyway.**

```
                      before        after (floor 0.62)
  answerable          54/75            51/75
  not_in_corpus       10/12             7/12
  chunks <100 chars    15.7%            2.7%
  theft citation    s.368 WRONG      s.367 correct
```

The reason is chunk length, and the fix is **parent-document retrieval** (roadmap 2.3) —
now the top retrieval item. Three cheaper options were tried and measured and all failed.
Full reasoning in RAG-ROADMAP under "Why 2.3 is now the top retrieval item".

**If you disagree with that trade, the pre-re-chunk vector store is NOT in git** — it was
a scratch backup and it is gone. Rebuild with `python -m scripts.ingest_all --replace`
after reverting `app/ingestion/pdf_parser.py` and `app/core/chunker.py`.

---

## 1. Prompt to start the new chat

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure.
Phases 0-8 are complete. On the AI service, RAG Stages 0, 1.1, 1.2, 1.2c are done,
1.5 and 2.1 are done, 1.6 is measured, and 4.1 is done for land/property.
I need you to pick up where the last session left off.

REPOSITORY LAYOUT
  law-finder/
    lawyer-finder-web/   Next.js 16 + Prisma 7 + Postgres — the main product
    lawyer-rag/          Python Flask + ChromaDB + Ollama — the AI assistant
    lawyer-portfolio/    an untouched Vite template, ignore it

READ THESE FIRST, IN THIS ORDER:
  1. lawyer-finder-web/docs/NEXT-SESSION-BRIEF.md §0  the three things that matter
  2. lawyer-finder-web/docs/THE-PROJECT.md      what this is, in two pages
  3. lawyer-rag/docs/RAG-REVIEW.md §4.28-4.35   the overnight findings. §4.35,
                                                §4.29 and §4.31 are the ones to read
  4. lawyer-rag/docs/RAG-ROADMAP.md             READ the note "Why 2.3 is now
                                                the top retrieval item"
  5. lawyer-finder-web/docs/TOUR.md             the whole system, feature by feature
  6. lawyer-finder-web/docs/OPEN-ITEMS.md       every outstanding item (read E1, E1b)
  7. lawyer-rag/eval/README.md                  what the eval measures and refuses to do
  8. lawyer-rag/docs/RUNNING.md                 how to run the AI service

⚠️ IGNORE the four planning documents at the repository root
(project_scope_and_vision.md, mvp_project_plan.md, developer_project_plan.md,
architecture_manual.md). They describe the pre-restructure marketplace —
sponsored listings, commission on fees, reviews, lead generation — all unlawful
in Sri Lanka and removed. They are marked superseded.

GIT STATE — READ BEFORE ANY git checkout
Branch restructure-booking-flow. SEVEN commits not yet pushed, PLUS a large
UNCOMMITTED change set from 2026-09-20/21. Nothing from either session is
committed.

🔴 lawyer-rag/data/vectordb/ IS MODIFIED AND THAT IS THE CORPUS, NOT CHURN.
The usual `git checkout -- lawyer-rag/data/` would destroy it. Check
/api/documents reports 3,424 chunks and 14 documents before touching data/.

Untracked and WANTED:
  lawyer-rag/data/acts/                 13 source PDFs, 11 MB — the corpus is
                                        now rebuildable from these
  lawyer-rag/scripts/validate_questions.py
  lawyer-rag/scripts/check_injection.py
  lawyer-rag/app/core/corpus.py
Untracked and NOT wanted: lawyer-rag/data/.DS_Store — gitignore it.

Ask me before any destructive git command, and before pushing.

CURRENT CONFIG
lawyer-rag/.env: LLM_PROVIDER=ollama, LLM_MODEL=llama3.2:3b
config.py: ENABLE_HYBRID_SEARCH=true (RRF, measured, +3 answerable)
           RETRIEVAL_MIN_SCORE=0.62   (0.64 was tried and reverted — it refused
                                       "how may a director be removed")
           RETRIEVAL_MIN_MARGIN=0     (built, measured, does not separate)
           ENABLE_LEXICAL_GATE=false  (built, measured, costs not_in_corpus)

⚠️ MY MACHINE OVERHEATS UNDER SUSTAINED LOCAL INFERENCE. Embedding is cheap
(~17 chunks/sec, a full re-ingest is ~14 min). It is GENERATION that costs heat.
Do NOT start a 20+ minute eval run without asking me first.

HOW TO RUN IT
  cd lawyer-finder-web && npm run dev          # http://localhost:3000
  cd lawyer-rag && source venv/bin/activate
  ollama serve &                               # skip if Ollama.app is running
  gunicorn -c gunicorn.conf.py wsgi:app        # http://127.0.0.1:5001

  Changes to lawyer-rag/app/** need a gunicorn RESTART.
  STOP the service before ingesting — two Chroma clients on one directory.
  Seeded logins are password123 — citizen@ / lawyer@ / admin@thelawyr.lk.

YOUR TASK THIS SESSION — in this order

1. CLOSE THE `lawyer_request` SHORT-CIRCUIT. It is the last intent that skips
   retrieval on the 3B router's opinion alone. The `conversational` version of
   that bug invented company law and shipped a nonsense refusal to a real user
   (§4.35); this is the same shape, one intent over. Small fix.

2. PARENT-DOCUMENT RETRIEVAL (roadmap 2.3). The top retrieval item, and the only
   thing that resolves the trade in §0c. Embed small focused child chunks so the
   specific sentence matches; return the enclosing section so the answer is
   complete and citeable. No new dependency needed.

   The single clearest test case:
     "What is the punishment for theft under the Sri Lankan Penal Code?"
     Penal Code s.367 contains, verbatim, "Whoever commits theft shall be
     punished with imprisonment ... three years" — and it is NOT IN THE TOP 30.

   Re-sweep RETRIEVAL_MIN_SCORE afterwards. It has now been invalidated twice
   by changes that had nothing to do with it.

3. STAGE 1.4 — MAKE THE ANSWER MATCH THE SECTION. Still open. The service
   answered "12 years" for the prescriptive period where s.3 says TEN, six runs
   out of six, with grounding and the citation gate both passing because the Act
   it cited really was retrieved (RAG-REVIEW §4.25). Only the number was wrong,
   and the number was the whole answer.

4. TRANSLATE THE GUARDRAILS, or keep the assistant disabled for si/ta.
   It is disabled now (UNSUPPORTED_LANGUAGE), because every check in policy.ts
   is an English regex and Sinhala/Tamil speakers had NO own-matter rule and NO
   touting rule at all (§4.32). Lifting it means translating OWN_MATTER_PATTERNS,
   REPRESENTATION_PATTERNS and the answer-side checks, plus cases in check:ai.
   ⚠️ THIS IS A USER-VISIBLE CHANGE I MADE WHILE YOU WERE ASLEEP. If you would
   rather it answered unguarded, it is one guard at the top of classifyRequest.

5. LOAD MORE LEGISLATION (4.1 continued). Labour → Family → Criminal Procedure
   → Tax → Evidence → Rent. Source: lankalaw.net, a page per letter.
   The Criminal Procedure Code PDF is in data/uploads/ and still not ingested.
   ⚠️ Land Acquisition is NOT in that set — I checked the whole L index.

6. LLAMA CONTROL RUN. Still owed from 1.6, and every number in eval/results/
   now predates two corpus changes. ASK ME FIRST (heat).

THREE THINGS ONLY I CAN DO — please remind me if I have not:
  - ROTATE RAG_SERVICE_TOKEN. Pasted into a chat on 2026-09-19. This matters
    more than it did: the ingest endpoints are now allow-listed, but the token
    is still the only thing between a caller and the corpus.
      python -c "import secrets; print(secrets.token_urlsafe(48))"
  - Revoke the old LangSmith and Groq keys (REVOKE-ME in lawyer-rag/.env).
  - Email a Sri Lankan Attorney-at-Law about counsel questions 16-18.

WORKING STYLE — learned the hard way, and re-learned all night
  - VERIFY BY RUNNING. Every single defect this session came from driving the
    service, never from reading the code. The corpus-list bug, the wrong theft
    citation, the touting hole and the language hole were all invisible on the
    page and obvious in one request.
  - THE MEASURING INSTRUMENT IS ALSO CODE, AND IT HAS NOW BEEN WRONG FOUR TIMES.
    This session alone: a probe that called hybrid_search with apply_floor=False
    and reported a gate had "no effect at any setting" when it never ran; a grid
    that measured "clears the floor" instead of "retrieves the right section";
    a comparison that reported phantom nondeterminism because it diffed Python
    SETS across processes. Before believing "no effect", check the code path is
    reached.
  - A GUARDRAIL TESTED ONLY WITH THE SENTENCE IT WAS WRITTEN FROM TESTS NOTHING.
    check:ai passed at 80 while the classifier allowed all six touting questions
    in the eval set, because all three of its cases happened to be phrased
    without a practice area.
  - SIX MISSES OF THE SAME FAMILY NOW: a missing adverb, a possessive instead of
    a verb, a plural, a numbered list, a recovery verb, and a qualifier gap.
    When you widen one, ALWAYS pin the general form that must still be answered.
  - A LABEL IS A CLAIM WITH A SHELF LIFE. "not in the corpus" expires when the
    corpus changes. So does an answer key: nic-004's key said s.368 because the
    STORE said s.368, and the store was wrong. Reading it in the store first is
    right and is not sufficient.
  - DON'T POINT A TEST AT A REAL INGEST DIRECTORY. I probed the containment fix
    with source_dir=data/uploads and it cheerfully ingested both PDFs, doubling
    the Companies Act. Restored from backup; check /api/documents after.
  - Never break a working flow to make a legal fix — replace before removing.
  - Schema changes ship as migrations. Never prisma db push.
  - Run all five checks after every change set, from lawyer-finder-web/:
      npm run check:privilege   (41)
      npm run check:firm        (15)
      npm run check:ai         (112)   ← was 80
      npm run check:billing     (21)
      npm run check:pdpa        (67)
    plus npx tsc --noEmit.
  - For the AI service, from lawyer-rag/ with it running:
      ./venv/bin/python scripts/check_security.py            (46)
      ./venv/bin/python scripts/check_injection.py           (16, NEW, ~8 min)
      ./venv/bin/python -m scripts.validate_questions        (free, no model)
      ./venv/bin/python -m scripts.sweep_retrieval           (free, no model)
  - Update the docs at the end: PROGRESS.md, RAG-REVIEW.md, RAG-ROADMAP.md,
    TOUR.md if a feature changed, and this brief.

I am a software engineer, not a lawyer. Make the legal calls yourself and
explain the reasoning in plain words afterwards.
```

---

## 2. What the overnight session did

### Security and guardrails — the most important half

| | |
| --- | --- |
| **§4.31 touting** | `classifyRequest` allowed **all six** `law-*` questions from the eval set — "recommend a good **property** lawyer" passed where "recommend a good lawyer" was refused. Rule 4 carries **criminal** exposure. Fixed; `hire` was in neither layer |
| **§4.32 language** | Sinhala and Tamil speakers had **no guardrail at all** — no own-matter rule, no touting rule, and the answer-side checks return zero markers. Now refused with `UNSUPPORTED_LANGUAGE` |
| **§4.33 ingest paths** | `file_path` and `source_dir` accepted any local path — arbitrary file read that lands in *retrieved context*. Now allow-listed to `data/uploads` and `data/acts`, containment checked before existence |
| **§4.34 injection** | New `scripts/check_injection.py` — 16 probes (override, forged system turns, hypothetical/fiction/role-play, touting, exfiltration, base64, character spacing, si/ta, context-as-instruction). All pass |
| **own-matter** | Sixth miss found and fixed earlier in the night; `check:ai` **80 → 112** |

### Correctness

| | |
| --- | --- |
| **§4.28** | Both system prompts and the router named a **hardcoded** corpus. After the land ingest the service said *"the Penal Code does not specifically address theft"* while holding it. `app/core/corpus.py` now derives the list and is invalidated on ingest |
| **§4.29** | Layout-aware extraction + chunker fixes. **15.7% → 2.7%** citeable-empty chunks, and the theft citation corrected from s.368 to **s.367** |
| **§4.26** | 14 title-page chunks removed from retrieval — they were top hits for any question naming an Act |
| **corpus sources** | `data/acts/` now holds 13 of the 14 documents' PDFs. The corpus is rebuildable; before, `ACTS_SOURCE_DIR` pointed at a directory that has never existed |

### Measured and rejected — recorded so nobody re-derives them

- **Margin gate** — separates on a 30-result pool, does nothing on the 6 the service uses.
- **CHUNK_SIZE 1000** — 48/75 and 8/12, no better than 1500.
- **Floor 0.64** — restores abstention, refuses the canonical director question live.
- **Cross-encoder reranker** — needs torch (~200 MB) and CPU latency per request. **Not added while you were asleep.** That is your call.

### Current state, verified

```
corpus            3,424 chunks, 14 documents, all Active
eval set          109 questions, 81 answerable — all keys resolve to real chunks
check:ai          112 passed, 0 failed          check_security.py   46/46
check:privilege    41   check:firm 15   check:billing 21   check:pdpa 67
tsc --noEmit      clean                         check_injection.py  16/16
```

### What is NOT done

1. **Close the `lawyer_request` short-circuit** — the last intent that skips retrieval on
   a 3B model's opinion (§4.35). Small, and the same shape as the bug above.
2. **Parent-document retrieval** — the top retrieval item; resolves the trade in §0b.
3. **Stage 1.4** — the answer still does not have to match the section it cites.
4. **Guardrail translation** for si/ta, or keep the assistant disabled there.
5. **Corpus breadth** — labour, family, tax, evidence, rent. Criminal Procedure is free.
6. **Token rotation**, LangSmith/Groq revocation, counsel email.

### The five things that have not moved in nine phases

1. **Nobody has asked counsel** about Q16–18. Top of "next up" since Phase 2.
2. **Nobody has talked to a law firm.** Nine phases of reasoning, zero users.
3. **Never deployed.** No CI, no TLS, no backups, no monitoring.
4. **`MATTER_ENCRYPTION_KEYS` has no custody arrangement.**
5. **Nothing runs on a timer.** `jobs:daily` exists; nothing calls it.

Items 1 and 2 cannot be done by writing code, which is exactly why they keep not happening.
