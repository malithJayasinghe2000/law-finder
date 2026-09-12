# RAG Roadmap — how to make this genuinely good

> Companion to [RAG-REVIEW.md](./RAG-REVIEW.md), which is the analysis. This is the plan.
>
> Written 2026-09-12. Ordered so that each stage is safe to start once the previous one is
> done. Effort estimates assume one engineer.

---

## Stage 0 — Stop the bleeding (1–2 days)

**Nothing else should be started before these.** All are small.

| # | Fix | Effort |
| --- | --- | --- |
| 1 | `LANGCHAIN_TRACING_V2=false`. Every legal question is currently leaving the country | 5 min |
| 2 | `secure_filename()` on both upload paths, then resolve the final path and assert it is inside `UPLOADS_DIR` | 30 min |
| 3 | Shared-secret header checked in a `before_request` hook on every route; set it in the Next.js caller | 1 h |
| 4 | `host="127.0.0.1"`; `FLASK_DEBUG` default `false`; run under gunicorn | 1 h |
| 5 | Cap `message` (say 4,000 chars), `conversation_history` (say 10 turns), and `MAX_CONTENT_LENGTH` (say 50 MB) | 1 h |
| 6 | Return an opaque error id; log the detail server-side | 30 min |
| 7 | Never drop `{"status": "Active"}` in the retrieval fallback | 15 min |
| 8 | `num_ctx` → 32768, and `num_predict` → a real cap | 15 min |

```python
# 2 — the whole fix
from werkzeug.utils import secure_filename

safe = secure_filename(file.filename)
if not safe.lower().endswith(".pdf"):
    return jsonify({"error": "Only PDF files are supported"}), 400
dest = (uploads_dir / safe).resolve()
if not dest.is_relative_to(uploads_dir.resolve()):
    return jsonify({"error": "Invalid filename"}), 400
file.save(str(dest))
```

Verified against the live `werkzeug` in `venv/`:

```
'report.pdf'                -> 'report.pdf'        accepted=True
'../../app/core/llm.py'     -> 'app_core_llm.py'   accepted=False   (extension)
'../../../../tmp/pwned.pdf' -> 'tmp_pwned.pdf'     accepted=True    (traversal neutralised)
'evil.pdf.py'               -> 'evil.pdf.py'       accepted=False   (extension)
```

Note the third case: the traversal is flattened into a harmless name inside the uploads
directory, which is the correct outcome. Keep **both** checks — `secure_filename` has had
bypasses historically, and the `is_relative_to` assertion is what makes the guarantee.

```python
# 3 — the whole fix
@app.before_request
def _require_service_token():
    if request.path == "/api/health":
        return
    expected = os.environ["RAG_SERVICE_TOKEN"]          # fail loudly if unset
    if not hmac.compare_digest(request.headers.get("X-Service-Token", ""), expected):
        return jsonify({"error": "Unauthorized"}), 401
```

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
Stage 0  Security + the LangSmith leak                1–2 days   ← nothing before this
Stage 1  Evaluation set, then trust fixes             1 week     ← 1.1 before 1.2–1.6
Stage 2  Hybrid search + reranking                    1–2 weeks
Stage 3  Production serving                           1 week
Stage 4  Corpus breadth, then the rest                ongoing
```

**If you only do three things:**

1. **Turn off LangSmith tracing and fix the upload path.** Today. One is a live data
   breach and the other is a remote file write.
2. **Build the golden evaluation set.** Everything else is guesswork without it, and it is
   the difference between changing the system and improving it.
3. **Load more legislation.** The most sophisticated retrieval in the world cannot answer
   a question about land law from a corpus that contains no land law.
