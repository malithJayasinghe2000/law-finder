# RAG Roadmap — how to make this genuinely good

> Companion to [RAG-REVIEW.md](./RAG-REVIEW.md), which is the analysis. This is the plan.
>
> Written 2026-09-12. Ordered so that each stage is safe to start once the previous one is
> done. Effort estimates assume one engineer.

---

## Stage 0 — Stop the bleeding — ✅ **DONE 2026-09-13**

All eight items are fixed, verified against the running service, and asserted by
`scripts/check_security.py` (45 assertions). Three of them were reproduced as live
defects first, because a fix for a bug nobody demonstrated is a fix nobody can trust.

| # | Fix | State |
| --- | --- | --- |
| 1 | Tracing off — `RAG_TRACING_ENABLED=false`, and `config.py` forces the env vars off and removes the API key | ✅ |
| 2 | `secure_filename()` + resolve-and-verify, on **three** upload paths (the roadmap said two) | ✅ |
| 3 | Shared-secret header in a `before_request` hook; set in all **four** Next.js callers via one module | ✅ |
| 4 | `host=127.0.0.1`, `FLASK_DEBUG` default false, gunicorn + `wsgi.py` + `gunicorn.conf.py` | ✅ |
| 5 | Caps on message (4,000 chars), history (10 turns) and body (50 MB) | ✅ |
| 6 | Opaque `error_id` in the body, detail in the log | ✅ |
| 7 | `{"status": "Active"}` never dropped in any fallback | ✅ |
| 8 | `num_ctx` 8192 → 32768, `num_predict` capped at 1536 | ✅ |

### What was reproduced before it was fixed

Not inferred from reading — run against the live service:

```
POST /api/ingest/upload  filename="../../PWNED-PROOF.pdf"   no credential
  -> HTTP 500 (the PDF parse failed)
  -> and the file was written to lawyer-rag/PWNED-PROOF.pdf

     Two directories above data/uploads. The save happens before any validation
     of content, so the 500 is irrelevant — the write already landed. The same
     request with "../../app/core/llm.py" overwrites the service's own source,
     which is arbitrary code execution on the next restart.

GET  error body, no credential
  -> {"error": "Failed to open file
       '/Users/…/Developer/law-finder/lawyer-rag/data/uploads/x.pdf'."}

DELETE /api/documents/<name>  no credential
  -> reached the handler; 404 only because the document did not exist

Startup log
  -> "Running on http://192.168.1.47:5001"   the LAN address, not just loopback
```

### Two things the fix itself taught, both found by running it

**`preload_app = True` segfaults gunicorn.** It was added to make a missing
`RAG_SERVICE_TOKEN` fail at the master rather than crash-loop workers behind an open
port. Gunicorn then logged `Listening at http://127.0.0.1:5001` and killed every worker
with `SIGSEGV` on first request: preloading imports ChromaDB's native stack in the
master and then `fork()`s. **The service looked healthy and answered nothing.** Reverted,
with the reasoning in `gunicorn.conf.py`; the fail-fast is now an assertion in the
gunicorn config module, which the master imports before it binds.

**A broad `except Exception` swallowed werkzeug's own HTTP errors.** The 50 MB body cap
returned 500 instead of 413, because `RequestEntityTooLarge` is raised during body
parsing and every route catches `Exception`. `error_response()` now re-raises
`HTTPException` so Flask's handlers answer.

### Also done, as part of the above

- `scripts/check_security.py` — 45 assertions against a **live** service. Two of them
  (the bind address, and which routes the hook actually covers) cannot be observed any
  other way.
- `scripts/test_langsmith.py` **deleted**. It existed to send a real Sri Lankan legal
  question to LangSmith and print a link to the trace.
- `scripts/test_chat.py` repaired — it pointed at port 5000, so it had been failing to
  connect rather than passing.
- `src/lib/ai/ragService.ts` — one module holding the service address and the
  credential. It also fixes `src/app/api/legal-documents/[id]/route.ts`, which defaulted
  to port **5000** while everything else used 5001, so its corpus enrichment had
  silently never worked.
- `docs/RUNNING.md` — how to run it, and the four things that will confuse you.
- The health check no longer enumerates the host's installed models or its Ollama URL
  to an anonymous caller, and reports `tracing_enabled` so the §3 leak is visible
  without reading code.
- `search_documents` no longer mutates the caller's filter dict (§4.9).

### Still open from §2, deliberately

- **`file_path` in the JSON body of `/api/ingest` and `source_dir` in `/api/ingest/batch`
  are arbitrary local paths.** An authenticated caller can ingest any readable file on
  the host into the corpus and read it back through `/api/documents`. Behind the service
  token this is no longer anonymous, and the scripts depend on it — but it should become
  an allow-listed directory in Stage 3.
