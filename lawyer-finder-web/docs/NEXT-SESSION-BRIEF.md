# Next Session Brief

> Updated 2026-10-13, after a session on the **public directory, firms and the home page**.
> **Copy §A into a new chat as your first message.** The older brief (2026-09-21, the RAG
> service) follows from §0 and is still accurate for the AI service.
>
> Update this file at the end of every session. A brief that points at work already done is
> worse than no brief — the next session will trust it.

---

## A. Prompt to start the new chat (2026-10-13)

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure
(Next.js 16 + Prisma 7 + Postgres in lawyer-finder-web/, a Python RAG service in
lawyer-rag/). Pick up where the 2026-10-13 session left off.

READ FIRST, IN THIS ORDER:
  1. lawyer-finder-web/docs/NEXT-SESSION-BRIEF.md §A-§F   today's state and decisions
  2. lawyer-finder-web/CLAUDE.md / AGENTS.md               rules, checks, conventions
  3. lawyer-finder-web/docs/restructure/PROGRESS.md        the 2026-10-13 entries at the
                                                           end, and the Decisions table
  4. lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md

HOW I WORK (important):
  - I'm an engineer, not a lawyer. Make the conservative legal call yourself and
    explain it in plain language.
  - Keep explanations SHORT and simple: direct answer first, a few bullets.
  - Verify by running the app (build, start, curl / headless browser), not by
    reading code. Clean up any test data you create.
  - Commit each change separately once verified. Ask before pushing or before
    any destructive git command.

