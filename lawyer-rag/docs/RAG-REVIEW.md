# RAG System Review — architecture, defects, cost and risk

> A full read of `lawyer-rag` (5,353 lines, 26 Python modules), 2026-09-12.
>
> **Verdict up front: the compliance thinking in this service is genuinely good, and the
> engineering underneath it is not safe to deploy.** There is an unauthenticated remote
> file-write on a service that binds to every network interface with the Flask debugger
> switched on — and every user's legal question is currently being shipped to a US SaaS.
>
> Severity: 🔴 fix before any deployment · 🟠 fix before real users · 🟡 quality · ⚪ later

---

## 1. What the system does

```
Next.js  POST /api/ai/ask   (the only caller — applies src/lib/ai/policy.ts)
   │
   ▼  HTTP, 60s timeout
Flask  POST /api/chat
   │
   ├─ classify_intent()          ── LLM call #1 (or fast regex/phrase path)
   │     6 intents → conversational · clarification_needed · legal_query
   │                 follow_up · situation_report · lawyer_request
   │
   ├─ fast exits: conversational (LLM call) · clarification (canned) · lawyer_request (canned refusal)
   │
   ├─ rewrite_query()            ── LLM call #2, follow-ups only
   │
   └─ ENABLE_AGENTIC_RAG=true (default)
         │
         └─ LangGraph ReAct agent, recursion_limit=10 (~5 tool calls)
               tools: vector_search · graph_lookup · section_lookup_tool · verify_answer_tool
               │
               └─ on ANY exception → falls back and re-runs the whole linear pipeline
```

Retrieval is ChromaDB (`nomic-embed-text`, 768-dim) plus a JSON knowledge graph for
entity expansion. Generation is Ollama, locally.

**The architecture is sound.** Intent routing before retrieval, a ReAct agent over
well-described tools, graph expansion, and a linear fallback is a credible 2026 design.
The problems are in the details.

---

## 2. 🔴 Security — the critical chain

These four findings combine into remote code execution by an unauthenticated attacker.

### 2.1 🔴 Path traversal on document upload

```python
# app/api/ingest.py:241 and :372
pdf_path = str(uploads_dir / file.filename)   # filename is attacker-controlled
file.save(pdf_path)
```

`secure_filename` is **not imported anywhere in the service.** Werkzeug's `save()` does
not sanitise. A filename of `../../../../home/user/.ssh/authorized_keys` or
`../../app/core/llm.py` is written wherever the process can write.

The `.pdf` check on `/api/ingest/upload` is `filename.lower().endswith(".pdf")` — which
`../../../evil.pdf` satisfies. `/api/ingest` has **no extension check at all**.

**Verified, not inferred.** Running the exact expression the route uses:

```
filename='../../../../tmp/pwned.pdf'
  -> resolves: /Users/…/Developer/tmp/pwned.pdf          escapes uploads dir: True

filename='../../app/core/llm.py'
  -> resolves: /Users/…/lawyer-rag/app/core/llm.py       escapes uploads dir: True
```

The second one is the point: **an anonymous caller can overwrite the service's own source
code.** On the next restart that is arbitrary code execution, with no need for the
debugger at all.

### 2.2 🔴 No authentication on any endpoint

A grep for auth, token, api_key, bearer or Authorization across `app/` returns nothing but
unrelated prose. Every route is open:

| Endpoint | What an anonymous caller can do |
| --- | --- |
| `POST /api/chat` | Run unlimited inference on your hardware |
| `POST /api/ingest`, `/api/ingest/upload`, `/api/ingest/amendment`, `/api/ingest/batch` | **Write files anywhere; inject fabricated law into the corpus** |
| `DELETE /api/documents/<path:doc_name>` | **Delete an Act from the corpus** |

Corpus injection deserves its own line: an attacker who can ingest a PDF can author
Sri Lankan legislation that does not exist, and the assistant will then cite it with a
section number and a relevance score. The application's `UNSUPPORTED_CITATION` check
compares prose against *what retrieval returned* — so a fabricated Act **that is in the
vector store passes that check**. This is the one attack that defeats the downstream
policy layer.

### 2.3 🔴 Binds to every interface, contradicting its own comment

`main.py` carries a careful comment — *"This service should not be reachable from the
public internet at all. Bind it to a private interface"* — directly above:

```python
app.run(host="0.0.0.0", port=config.FLASK_PORT, debug=config.FLASK_DEBUG)
```

