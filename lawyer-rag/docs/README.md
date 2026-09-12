# lawyer-rag documentation

The AI assistant behind TheLawyr. A Flask service over ChromaDB + a knowledge graph,
called **only** by the Next.js application server, which applies `src/lib/ai/policy.ts` to
every answer before a user sees it.

| Document | What it is |
| --- | --- |
| **[RAG-REVIEW.md](./RAG-REVIEW.md)** | Full review: architecture, security, answer quality, token cost, privacy. **Read §2 and §3 before deploying anything** |
| **[RAG-ROADMAP.md](./RAG-ROADMAP.md)** | The plan: staged fixes, retrieval improvements, and the feature roadmap |

## Before you touch this service

1. It has **no authentication** and **no rate limiting** today.
2. `FLASK_DEBUG` defaults to `true` and it binds `0.0.0.0`. Do not expose the port.
3. `LANGCHAIN_TRACING_V2=true` in `.env` ships every question and answer to LangSmith.
4. The prompt is **not** the guardrail. The binding rules live in the application, in
   `lawyer-finder-web/src/lib/ai/policy.ts`, and run after generation. Run
   `npm run check:ai` there after any change that affects what this service returns.

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