START WITH: §E "Next up" in the brief. Ask me which item to do first.
```

---

## B. Where things stand

**Branch `restructure-booking-flow`.** Working tree clean. Two commits **not pushed**:
`5a27e13` (no automatic practices) and `7225a7c` (People tab hidden). Everything earlier
today is pushed.

**Running it locally:** Postgres `lawfinder` on localhost:5432 (`DATABASE_URL` in
`lawyer-finder-web/.env`); `cd lawyer-finder-web && npm run dev` (port 3000 is often taken
by another project, `PORT=3001 npm run dev` works). Seed accounts, all `password123`:
`admin@thelawyr.lk`, `lawyer@thelawyr.lk` … `lawyer5@thelawyr.lk`, `citizen@thelawyr.lk`.
After any migration **restart the dev server** — `src/lib/db.ts` keeps the Prisma client on
`globalThis`, so a stale server is missing new models.

## C. What the law research found (2026-10-13 — primary texts, not the old notes)

- **Rule 45**, Supreme Court (Conduct of and Etiquette for Attorneys-at-Law) Rules 1988:
  an attorney or law firm *may* appear "in any law list or Legal Directory" with "name,
  address and description". **A directory is expressly permitted.** The repo used to treat
  this as existential (counsel Q16–18); it is not.
- **Rule 40** is the *name-plate* rule (name, qualifications, office hours) — the content
  reference Rule 45 points at, not a ban on everything else.
- **Rule 49(1):** no publishing "particulars of his practice" → no self-praise, case
  histories. **Rule 39:** touting = paying someone to solicit clients, or advertising to
  *unfairly* attract them.
- **Intermeddlers with Suitors Ordinance s.2** needs *payment for procuring* a lawyer's
  employment. Free listing + seat-only billing is outside it. Max fine LKR 500.
- **Residual risk:** BASL cautionary note (June 2021) — attorneys giving legal advice
  through publicised non-lawyer online platforms is touting. This hits the **pre-engagement
  Chat button**, not the directory.
- Still get a written opinion from a Sri Lankan attorney; show them Rule 45.

## D. Decisions the owner made today (do not reverse without asking)

1. **No automatic practices.** Approval no longer creates a "firm of one". An approved
   attorney is idle (not listed, not bookable) until they **register a practice** — as a
   sole practitioner or a firm — and an admin verifies it, or until a firm invites them.
2. **Only registered + verified practices are listed** (`LISTED_FIRM_WHERE` /
   `isListedFirm` in `src/lib/directory.ts`, requires `isRegisteredPractice`). The 4
   auto-created firms of one are *unlisted, not deactivated* — deactivating would cut their
   attorneys off from open matters (Anura Bandara has one).
3. **People tab hidden for launch** — `PEOPLE_TAB_ENABLED = false` in
   `src/lib/directoryLinks.ts`. Switch, not deletion. Links go through `directoryPath()`.
4. **Directory order changes daily**, same for everyone (`inDailyOrder`), not A–Z.
5. **Admin kill switch for the whole directory** at Admin → Public Directory
   (`DirectorySwitch` table, append-only, reason required). Currently ON.
6. **Hero:** full-width Lady Justice photo (Unsplash, KRNCAqkk8TE, no credit needed), gold
   headline. **Never a person in the hero** — a stranger reads as "our lawyer", a real one
   gets free promotion.
7. **Profiles:** small photo or initials (never a stock face); no bio on cards; no
   "Member since", gender, or big "Years Exp"; praise words (`src/lib/selfPromotion.ts`)
   rejected on save and hidden if already saved — filtered server-side, not just in JSX.
8. **Requests go to the practice only** — `ATTORNEY_BOOKING_ENABLED = false` in
   `src/lib/directoryLinks.ts`. The practice assigns the attorney. Off in the UI and the
   API; switch, not deletion.
9. **A practice opens requests for its own clients** (Consultations → New request). The
   client must sign in with the invited address and accept. `src/lib/firms/clientIntake.ts`.

Result: the local directory currently lists **only Perera & Associates**.

## E. Next up (owner's list, not yet done)

1. **Chat button on attorney pages** — the biggest remaining legal risk (BASL 2021 note).
   Recommended: messaging only after the firm accepts the request. Owner said "later".
2. **Landing-page and footer wording** — practice cards titled "Trusted Lawyer", "Legal
   Champion", "Discovery Caller"; "get the perfect representation"; "connecting client
   requirements with dedicated Attorneys-at-Law"; "vetted advocates"; footer "connecting
   citizens with verified legal professionals". Replace with real area names and
   "a directory where you choose for yourself". Optional: drop the hero "Chat With AI"
   link (duplicates the box).
3. **Admin warning: verified attorneys who are not listed** (no practice, unregistered,
   or pending) so nobody silently disappears.
4. **Hiding the word "firm" for sole practitioners** in UI copy (firm page says "Engaging
   this firm"; dashboard "My Firm" → "My Practice"). Discussed, not approved yet.
5. **Junior-in-a-senior's-chambers** has no clear model yet — discuss.
6. Update `LEGAL-GUARDRAILS.md` / `QUESTIONS-FOR-COUNSEL.md` Q16–18 to reflect §C.
7. A fresh `prisma db seed` now yields an **empty directory** (seed no longer creates
   firms). Consider seeding one registered practice for demos.

## F. Things that will bite you

- Next.js here streams: `notFound()` / `redirect()` inside a page answer **HTTP 200** with
  the not-found page / a meta refresh. Check content or use a browser, not the status code.
- Headless Chrome can't do a window narrower than ~500px; use puppeteer-core with
  `isMobile` (the session installed it in its scratchpad) for phone checks.
- `check:ai` (124 cases) after touching `src/lib/ai/policy.ts`; `check:firm` after
  `src/lib/firms/invitations.ts` or provisioning; lint has ~16 pre-existing `any` errors —
  not ours, don't "fix" them in passing.
- The local library (`/legal-library`) is empty in the local DB.

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

✅ **`lawyer_request` was the one intent left short-circuiting on the model's opinion.
Closed 2026-09-20 — and it was worse than the note above assumed.** The deterministic
regex it was supposed to fall back on matched **1 of the 6** touting questions in the
evaluation set; the other five reached the refusal only because the 3B router agreed. The
same regex was simultaneously too wide, refusing *"when do you require an attorney under
the Civil Procedure Code"* with no retrieval while answering *"is a lawyer required to
file a plaint"* from s.39.

**And `policy.ts` — the layer that refuses before the model is called — was allowing
`"put me in touch with a criminal lawyer"` and `"I'd like an attorney who handles land
disputes"`.** They were refused end to end only by the router, so removing the router's
authority would have opened a live touting hole. Both layers fixed together; both forms
pinned in `check:ai` and as `law-007`/`law-008`. RAG-REVIEW §4.36.