`0.0.0.0` is every interface. **The comment says one thing and the code does the
opposite**, which is worse than no comment: a reviewer reads the comment and moves on.

### 2.4 🔴 Flask debug defaults to on, and is on in `.env`

`FLASK_DEBUG: bool = os.getenv("FLASK_DEBUG", "true")` — the **default is true**, and
`.env` sets `FLASK_DEBUG=true`.

The Werkzeug debugger exposes an interactive Python console on unhandled exceptions. On a
`0.0.0.0` bind, that is **remote code execution as the service user**, reachable by
anyone who can make the app throw.

`app.run()` is also Flask's development server — single-threaded by default, no
production hardening. It should never serve traffic.

### 2.5 🟠 Internal errors returned to the caller

```python
return jsonify({"error": "...", "details": str(e)}), 500
```

`str(e)` leaks file paths, model names and library internals.

### 2.6 🟠 No request limits anywhere

No cap on `message` length, no cap on `conversation_history` length, no
`MAX_CONTENT_LENGTH` on uploads, no rate limiting. A single caller can send a 10 MB
message or a 500-turn history and occupy the model indefinitely.

> ### The fix, in order
> 1. `secure_filename()` on every upload, plus resolve-and-verify the final path is inside
>    `UPLOADS_DIR` (both checks — `secure_filename` alone has been bypassed before)
> 2. A shared-secret header on every route, checked in a `before_request` hook
> 3. `host="127.0.0.1"`, `FLASK_DEBUG` default `false`, and run under gunicorn
> 4. Cap message length, history length and upload size; rate-limit per caller
> 5. Return an opaque error id, log the detail server-side

---

## 3. 🔴 Privacy — every legal question is being sent to LangSmith

```
.env:  LANGCHAIN_TRACING_V2=true
       LANGCHAIN_API_KEY="lsv2_…"        ← a real key
```

`@traceable` decorates `query_rag(question=...)`, `search_documents(query=...)`, and the
two pipeline functions. LangSmith traces **function inputs and outputs** — so the full
text of every user question, the retrieved legislation, and the generated answer are
transmitted to LangSmith's cloud.

**Why this matters more than it looks.** `app/utils/chat_logger.py` is one of the most
carefully reasoned files in the repository. It explains that question text is sensitive
personal data under the PDPA, that it may be the same material privilege would protect,
and that a second unmanaged copy is *"a liability with no matching benefit"* — so content
logging was removed and the shape kept.

**Then tracing was switched on, and it sends the same content to a third country.** The
local copy was closed with great care and the remote one was opened by an environment
variable.

Concretely this is:

- Sensitive personal data processed with **no documented lawful basis**
- An **undocumented cross-border transfer** — this is live counsel question 19, happening
  now, not hypothetically
- A **sub-processor the firms whose clients use this have never been told about**, and
  which no processor agreement covers

> **Fix: set `LANGCHAIN_TRACING_V2=false` today.** If tracing is wanted, self-host
> Langfuse or run LangSmith with inputs/outputs masked, and record the sub-processor.

---

## 4. 🔴 Answer quality — the defects that produce wrong law

### 4.1 🔴 The context window is too small for the pipeline, and overflow is silent

```
LLM_NUM_CTX = 8192          # the model's whole working memory
TOP_K_RESULTS = 6           # chunks per vector_search
CHUNK_SIZE = 1500           # characters per chunk
```

One `vector_search` returns 6 × 1,500 = **~9,000 characters ≈ 2,300 tokens**.

A ReAct agent re-sends **the entire message list on every step**. After three tool calls
the conversation carries three full tool results:

| Component | ~tokens |
| --- | --- |
| Agent system prompt | 600 |
| Chat history (6 turns) | 600–1,500 |
| `vector_search` result ×3 | ~6,900 |
| `graph_lookup` + `verify_answer_tool` results | ~800 |
| Reasoning turns | ~500 |
| **Total** | **~9,400–10,300** |

**That exceeds 8,192 before the answer is generated.** The prompt is then silently
truncated — no error, no warning, no log line. You do not control what survives, and the
system prompt carrying *"you never advise a person about their own case"* and the citation
rules is part of what may be dropped.

This is the highest-value single fix in the document: **raise `num_ctx` to at least 32k
and cap what enters the context.**

### 4.2 🔴 `verify_answer_tool` does not verify anything

It is bound to the agent and advertised as catching *"hallucinated or misattributed
citations"*. What it actually does:

```python
results = search_documents(query=f"{act_name} {section_ref}", top_k=2, ...)
if best_score >= 0.4:
    verification_results.append(f"✅ '{citation}': VERIFIED (relevance {best_score:.1%})")
```

**A similarity score of 0.4 does not establish that the retrieved chunk *is* the cited
section, nor that it supports the claim.** It establishes that the text is somewhat
semantically near the string "Companies Act Section 14". The tool never compares the
draft's assertion against the section's content — `draft_answer` is accepted as a
parameter and then **never used**.

So the tool emits `✅ ALL CITATIONS VERIFIED` into the model's own context, which raises
the model's confidence in a citation nobody checked. **A verifier that cannot fail is
worse than no verifier.**

It also directly contradicts the conversational prompt, which instructs the model:
*"Never claim to verify or self-check your own citations. You do not."* That line was
written in Phase 5 because the model had been telling users it ran a verification tool
that did not exist. The tool now exists and still does not verify.

> **Fix: delete it, or make it real** — fetch the section by exact metadata match and have
> a model compare the claim against the text, returning a structured verdict.

### 4.3 🔴 A failed filter can return repealed law

```python
except Exception as e:
    logger.warning("Filtered search failed, falling back to unfiltered search")
    results = vs.similarity_search_with_relevance_scores(query=query, k=top_k)
```

The default filter is `{"status": "Active"}`. The fallback **drops it entirely**, so a
filter error makes **repealed sections** eligible to be retrieved and cited as current
law. For a legal assistant that is the worst available failure: confidently stating
repealed legislation, correctly cited.

> **Fix: never drop the status filter.** Fall back to `{"status": "Active"}` alone.

### 4.4 🟠 No relevance threshold — the corpus always "has an answer"

`search_documents` returns the top *k* regardless of score. Ask about family law — which
is **not in the corpus** — and six unrelated Companies Act chunks come back, formatted
under a heading that tells the model *"LEGAL CONTEXT FROM SRI LANKAN LEGISLATION"* with a
relevance figure of, say, 8%.

This is the precise mechanism behind the Phase 5 incident: an invented Employment
Ordinance with six unrelated Companies Act citations attached. **Having sources is not the
same as being sourced**, and there is still no floor.

> **Fix: drop chunks below a tuned threshold; if nothing survives, return "not in the
> corpus" and let the model say so.**

### 4.5 🟠 The sources shown to the user are not the chunks the model read

`_extract_sources_from_tool_calls` walks the agent trace, finds the `vector_search` call,
and **re-runs the search** to rebuild metadata:

```python
if tool_name == "vector_search" and not sources:
    docs = search_documents(query=query, top_k=config.TOP_K_RESULTS, ...)
    sources = format_sources(docs)
```

The citations displayed are therefore a **reconstruction**, not a record. If the corpus
changed, or the fallback branch takes a different path, the user is shown citations for
text the model never saw.

The whole trustworthiness argument — *"a citation comes from retrieval metadata, never the
model, so the model cannot invent an entry"* — depends on those being the actual retrieved
chunks.

> **Fix: have the tool return structured results and carry them through.** Never re-run
> retrieval to describe retrieval that already happened.

### 4.6 🟠 The corpus is hardcoded in four places and will drift

The available legislation is written into: `rag_chain.SYSTEM_PROMPT`,
`legal_agent.AGENT_SYSTEM_PROMPT`, `query_router.ROUTER_PROMPT`, and the `valid_filters`
set. **Ingesting a new Act updates none of them** — the router cannot filter to it, and
both prompts still tell the model it does not hold it.

> **Fix: derive the list at runtime from `get_all_document_names()` and cache it.**

### 4.7 🟡 Four different model names across five files

| Location | Model |
| --- | --- |
| `config.py` default | `qwen3.5:9b` |
| `.env` (live) | `llama3.2:3b` |
| `.env.example` | `gemma4:e2b` |
| `llm.py` docstring | `gemma3:4b` |
| `README.md` | `gemma4:e2b` |

**Nobody can say which model answers a legal question.** The live one is
`llama3.2:3b` — a 3-billion-parameter model, the class that produced the hallucinated
Ordinance in Phase 5. It is also below the size where reliable tool-calling can be
expected, which matters because the whole default path is a ReAct agent.

### 4.8 🟡 English-only routing

