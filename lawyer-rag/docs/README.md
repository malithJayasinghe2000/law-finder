# lawyer-rag documentation

The AI assistant behind TheLawyr. A Flask service over ChromaDB + a knowledge graph,
called **only** by the Next.js application server, which applies `src/lib/ai/policy.ts` to
every answer before a user sees it.

| Document | What it is |
| --- | --- |
| **[RUNNING.md](./RUNNING.md)** | How to run it, and the four things that will confuse you. **Start here** |
| **[RAG-REVIEW.md](./RAG-REVIEW.md)** | Full review: architecture, security, answer quality, token cost, privacy |
| **[RAG-ROADMAP.md](./RAG-ROADMAP.md)** | The plan. Stage 0 is done; Stage 1 is the evaluation set |

## Before you touch this service

1. **Run `python scripts/check_security.py` after changing `main.py`, anything in
   `app/api/`, or `config.py`.** 45 assertions, against a *running* service. A green
   import proves none of them.
2. Every route except `/api/health` needs `X-Service-Token`. The value must match
   `RAG_SERVICE_TOKEN` in `lawyer-finder-web/.env`. **If the assistant is mysteriously
   unavailable, check that first** — a mismatch looks exactly like the service being down.
3. It binds `127.0.0.1` and `FLASK_DEBUG` is false. Keep both. Run it under
   `gunicorn -c gunicorn.conf.py wsgi:app`, one worker, and **never** set
   `preload_app = True` — it segfaults (see RUNNING.md).
4. **Tracing is off and turning it on has a legal precondition**, not just a flag. See
   [RAG-REVIEW.md §3](./RAG-REVIEW.md).
5. The prompt is **not** the guardrail. The binding rules live in the application, in
   `lawyer-finder-web/src/lib/ai/policy.ts`, and run after generation. Run
   `npm run check:ai` there after any change that affects what this service returns.
   [RAG-REVIEW.md §4.10](./RAG-REVIEW.md) is a live transcript of that layer earning its
   keep — the service advised someone about their own dismissal, citing the wrong Act,
   and the application refused it at both ends.

## The rules this service exists inside

- It explains what the law says. It **never** advises anyone about their own case.
- It **never** surfaces a practitioner — not by name, not by category, however asked.
  `LAWYER_REQUEST_REFUSAL` is a fixed string on purpose: a refusal a model composes is a
  refusal a model can compose its way out of.
- Citations come from **retrieval metadata, never the model**.
- **No matter data ever reaches it.** `buildModelContext()` on the application side takes a
  question and the chat's own history and has no parameter through which matter data could
  travel. That absence is a guardrail.

Full reasoning: `lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md` (rule 6).
