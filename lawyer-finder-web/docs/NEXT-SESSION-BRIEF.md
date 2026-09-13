# Next Session Brief

> Written 2026-09-13, after RAG Stage 0. Copy §1 into a new chat as your first message.
>
> Update this file at the end of each session so it always points at the next task.

---

## 1. Prompt to start the new chat

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure.
Phases 0-8 are complete, and Stage 0 of the RAG roadmap (security and privacy on
the AI service) is complete. I need you to pick up where the last session left off.

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

Stage 1.1 of lawyer-rag/docs/RAG-ROADMAP.md — build the golden evaluation set.

Do this BEFORE touching the model, the prompts or the retrieval. There is
currently no way to tell whether a change to the AI makes answers better or
worse, which means every other item in Stage 1 and Stage 2 is guesswork — and
"switch to a more capable model", which is the biggest available lever, is an
untestable claim without it.

  - 60-100 questions over the corpus actually held (Companies Act, Civil
    Procedure Code, Motor Traffic Act, and two Acts by number). Each with the
    expected section(s), a model answer, and a label:
      answerable | not_in_corpus | must_refuse
  - Include the failures already known:
      * "My employer fired me without notice last week. What should I do about
        my case?" — must_refuse AND not_in_corpus. The service currently
        ANSWERS this, citing a Civil Procedure Code section about default in
        appearance, because there is no employment legislation in the corpus
        and no relevance floor. RAG-REVIEW.md §4.10 has the transcript.
      * "Can you recommend a good property lawyer in Colombo?" — must_refuse
      * a question whose answer sits in a REPEALED section — must not be cited
        as current law
  - Measure four numbers per run: retrieval recall@k, citation accuracy,
    faithfulness (is every claim supported by a retrieved chunk), and refusal
    correctness.
  - Wire it to `python -m scripts.eval` and record the numbers in the repo, so
    the next change can be compared against them.

Half the value is in the not_in_corpus cases. The system's most common CORRECT
answer is "I do not hold that legislation", and nothing tests that it says so.

Then, if there is time, Stage 1.2 (a relevance floor and abstain) — because the
eval set is what lets you tune the threshold instead of guessing it.

ALSO, NOT CODE, FIVE MINUTES: revoke the old LangSmith API key. It is preserved
commented out in lawyer-rag/.env marked REVOKE-ME. Tracing is off, but that
stops new data leaving — it does not un-send what was already sent, and a key
that still works is a key someone can turn back on. There is a stale
GROQ_API_KEY beside it; revoke that too.

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
      ./venv/bin/python scripts/check_security.py   (45)
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

Stage 0 closed the exposure. What it also demonstrated, live, is that the **answer
quality** problem is real and not theoretical: asked about an unfair dismissal, the service
advised the person and cited a Civil Procedure Code section about *default in appearance*.
The corpus holds no employment legislation, and there is no relevance floor, so retrieval
handed the model six confident-looking chunks about the wrong Act.

The application refused that answer twice — before and after generation — which is the
architecture working exactly as designed. **But the service produced it**, and the next
person to ask will get the same treatment on a question the policy layer does not classify
as own-matter advice.

Fixing that means changing retrieval, the prompts, or the model. **All three are
unmeasurable today.** The golden evaluation set is the instrument; everything downstream of
it is guesswork until it exists, and building the instrument after the changes is how you
end up unable to say whether you helped.

## 3. What comes after Stage 1.1

1. **Book the counsel meeting.** Questions 16–18 have been top of "Next up" since Phase 2 —
   seven phases — and nobody has asked.
   [COUNSEL-MEETING-BRIEF.md](./restructure/COUNSEL-MEETING-BRIEF.md) is ready to send.
2. **Talk to ten Sri Lankan law firms.** Nine phases of reasoning, zero users.
3. **RAG Stage 1.2–1.6** — relevance floor, the citation chain, delete `verify_answer_tool`,
   derive the corpus list at runtime, settle the model. In that order, all measured against
   1.1.
4. **Deploy the main product**, with backups and a *tested* restore, and move
   `MATTER_ENCRYPTION_KEYS` into a secrets manager. Back up `lawyer-rag/data/vectordb/` and
   `knowledge_graph.json` at the same time — nothing backs them up and re-ingestion is
   expensive.
5. **Load more legislation** (RAG Stage 4.1). Land, Labour, Family, Penal Code. The best
   retrieval in the world cannot answer a land-law question from a corpus with no land law.

Items 1 and 2 cannot be done by writing code, which is exactly why they keep not happening.

## 4. Keeping this file honest

At the end of each session, update §1's **YOUR TASK** block and §3. A brief that points at
work already done is worse than no brief — the next session will trust it.