- **No rate limiting.** The caps bound one request; they do not bound a thousand. The
  application rate-limits `/api/ai/ask` upstream, which is the path a user reaches.
- **`verify_answer_tool` still manufactures false assurance** (§4.2). It is Stage 1.4,
  and it is a *quality* defect rather than a security one.

---

## Stage 1 — Make the answers trustworthy (1 week)

This is the stage that decides whether a lawyer would use the thing twice.

### 1.1 Build a golden evaluation set — **do this first**

**You cannot safely change anything else until this exists**, including acting on the rest
of this document. Today there is no way to tell whether a change makes answers better.

- 60–100 questions across the corpus you actually hold, each with: the expected section(s),
  a model answer, and a label (`answerable` / `not_in_corpus` / `must_refuse`).
- Include the failures already known: *"my employer fired me without notice"* (must refuse
  — advice, and no employment legislation held), *"recommend a lawyer"* (must refuse), and
  questions whose answer is in a **repealed** section (must not be cited as current).
- Measure four numbers per run: **retrieval recall@k**, **citation accuracy**,
  **faithfulness** (is every claim supported by a retrieved chunk), and **refusal
  correctness**.
- Wire it to a command — `python -m scripts.eval` — and record the numbers in the repo.

> Half of the value here is the `not_in_corpus` cases. The system's most common correct
> answer is *"I do not hold that legislation"*, and nothing currently tests that it says so.

### 1.2 Add a relevance floor and abstain

Drop chunks below a threshold tuned against the golden set. If nothing survives, return a
structured `no_context` result and let the model say so. This closes the *"having sources
is not the same as being sourced"* gap directly.

### 1.3 Fix the citation chain

Have the tools return structured results carried through to the response, instead of
`_extract_sources_from_tool_calls` re-running the search. The citations shown must be the
chunks the model actually read — otherwise the integrity argument is not true.

### 1.4 Delete or rebuild `verify_answer_tool`

As it stands it emits `✅ VERIFIED` on a 0.4 similarity score and ignores `draft_answer`
entirely. **Delete it in Stage 1.** If it comes back, it must fetch the section by exact
metadata match and have a model judge whether the text supports the specific claim,
returning a structured verdict — and it should run *after* generation, in the application's
policy layer, where the existing evaluation already lives.

### 1.4b Fix the knowledge-graph delete (new — `RAG-REVIEW.md` §4.11)

Found while testing the Stage 0 fixes. Ingesting a document and deleting it again removed
**nine nodes and five edges belonging to a different Act**, because entity ids like
`act::ordinance` and `court::high_court` are global while `document_name` is a single
attribute. `DELETE /api/documents/<name>` is therefore lossy for the whole graph, silently.

Make entity-to-document many-to-many: a set of document names per node, with removal
dropping only the membership and deleting the node when the set empties.

**Until this is fixed, back up `data/graph/knowledge_graph.json` before any delete or
re-ingest.** In this repository `data/` is tracked in git, which is what made the loss
recoverable — that is luck, not a backup strategy. See Stage 3.

### 1.5 Derive the corpus list at runtime

One cached call to `get_all_document_names()`, injected into both system prompts and the
router's valid filters. Ingesting an Act then works without editing four files.

### 1.6 Settle the model

Pick one, name it in one place, delete the other three references. Then measure candidates
against the golden set — a 3B model is very unlikely to survive the comparison, and the
default path depends on reliable tool-calling that small models do poorly.

---

## Stage 2 — Make the retrieval good (1–2 weeks)

With an evaluation set in place, these are measurable rather than hopeful. Expect the
largest quality gains here.

| # | Change | Why |
| --- | --- | --- |
| 1 | **Hybrid search** — BM25 alongside dense, fused with Reciprocal Rank Fusion | Legal queries are full of exact strings: `"Section 14(2)(b)"`, `"Act No. 24 of 2007"`. Dense embeddings are weak at exactly this, and it is what lawyers type |
| 2 | **Cross-encoder reranking** — retrieve 30, rerank, keep 6 | Usually the single biggest quality jump in a RAG system. Also *reduces* tokens: fewer, better chunks |
| 3 | **Parent-document retrieval** — match small, return the enclosing section | Fixes mid-section truncation without raising chunk size |
| 4 | **Query expansion** for legal synonyms (`plaint`/`complaint`, `decree`/`judgment`) | Vocabulary mismatch is a known failure mode in legal IR |
| 5 | **Semantic cache** on question embeddings | Repeated questions are common; a hit costs nothing |
| 6 | **Amendment-aware retrieval** — surface the amending provision with the amended section | Already half-built: `amendment_processor.py` and the graph exist. Citing a section without its amendment is a wrong answer that looks right |