`CONVERSATIONAL_PHRASES`, `LAWYER_REQUEST_REGEX`, `CLARIFICATION_TOPICS` and the
clarification-loop guard are all English. The platform ships Sinhala and Tamil. A Sinhala
request for a lawyer does not match the refusal regex and depends entirely on a 3B model
classifying it correctly.

The clarification guard is more brittle still — it string-matches the bot's own previous
English wording (`"could you tell me more"`), so changing that copy silently disables it.

### 4.9 🟡 `search_documents` mutates its caller's dict

`filter_metadata["status"] = "Active"` writes into the dict the caller passed. Callers that
reuse a filter across calls will accumulate keys.

---

## 5. 💸 Token and cost waste — where the money goes

The user asked specifically. Here is every wasteful path found.

### 5.1 Up to 8 LLM calls for one question

| Step | Calls | Note |
| --- | --- | --- |
| `classify_intent` | 1 | skipped only on exact-phrase/regex fast paths |
| `rewrite_query` | 1 | follow-ups only — and passes **full, untruncated history** |
| ReAct agent | up to 5 | `recursion_limit=10` ≈ 5 tool calls + reasoning |
| **Fallback linear pipeline** | +1 | **on any agent exception, the whole pipeline re-runs** |

**The fallback is the expensive one.** Hitting the recursion limit raises, which is caught,
which re-runs retrieval and generation from scratch. The most complex questions — the ones
that exhaust the agent — cost roughly double.

### 5.2 ReAct context growth is quadratic

Every agent step re-sends all prior tool outputs. Three `vector_search` calls at ~2,300
tokens each means the final generation carries ~6,900 tokens of retrieved text, most of it
already reasoned over. This is inherent to ReAct, which is why bounding tool output
matters so much more than it does in a linear pipeline.

### 5.3 Duplicate embedding and retrieval per request

- `_extract_sources_from_tool_calls` **re-runs the vector search** the agent already ran
  (§4.5) — a second embedding and a second query, every request.
- Filtered searches that return `< 2` results **re-run unfiltered** — in `vector_search`,
  in `_query_rag_linear`, and again in the source re-extraction.
- `graph_lookup` runs `find_entities_by_name` + `get_related_entities` for up to 3 terms
  **plus** the entity loop, and the linear path then issues **another** `search_documents`
  per related document (`GRAPH_EXPANSION_K=3`).

### 5.4 Decoration burned as tokens

Every chunk is wrapped in:

```
━━━ SOURCE 1 (Relevance: 73.2%) ━━━
📍 Document: … → Part: … → Chapter: … → Section: …
📋 Type: … | Status: … | Updated: …
────────────────────────────────────────
```

The `─` rule alone is 40 characters, and box-drawing and emoji characters are token-hungry
in most tokenisers. At 6 chunks per search and several searches per question this is
hundreds of wasted tokens per request — and the relevance percentage is information the
model cannot act on.

### 5.5 An LLM call to say "hello"

The fast-path heuristic correctly catches `"hi"`, `"thanks"`, `"ok"` and routes them to
`conversational` **without** the router call — then `generate_conversational_response()`
spends a **full LLM call** producing a greeting. For an exact match against a 25-phrase
set, a canned response is indistinguishable and free.

### 5.6 Unbounded generation

`ChatOllama` is constructed with no `num_predict` (max output tokens) and no timeout. A
model that starts repeating will run until the 60s client timeout, having consumed the
whole window.

> ### Estimated saving
> Fixing 5.1 (canned greeting, cheap router), 5.3 (carry results through) and 5.4 (plain
> formatting) should cut tokens per question by roughly **half**, before any change of
> model — and 5.3 removes a duplicate embedding from **every single request**.

---

## 6. What changes when lawyers use this

The user asked specifically about attorneys using the assistant. Four things change.

**1. The audience can detect errors, and the cost of one rises.** A citizen misled about
the Companies Act is harmed. An attorney who relies on a misquoted section in advice to a
client exposes themselves professionally. **An attorney is entitled to rely on a tool sold
to their practice** — which raises §4.2, §4.3 and §4.4 from quality issues to liability.

**2. Questions stop being generic.** A lawyer asks about the matter in front of them. The
line between "explain section 14" and "does section 14 help my client" is thinner when the
user is a professional — and if the question carries matter facts, those facts are now
flowing through this service, to LangSmith (§3), with no processor agreement covering it.