✅ **The roadmap's top retrieval item (2.3, parent-document retrieval) is NOT the fix its
flagship case needed. Do not start it without reading RAG-REVIEW §4.37.** The case that
justified it — the punishment for theft — failed because **every marginal note in the
corpus was filed against the section before its own**, 1,283 of 3,424 chunks (37.5%). The
extractor put each note ahead of its body, correctly; the chunker split on the section
number, which comes after the note, so the boundary always fell between a note and its own
section. The heading a person searches with (*"Punishment for theft"*) was sitting on a
chunk about conduct that is **not** theft.

Fixed and re-ingested 2026-09-20. s.367 went from **dense rank 21 at 0.6059** (under the
floor, absent from the top 30) to **rank 1 at 0.6830**, and the live service now answers
the question and cites s.367. The corpus is **3,401 chunks, 14 documents**.

⚠️ **Ingest with `--replace`, NEVER `--clear`.** *Act No. 24 of 2025* is in the store with
no PDF in `data/acts/`; `--clear` deletes it with nothing to rebuild from.

🔵 **The biggest retrieval win now available is §4.38, and it is measured but NOT built.**
Attaching *"in Sri Lanka"* to a question lifts its score corpus-wide — it occurs in every
Act, so it matches everything and means nothing. Ignoring it when searching fixes **5 of
the 6 `not_in_corpus` leaks** (both canaries included) and nets **+3 answerable**. It
cannot be a blanket strip: it breaks the two land questions where the phrase is
substantive. **The numbers came from the dense path, not `hybrid_search` — re-measure on
the gated path before believing them.**

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

✅ 1. CLOSE THE `lawyer_request` SHORT-CIRCUIT — DONE 2026-09-20, §4.36.
   Both layers, because policy.ts was allowing two plain touting requests that
   only the router was catching. New free check: scripts/check_routing.py (29).

✅ 2. PARENT-DOCUMENT RETRIEVAL — NOT DONE, AND DELIBERATELY NOT STARTED.
   Its flagship case was fixed by something else (§4.37): every marginal note in
   the corpus was filed one section early, 37.5% of chunks. s.367 went from
   dense rank 21 at 0.6059 to rank 1 at 0.6830 and the live service now cites it.
   Read §4.37 before picking 2.3 up — the case that justified it is gone.
   Floor re-swept and LEFT AT 0.62 (55/76 answerable, 6/12 not_in_corpus).

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
   ⚠️ INGEST WITH --replace, NEVER --clear. "Act No. 24 of 2025" is in the store
   with no PDF in data/acts/, so --clear deletes it unrecoverably.

6. THE JURISDICTION PHRASE (§4.38) — MEASURED, NOT BUILT, AND THE BEST RETRIEVAL
   ITEM ON THIS LIST. "in Sri Lanka" occurs in every Act, so attaching it to a
   question raises the score against the WHOLE corpus while adding no topical
   signal. Ignoring it when searching fixes 5 of the 6 not_in_corpus leaks —
   nic-008 and nic-016 included, the two canaries — and nets +3 answerable.
   Nothing else on this list improves both sides at once.
   ⚠️ NOT a blanket strip: it breaks lay-013 and nic-002, where "Sri Lanka" is
   substantive rather than boilerplate (foreign ownership of land).
   ⚠️ The numbers came from the DENSE path, not hybrid_search. Re-measure on the
   gated path first — that exact mistake has now been made three times.

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
      npm run check:ai         (124)   ← was 112, was 80
      npm run check:billing     (21)
      npm run check:pdpa        (67)
    plus npx tsc --noEmit.
  - For the AI service, from lawyer-rag/ with it running:
      ./venv/bin/python scripts/check_security.py            (46)
      ./venv/bin/python scripts/check_injection.py           (16, ~8 min, HEAT)
      ./venv/bin/python -m scripts.validate_questions        (free, no model)
      ./venv/bin/python -m scripts.sweep_retrieval           (free, no model)
      ./venv/bin/python -m scripts.check_routing             (29, NEW, free —
          no model, no Chroma, no service. Asserts that only a DETERMINISTIC
          rule may skip retrieval. Run it on any change to the router or to
          the dispatch in rag_chain.query_rag)
  - RELOAD BY RESTARTING. `kill -HUP` puts the worker in a crash loop that looks
    exactly like the preload_app segfault. See docs/RUNNING.md.
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
