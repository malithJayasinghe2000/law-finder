# Next Session Brief

> Written 2026-09-12. Copy §1 into a new chat as your first message.
>
> Update this file at the end of each session so it always points at the next task.

---

## 1. Prompt to start the new chat

```
I'm working on law-finder, a Sri Lankan legal platform under a legal restructure.
Phases 0-8 are complete. I need you to pick up where the last session left off.

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
  4. lawyer-rag/docs/RAG-REVIEW.md              full review of the AI service
  5. lawyer-rag/docs/RAG-ROADMAP.md             the staged plan for it

Read further only as needed:
  - lawyer-finder-web/docs/restructure/HOW-IT-WORKS.md   why each legal rule exists,
    in plain language. Read this before writing any feature code.
  - lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md   the hard constraints
  - lawyer-finder-web/docs/PRODUCTION-READINESS.md, REVENUE-MODEL.md

⚠️ IGNORE the four planning documents at the repository root
(project_scope_and_vision.md, mvp_project_plan.md, developer_project_plan.md,
architecture_manual.md). They describe the pre-restructure marketplace —
sponsored listings, commission on fees, reviews, lead generation — all of which
is unlawful in Sri Lanka and was removed. They are marked superseded. Building
from them rebuilds the illegal product.

⚠️ NOTHING IS COMMITTED. The working tree holds ~53 changed and new files:
all of Phase 8 (privacy notice register, the data-rights screens, two
migrations) and ten new documents. Branch is restructure-booking-flow; the last
commit is the Phase 8 brief. Do not run `git checkout .`, `git stash`, or
`git reset --hard` — several sessions of work are uncommitted. Ask me before
any destructive git command.

YOUR TASK THIS SESSION

Start by asking me whether to commit the existing work first. Then do Stage 0 of
lawyer-rag/docs/RAG-ROADMAP.md — the security and privacy fixes. They are the
most urgent thing in the project and are estimated at 1-2 days:

  1. Turn off LangSmith tracing (LANGCHAIN_TRACING_V2=false). Every user's legal
     question and answer is currently being sent to LangSmith's US cloud, with
     no lawful basis and no processor agreement. This is a live data issue.
  2. secure_filename() on both upload paths in lawyer-rag/app/api/ingest.py,
     plus resolve-and-verify the final path is inside UPLOADS_DIR. Right now an
     anonymous caller can overwrite the service's own source file — verified.
  3. A shared-secret header checked in a before_request hook on every route, and
     set it in the Next.js caller (lawyer-finder-web/src/lib/ai/rag.ts).
  4. host="127.0.0.1", FLASK_DEBUG default false, run under gunicorn.
  5. Cap message length, conversation_history length, and MAX_CONTENT_LENGTH.
  6. Return an opaque error id; log the detail server-side.
  7. Never drop the {"status": "Active"} filter in the retrieval fallback —
     today a filter error can return REPEALED law as if it were current.
  8. num_ctx to 32768 and a real num_predict cap. At 8192 the agent's context
     overflows silently and you do not control what survives.

RAG-ROADMAP.md Stage 0 has working code for 2 and 3, already verified against
the werkzeug in lawyer-rag/venv.

WORKING STYLE — learned the hard way over nine phases
  - Verify by RUNNING, not by reading. A green build has hidden an invalid SQL
    migration, a seed broken for two sessions, an AI citing an Act that does not
    exist, star ratings still being collected two phases after being reported
    removed, and a firm-membership system that granted nothing across four
    layers. Drive the actual app.
  - When a test passes, ask whether it describes a real actor. check:privilege
    passed for five phases because a fixture called a paralegal actorRole:
    'LAWYER' — a person who cannot exist.
  - A failing check is not automatically a failing rule. Check for a stale
    Prisma client (npm run db:generate) or a stale .next (rm -rf .next) first.
  - After removing a feature, grep for its callers. After fixing one route,
    check its siblings.
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

From [RAG-REVIEW.md](../../lawyer-rag/docs/RAG-REVIEW.md): the AI service has no
authentication on any endpoint, binds to every interface with the Flask debugger enabled,
and accepts an attacker-controlled filename straight into `file.save()`. Those chain into
remote code execution. Separately, `LANGCHAIN_TRACING_V2=true` is shipping every user's
legal question to a US SaaS.

Everything else in the project — pricing, deployment, features, counsel — can wait a week.
These cannot, because the exposure exists the moment the service is reachable, and one of
the two is leaking data today.

## 3. What comes after Stage 0

In order, from [DIRECTION.md](./DIRECTION.md) and
[RAG-ROADMAP.md](../../lawyer-rag/docs/RAG-ROADMAP.md):

1. **Book the counsel meeting.** Questions 16–18 have been top of "Next up" since Phase 2
   — seven phases — and nobody has asked. [COUNSEL-MEETING-BRIEF.md](./restructure/COUNSEL-MEETING-BRIEF.md)
   is ready to send.
2. **Talk to ten Sri Lankan law firms.** Nine phases of reasoning, zero users.
3. **RAG Stage 1** — the golden evaluation set, then the trust fixes. Nothing else in the
   AI service should change before the evaluation set exists.
4. **Deploy the main product**, with backups and a *tested* restore, and move
   `MATTER_ENCRYPTION_KEYS` into a secrets manager.

Items 1 and 2 cannot be done by writing code, which is exactly why they keep not happening.

## 4. Keeping this file honest

At the end of each session, update §1's **YOUR TASK** block and §3. A brief that points at
work already done is worse than no brief — the next session will trust it.