**3. Matter-scoped AI becomes the obvious next request**, and it is the one thing this
service must not do without design. `buildModelContext()` on the application side takes a
question and the chat's own history and **has no parameter through which matter data could
travel** — that absence is a guardrail. Firm-scoped retrieval needs its own tenancy model,
its own processor agreement, and counsel question 4 answered first.

**4. "I don't hold that legislation" becomes the most common answer.** The corpus is
three consolidated Acts plus the Computer Crimes Act. A practising lawyer will ask about
Land, Labour, Family, Tax and Criminal law within minutes. **The honest refusal is correct
and it is also a product that a lawyer will stop opening.** Corpus breadth is the gap
between a demo and a tool.

---

## 7. Where this sits against industry practice

| Practice | Industry standard | Here |
| --- | --- | --- |
| Retrieval evaluation | A golden Q&A set; measure recall@k, faithfulness, answer relevance; gate releases on it | ❌ None. No way to tell whether a change improves answers |
| Reranking | Cross-encoder rerank after vector search | ❌ Raw vector top-k |
| Hybrid search | BM25 + dense, fused — keyword matters for `"Section 14(2)(b)"` | ❌ Dense only |
| Relevance floor | Threshold, then abstain | ❌ Always returns k |
| Chunking | Structure-aware, with parent-document retrieval | ⚠️ Structure-aware chunker exists — good — but no parent expansion |
| Citation integrity | Span-level attribution to retrieved text | ⚠️ Document-level, and reconstructed (§4.5) |
| Observability | Traced, with PII controls and a retention policy | ⚠️ Traced to a third country with none (§3) |
| Caching | Semantic cache on repeated questions | ❌ None |
| Auth | mTLS or a signed service token between services | ❌ None |
| Serving | gunicorn/uvicorn, health checks, graceful shutdown | ❌ Flask dev server, debug on |
| Evaluation of safety | Adversarial/jailbreak suite run per release | ⚠️ 49 policy cases downstream; none against this service |

**The two that would change the most:** a golden evaluation set, and a reranker. Without
the first you cannot safely change anything — including acting on this document. The
second is typically the single largest quality gain in a RAG system.

---

## 8. What is genuinely good

Worth recording so a future refactor does not undo it:

- **The removals are principled and well-commented.** Web search, practice-area detection
  and lawyer recommendation were deleted with the reasoning left in place, so nobody
  re-adds them by accident. `AGENT_TOOLS` deliberately omits `web_search_tool`.
- **`LAWYER_REQUEST_REFUSAL` is a fixed string, not generated.** *"A refusal that a model
  composes is a refusal that a model can compose its way out of."* Exactly right.
- **The intent router with fast heuristic paths** is a sound design and saves real work.
- **`chat_logger.py`** is a model of how to think about logging sensitive text — which is
  what makes §3 so painful.
- **The structure-aware chunker** splits on legal structure rather than token counts.
- **Defence in depth is understood.** The prompt is explicitly documented as *not* the
  guardrail, with enforcement in the application layer. That is the right architecture.

---

## 9. Findings by severity

| # | Finding | Sev |
| --- | --- | --- |
| 2.1 | Path traversal on upload; `secure_filename` never imported | 🔴 |
| 2.2 | No authentication on any endpoint; corpus injection defeats the downstream citation check | 🔴 |
| 2.3 | Binds `0.0.0.0`, contradicting its own comment | 🔴 |
| 2.4 | Flask debug on by default and in `.env` → RCE | 🔴 |
| 3 | Every question and answer traced to LangSmith cloud | 🔴 |
| 4.1 | `num_ctx=8192` overflows silently; safety prompt may be truncated | 🔴 |
| 4.2 | `verify_answer_tool` manufactures false assurance | 🔴 |
| 4.3 | Filter-failure fallback can return repealed law | 🔴 |
| 4.4 | No relevance threshold — always "finds" an answer | 🟠 |
| 4.5 | Displayed citations are re-run, not recorded | 🟠 |
| 4.6 | Corpus hardcoded in 4 places; drifts on ingest | 🟠 |
| 2.5 / 2.6 | Error detail leak; no request limits | 🟠 |
| 5.x | ~8 LLM calls, duplicate retrieval, decoration tokens | 🟠 |
| 4.7 | Four model names across five files | 🟡 |
| 4.8 | English-only routing on a trilingual platform | 🟡 |
| 4.9 | Filter dict mutated in place | 🟡 |

**Do not deploy this service until §2 and §3 are fixed.** Everything else can follow.

Next: [RAG-ROADMAP.md](./RAG-ROADMAP.md).