---

## Stage 3 — Make it production software (1 week)

| Item | Detail |
| --- | --- |
| **Serving** | gunicorn with a sane worker count; `/api/health` that checks Ollama **and** Chroma, not just process liveness |
| **Hosted inference** | Local Ollama needs a GPU host and is a second thing to operate. A hosted API removes that and makes Stage 1.6 easy. Keep Ollama for local dev |
| **Timeouts** | On the LLM client and on `agent.invoke` — currently only the Next.js 60s timeout bounds anything |
| **Structured logging** | JSON logs with a request id, propagated from the caller |
| **Metrics** | Latency per stage, tool-call counts, token counts, abstention rate, cache hit rate |
| **Self-hosted tracing** | Langfuse, or LangSmith with inputs/outputs masked — and record the sub-processor |
| **Backups** | Chroma and `knowledge_graph.json` are state. Nothing backs them up. Ingestion is expensive to redo |
| **Concurrency** | `_llm_instance`, `_vectorstore_instance` and the graph are module-level singletons. Verify thread-safety under gunicorn before enabling multiple workers |

---

## Stage 4 — Features, in the order I would build them

### 4.1 Corpus breadth — **the highest-value item on this page**

The service holds three consolidated Acts plus the Computer Crimes Act. A practising
lawyer will ask about Land, Labour, Family, Tax and Criminal law within minutes of opening
it. Every one of those is a correct, honest *"I do not hold that"* — and a product that
answers that way repeatedly stops being opened.

**Priority order for Sri Lanka:** Land/Property → Labour → Family → Penal Code & Criminal
Procedure → Tax (Inland Revenue, VAT) → Evidence Ordinance → Rent Act.

Everything else in this section is worth less than this.

### 4.2 Case law and precedent

Sri Lanka Law Reports, Supreme Court and Court of Appeal decisions. `DOCUMENT_CATEGORIES`
already anticipates them. This is what makes the tool interesting to a litigator rather
than useful to a citizen — and it needs a citator ("has this been overruled?") to be
trustworthy.

### 4.3 Sinhala and Tamil

Genuinely underserved, and a real moat. Two prerequisites, in order:

1. **Translate the routing and refusal layers** (§4.8 of the review). Until then the
   honest interim position is to **disable the assistant for `si`/`ta`** rather than run
   it unguarded — the application's policy checks are English-only too, so a Sinhala
   question currently bypasses both the pre- and post-generation checks.
2. A multilingual embedding model, and evaluation in each language.

### 4.4 Section-level permalinks and a document viewer

Every citation should open the exact section in a reader with the amendment history beside
it. This makes citations checkable by the person relying on them, which is the whole point
of citing.

### 4.5 Matter-scoped AI — **for firms, and not before the prerequisites**

A research assistant over the firm's *own* files is the most valuable thing this could
become for a paying practice. It is also the most dangerous:

- `buildModelContext()` on the application side deliberately **has no parameter through
  which matter data could travel**. That absence is a guardrail — removing it is the
  decision, not an implementation detail.
- Needs firm-scoped tenancy in the vector store, a processor agreement covering the model
  provider, and **counsel question 4 answered**.
- Encrypted matter fields would have to be decrypted to be embedded. Where do those
  embeddings live, and who can query them? **An embedding of a privileged document is a
  derivative of a privileged document.**

**Do not start this until Stages 0–3 are done and counsel has answered.**

### 4.6 Drafting assistance

Templates for plaints, affidavits, deeds and MOUs, grounded in the held legislation. High
value to firms, and it pairs with the document-automation module in the main product's
roadmap. Note the line carefully: generating a document a lawyer reviews is a tool;
generating one a citizen files is unauthorised practice.

### 4.7 Proactive legislative monitoring

Watch for amendments and gazette notifications; tell a firm when law they have relied on
changes. Nobody in the market does this well, and it is a renewal reason rather than a
feature.

---

## Summary — the order

```
Stage 0  Security + the LangSmith leak                ✅ DONE 2026-09-13
Stage 1  Evaluation set, then trust fixes             1 week     ← 1.1 before 1.2–1.6
Stage 2  Hybrid search + reranking                    1–2 weeks
Stage 3  Production serving                           1 week
Stage 4  Corpus breadth, then the rest                ongoing
```

**If you only do two things now that Stage 0 is done:**

1. **Build the golden evaluation set** (Stage 1.1). Everything else is guesswork without
   it, and it is the difference between changing the system and improving it. It is also
   the prerequisite for settling the model, which is the single biggest quality lever
   available — see the transcript in `RAG-REVIEW.md` §4.10.
2. **Load more legislation** (Stage 4.1). The most sophisticated retrieval in the world
   cannot answer a question about land law from a corpus that contains no land law.
