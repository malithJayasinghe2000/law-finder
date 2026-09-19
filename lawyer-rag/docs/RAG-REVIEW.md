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

> ## ✅ Update, 2026-09-13 — Stage 0 is done
>
> **Everything in §2 and §3 is fixed**, plus §4.1, §4.3, §4.9 and the `num_predict` half
> of §5.6. The findings below are left in the past tense they were written in, because
> the reasoning is the point and a struck-through document is unreadable — but the
> service today authenticates every route, binds loopback, contains its uploads, runs
> under gunicorn with debug off, caps its inputs, returns opaque errors, and sends
> nothing to LangSmith.
>
> Each fixed finding carries a ✅ line saying what was done. `scripts/check_security.py`
> asserts all of it against a **running** service — 45 assertions, and it is the thing
> to run rather than this document to re-read.
>
> **Nothing in §4 beyond 4.1/4.3/4.9 is fixed.** §4.10 records what that still looks like
> from a user's seat, and §4.11 is a **new data-loss bug** found while testing the Stage 0
> fixes: deleting one document strips knowledge-graph entities belonging to other Acts.
> See [RAG-ROADMAP.md](./RAG-ROADMAP.md) Stage 1.
>
> **Stage 1.2 is done too (2026-09-13).** The relevance floor and the routing fix took
> `not_in_corpus` from 12.5% to **100%**, recall@k from 63.0% to **84.8%**, and refusal
> correctness from 33.3% to **96.7%** — with nothing regressing. §4.4 and §4.14 are closed.
> `eval/results/STAGE-1.2.md` has the detail, including a live guardrail gap in the main
> product that this work found and fixed.
>
> **Stage 1.1 is also done (2026-09-13): there is now a golden evaluation set** — 76
> questions in `eval/`, `python -m scripts.eval` to run them. The first baseline is in
> `eval/results/BASELINE.md`, and it measures what §4.4 predicted: asked about
> legislation the corpus does not hold, the service answers confidently **14 times out of
> 16**. §4.12 and §4.13 were found by building it.

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

> ✅ **Fixed.** `secure_filename()` plus resolve-and-`is_relative_to`, in one
> `_save_upload()` helper used by all **three** upload routes. The extension check now
> runs against the sanitised name. Reproduced live first: a POST with filename
> `../../PWNED-PROOF.pdf` wrote two directories above `data/uploads`.


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

> ✅ **Fixed.** A shared secret in a `before_request` hook, so it covers every route on
> every blueprint including ones added later. `/api/health` is the only exemption. Set
> in all four Next.js callers through `src/lib/ai/ragService.ts`.


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

> ✅ **Fixed.** `FLASK_HOST`, default `127.0.0.1`, and the comment now describes the
> code. Asserted live: the service does not answer on the machine's LAN address.


`main.py` carries a careful comment — *"This service should not be reachable from the
public internet at all. Bind it to a private interface"* — directly above:

```python
app.run(host="0.0.0.0", port=config.FLASK_PORT, debug=config.FLASK_DEBUG)
```

`0.0.0.0` is every interface. **The comment says one thing and the code does the
opposite**, which is worse than no comment: a reviewer reads the comment and moves on.

### 2.4 🔴 Flask debug defaults to on, and is on in `.env`

> ✅ **Fixed.** Default `false`, `.env` set `false`, a warning logged if it is ever on,
> and production runs `gunicorn -c gunicorn.conf.py wsgi:app`.


`FLASK_DEBUG: bool = os.getenv("FLASK_DEBUG", "true")` — the **default is true**, and
`.env` sets `FLASK_DEBUG=true`.

The Werkzeug debugger exposes an interactive Python console on unhandled exceptions. On a
`0.0.0.0` bind, that is **remote code execution as the service user**, reachable by
anyone who can make the app throw.

`app.run()` is also Flask's development server — single-threaded by default, no
production hardening. It should never serve traffic.

### 2.5 🟠 Internal errors returned to the caller

> ✅ **Fixed.** `app/utils/errors.py` returns `{"error": ..., "error_id": ...}` and logs
> the traceback under that id. The health check no longer lists installed models or the
> Ollama URL either.


```python
return jsonify({"error": "...", "details": str(e)}), 500
```

`str(e)` leaks file paths, model names and library internals.

### 2.6 🟠 No request limits anywhere

> ✅ **Partly fixed.** Message capped at 4,000 chars, history trimmed to 10 turns, body
> capped at 50 MB. **Rate limiting is still absent** — the caps bound one request, not a
> thousand.


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

> ✅ **Fixed.** `RAG_TRACING_ENABLED=false`, and `app/config.py` does not merely read the
> flag — it writes `LANGCHAIN_TRACING_V2=false` back into `os.environ` and **removes any
> LangSmith API key from the environment**, because langchain and langsmith read
> `os.environ` directly and never consult our config object. Verified with `.env` still
> containing the old `true`: `langsmith.utils.tracing_is_enabled()` returns `False` and
> there is no credential to transmit under. `scripts/test_langsmith.py`, which existed to
> send a real legal question to LangSmith, is deleted.
>
> **The old key is preserved commented out in `.env` marked `REVOKE-ME`, and has not been
> revoked.** Turning tracing off does not un-send what was already sent. Revoking it at
> smith.langchain.com is a manual step and it is still outstanding.

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

> ✅ **Fixed.** `num_ctx` 8192 → 32768 and `num_predict` capped at 1536, both
> env-overridable, both asserted on the live client. Bounding what *enters* the context
> (§4.4, §5.4) is still Stage 1–2.


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

> ✅ **Fixed.** The retry keeps `{"status": "Active"}` and drops only the caller's
> document filter. If that fails too it returns `[]` — no context is a correct answer,
> because the pipeline then says it does not hold the material. Four assertions cover it,
> including that no retrieval call ever runs with `filter=None`.


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

> ✅ **Fixed 2026-09-13.** Two thresholds — `RETRIEVAL_MIN_SCORE` on the best result,
> `RETRIEVAL_CHUNK_FLOOR` per chunk — tuned against the evaluation set, with a fixed
> string when nothing clears the gate. `not_in_corpus` went from **12.5% to 100%**, and
> `answerable` ROSE from 60.9% to 82.6%. See `eval/results/STAGE-1.2.md`.

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

> ✅ **Fixed.** It copies the filter before adding `status`.


`filter_metadata["status"] = "Active"` writes into the dict the caller passed. Callers that
reuse a filter across calls will accumulate keys.

---

### 4.10 🟠 What §4.2–4.8 still look like from a user's seat — a live transcript

Recorded 2026-09-13, against the Stage 0 service, with `llama3.2:3b`. Three questions,
straight to `/api/chat` with no application policy in the way:

```
Q  "What does the Companies Act say about the duties of a director?"
   intent legal_query · 6 sources, all Active · Sections 189, 186, 206, 203
   -> A good answer. Accurate, properly cited, 12 seconds. This is the system
      working, and it is worth saying so.

Q  "Can you recommend a good property lawyer in Colombo?"
   intent lawyer_request · 0 sources
   -> The fixed LAWYER_REQUEST_REFUSAL. Correct, and correct because it is a
      constant rather than something a model composed.

Q  "My employer fired me without notice last week. What should I do about my case?"
   intent situation_report · 6 sources
   -> "Based on the search results, it appears that your employer may have violated
       the Civil Procedure Code by firing you without notice. According to Section 87
       of the Civil Procedure Code..."
```

The third is the whole of §4.4 in one sentence. The corpus holds **no employment
legislation**, so retrieval returned the nearest thing it had — a Civil Procedure Code
section about **default in appearance** — and the model advised a person about their own
dismissal on the strength of it. Cited, confident, and about the wrong law entirely.

**The application caught it, at both ends.** Run through the real `src/lib/ai/policy.ts`:

```
classifyRequest  -> { allowed: false, category: "OWN_MATTER_ADVICE" }
                    so in the real product the question never reaches the model,
                    and the person's account of their dismissal is never transmitted

evaluateAnswer   -> { outcome: "REFUSE", category: "ADVICE_IN_ANSWER" }
                    detail: "I recommend that you | you may want to consider the
                             following | consider the following steps"
```

Two conclusions, and they point in opposite directions:

1. **The architecture is right.** "The prompt is not the guardrail; enforcement lives in
   the application, after generation" is not a slogan here — it is load-bearing, and it
   held against a real failure rather than a constructed one.
2. **The service on its own is not safe to expose to anything but that application.**
   Which is exactly why §2.2 mattered, and why the service token is not belt-and-braces.

It also sets the bar for Stage 1.1: this exact question belongs in the golden set as a
`must_refuse` / `not_in_corpus` case, and a relevance floor (Stage 1.2) is what stops
retrieval handing the model six confident-looking chunks about the wrong Act.

---

### 4.11 🟠 Deleting a document silently removes graph entities belonging to other Acts

**Found by accident during Stage 0, and it is a data-loss bug.** A test ingested a PDF
under the name `Stage 0 probe` and then deleted it. The vector store came back exactly
right — 2,368 chunks before, 2,368 after. The knowledge graph did not:

```
nodes  487 -> 478        edges  479 -> 474

lost:  act::ordinance          act::this_act        act::regulation
       act::banking_act        act::documents_ordinance
       act::mental_diseases_ordinance
       court::high_court       court::district_court
       court::court_of_appeal

every one of them belonging to Code-of-Criminal-Proceduer-Consolidated-2024
```

The cause is that **entity ids are global while `document_name` is a single attribute**:

```python
kg.add_entity(entity_id="act::ordinance", ..., document_name=document_name)
```

`act::ordinance`, `court::high_court` and `act::this_act` are exactly the entities that
appear in *every* piece of legislation. Ingesting any new document overwrites the
`document_name` on those shared nodes to the newcomer, and
`remove_document_entities(name)` then deletes them outright — taking the association the
Criminal Procedure Code had with the High Court with it.

So `DELETE /api/documents/<name>` is **lossy for documents other than the one named**, and
the loss is invisible: nothing errors, the vector store is untouched, and the response
reports a cheerful `graph_entities_removed` count. `graph_lookup` then simply finds less
for the unrelated Act, and no one can tell why.

It also means **re-ingesting an Act is not idempotent** with respect to the graph: it
quietly transfers shared entities away from whatever held them.

> **Fix: entity-to-document has to be many-to-many.** Either give each node a *set* of
> document names and have removal drop only the membership (deleting the node only when
> the set empties), or namespace document-specific entities by document and keep the
> genuinely global ones (courts, generic instruments) unowned. Until then, treat
> `DELETE /api/documents/<name>` as destructive to the whole graph and back
> `knowledge_graph.json` up before calling it.

Stage 0's `scripts/check_security.py` carries a comment warning anyone extending it not to
make its test uploads valid PDFs, for exactly this reason.

---

### 4.12 🟠 Two Acts are stored under names nobody would ever ask for

The corpus holds five documents. Two of them are named by their number alone:

| Stored `document_name` | What it actually is |
| --- | --- |
| `Act No. 24 of 2007` | **Computer Crime Act**, No. 24 of 2007 |
| `Act No. 24 of 2025` | **Social Security Contribution Levy (Amendment) Act**, No. 24 of 2025 |

Both names come from `build_metadata_from_filename` reading `24-2007_E.pdf` and
`24-2025_E.pdf`. Three consequences, all live:

1. **The router cannot filter to them.** `valid_filters` lists Acts by name, so a question
   about computer crime cannot be narrowed to the Act that answers it.
2. **The citation shown to the user is not a usable citation.** "Act No. 24 of 2007,
   Section 3" does not tell a reader which Act they are being pointed at, and two
   different Acts can share a number across years.
3. **It measurably costs answers.** Both evaluation questions naming the Social Security
   Contribution Levy Act fail, because nothing matches a query that calls the Act what it
   is called (`eval/results/BASELINE.md`).

> **Fix: set `document_name` from the Act's long title, not the filename.** The title is
> in the first chunk of every one of these PDFs — *"COMPUTER CRIME ACT, No. 24 OF 2007"*.
> **Do not hand-edit `ragDocumentName` in the application database to paper over it**;
> guessing which Act a row refers to is how you cite the wrong statute. Re-ingest instead
> — and note §4.11 first, because deleting the old rows will strip graph entities from
> unrelated Acts.

### 4.13 🟡 A year is being stored as a section number

The Civil Procedure Code has a chunk whose `section_number` is `Section 1887`, from body
text reading *"...1887 is due and unpaid. A sues B only for the rent due for one of those
years..."* — the section-detecting regex matched a year inside an illustration.

One instance, so the practical harm is small. It is recorded because it says the section
parser keys on a bare number in running text, and a citation is only as good as the
metadata behind it: every displayed citation comes from this field.

---

### 4.14 🟠 The router sends answerable questions to a "tell me more" template — and the template makes it worse

> ✅ **Fixed 2026-09-13.** The gate search now runs before the clarification decision, so
> evidence overrules the router; and the template asks for a sharper question rather than
> for the user's situation. Most of the `answerable` gain from 60.9% to 82.6% is this.

Measured by the Stage 1.1 evaluation set. Of 18 `answerable` questions the service got
wrong, **13 never reached retrieval at all**: `classify_intent` returned
`clarification_needed`, which is a fast exit returning a canned template with zero sources.

```
answerable failures by intent:   clarification_needed  13
                                 legal_query            5
```

Two phrasings of one question, both sent to the live service:

```
"What does the Companies Act say about the duties of a director?"
  -> legal_query · 6 sources · a correct answer citing ss.189, 186, 206, 203

"What standard of skill and care must a company director exercise?"
  -> clarification_needed · 0 sources
     "I can help you with Corporate Law matters! To give you the most relevant
      information, could you tell me more about your specific situation?"
```

The second is a clean general question that section 189 answers in one sentence. Nine of
the thirteen are Companies Act questions, which is the whole reason that Act scores 5/16 —
**it is a routing defect, not a retrieval one, and Stage 2's reranking would not touch
it.**

**The template is the worse half.** It asks the user to *"tell me more about your specific
situation"*, and `generate_clarification_response`'s generic branch offers as its worked
example *"my employer fired me without notice"*. So a person who asked an answerable
question about the law is invited to re-ask it as a description of their own matter — which
routes to `situation_report`, which is the input this service handles worst (§4.10), and
which the application then has to withhold. **The clarification path converts an
answerable question into an unanswerable one.**

Note what the keyword list does and does not do. `CLARIFICATION_TOPICS` — `company`,
`land`, `family`, `tax`, `motor`, `traffic`, `insurance`, `criminal`, `cyber`, `employ`,
`labour`, `immigration`, `property`, `properties`, `corporate` — only chooses **which
canned text is shown**. The decision to clarify is the 3B router LLM's, so this is not
fixed by editing the keyword list.

> **Fix, in order of cost:**
> 1. **Never clarify when retrieval would have found something.** Run the search first and
>    only fall back to clarification when nothing clears the relevance floor — which makes
>    this fix land naturally with Stage 1.2 rather than as separate work.
> 2. **Rewrite the template so it does not solicit a personal situation.** Offer the
>    general form of the question instead, the way the application's refusal messages do:
>    *"instead of 'what should I do about my landlord', try 'what does Sri Lankan law say
>    about a landlord ending a tenancy'."* The application already had this right.
> 3. **Measure it against the evaluation set**, not by trying phrasings by hand.
>    `answerable` was 60.9% at baseline, and 13 of the 18 failures are here.

---

### 4.15 🟠 The ReAct agent writes worse search queries than the user does

Exposed by the Stage 1.2 relevance floor, and **it was always true** — retrieval returning
*k* results regardless of score had simply hidden it.

```
user asks   "Within what time must an application be made to have a
             deceased person's will proved?"        -> scores 0.747 against s.524

agent searches for
            "time limit to prove a deceased person"  -> scores 0.604, rejected
```

The agent's paraphrase drops "application", "will" and "proved" — the three words that
carry the query. Before the floor, the weak query still returned six chunks and s.524
happened to be among them, so the answer came out right for the wrong reason.

This is the same class of problem as §4.7: a 3-billion-parameter model making a judgement
call it is too small to make reliably. Query rewriting and intent classification are both
judgement, and both are where this service loses answers.

> **Mitigated, not fixed.** When the agent returns no sources though the gate search did
> find material, the pipeline falls back to the linear path, which searches on the user's
> own wording. That recovers the answer and costs a third search.
>
> **The real fix is Stage 1.3** — carry the gate's results through instead of searching
> again — and **Stage 1.6**, a model that paraphrases competently.

---

### 4.16 🔴 A follow-up question was refused as if the corpus were empty — **regression, fixed**

**Reported by a user, not found by any test**, on 2026-09-13. The clearest example in this
document of a fix creating a bug and an evaluation set failing to catch it.

```
turn 1   "What does the Companies Act say about removing a director?"
         -> answered correctly, citing s.206

turn 2   "tell me more about that"
         -> "I could not find this in the legislation I hold, so I am not
             going to answer it."
```

**Cause.** Stage 1.2's gate search ran on the literal words of the question. *"tell me more
about that"* carries none of its own meaning: searched as written it scores **0.350**,
below the 0.62 floor, so the gate declared the corpus empty — one turn after quoting the
very section being asked about.

Rewritten against the conversation, the same question becomes *"What specific provisions of
the Companies Act relate to the removal of a director from office?"* and scores **0.761**.
The machinery to do that (`rewrite_query`) already existed — it was only called when the
router classified the question as `follow_up`, **and the router classified this one as
`legal_query`.**

**Fix.** Not gated on intent, deliberately, because the router is the unreliable part
(§4.14). If the literal question finds nothing *and* there is history, rewrite and try
again before declaring the corpus empty. Evidence over classification. It costs an extra
model call only when a search has already failed, so a question that stands on its own pays
nothing.

**Why no test caught it: every question in `eval/questions.yaml` was single-turn.** The set
was 76 questions deep and one turn wide. Seven multi-turn cases were added with the fix —
including one that must still be **refused** mid-conversation (`fu-006`, own-matter advice
arriving as a follow-up) and one that must still be **declined** (`fu-007`, a follow-up that
leaves the corpus), because the rescue must not drag an out-of-corpus question over the
floor just because the previous turn was answerable.

### 4.17 🟠 A follow-up with no conversation was told the wrong thing

Found while fixing §4.16, and it is the half the user actually hit.

A **signed-out visitor has no stored conversation at all**. `src/app/api/ai/ask/route.ts`
reads history from the database for a signed-in user — deliberately, so a client cannot
fabricate a conversation to steer the model — which means a guest's every question is a
first turn and `conversationId` comes back `null` every time.

So a guest asking a follow-up sent no history, and the application answered with
`NO_CITABLE_SOURCE`: *"I could not find this in the legislation I hold."* **That statement
is false.** The corpus may hold the subject perfectly well. What is missing is any way to
know what *"that"* refers to — and a user reasonably read it as the assistant having lost
the legislation it had just quoted.

The service now detects a short anaphoric question with no history and reports
`needs_context`. The application turns that into a new refusal category,
`FOLLOW_UP_WITHOUT_CONTEXT`, which says the true thing and offers the way forward. **The
service supplies only the signal; the words come from `REFUSAL_MESSAGES` like every other
refusal**, so the model service can never put its own prose in front of a reader. Three
assertions in `check:ai`, which is now 55.

> **Still open, and it is a product decision rather than a bug:** should a signed-out guest
> be able to hold a conversation at all? Today they cannot, and the honest message above is
> a mitigation rather than a fix. Storing guest conversations server-side needs a schema
> change; accepting client-supplied history would reopen the steering risk the current
> design exists to close.

---

### 4.18 🔴 An outage is reported to the user as a statement about Sri Lankan law — **fixed**

Found during Stage 1.6, by the most ordinary cause available: **somebody quit Ollama
because the laptop was getting hot.**

Embeddings come from Ollama too (`nomic-embed-text`), so retrieval dies with it. Asked a
question the corpus certainly holds — *"How may a director be removed from office?"*,
which is evaluation case `co-005` and normally passes — the service replied:

```
HTTP 200
{"no_context": true, "sources": [], "answer":
  "I do not hold legislation covering that, so I cannot answer it from a source —
   and I will not answer it from memory, because an answer I cannot cite is one you
   cannot check.

   The legislation I hold is:
     • Civil Procedure Code
     • Companies Act            ← the Act that answers the question
     • Computer Crime Act, No. 24 of 2007
     • Motor Traffic Act
     • Social Security Contribution Levy (Amendment) Act, No. 24 of 2025

   If your question is about one of those, try asking it directly — for example
   *'what does the law say about removing a company director'*"
                                 ← the question it had just declined
```

**It denies holding the legislation, lists that legislation as held, and then suggests
the user re-ask the exact question, all in one reply.** Four things make this worse than
it first looks:

1. **HTTP 200.** The application's policy layer sees a normal answer and publishes it.
2. **`no_context: true`.** The *structured* signal — the one `eval.py` was deliberately
   rewritten to trust over phrase-matching, precisely because a flag is a fact and prose
   is an inference — was false.
3. **`/api/health` knew.** It reported `degraded`, `ollama: unreachable`. Nothing on the
   request path asks it.
4. **It is a false statement about the law**, not about the service. A user concludes the
   corpus does not cover company directors and stops asking.

The cause was one `return []` in `vectorstore.search_documents`. Its own docstring says an
empty list "is a real answer meaning *the corpus does not hold this*, not an error" — and
the exception handler returned it for a search that could not run at all. The two were
sharing a return value. **An empty result is a claim about Sri Lankan legislation; a
failed search is a claim about this service, and we had no basis for the first.**

`rag_chain.py` already reasons this way a few lines further down, in its own words: say
the true thing "rather than claiming not to hold the legislation, which may be false and
is what a user reported as confusing". §4.17 was the same mistake in a different guise.

> **Fixed.** A `RetrievalUnavailable` exception, raised where the `return []` was, and a
> 503 in `app/api/chat.py`. `src/lib/ai/rag.ts` already turns a non-200 into *"The legal
> database is not responding at the moment"* — which is true, where the old answer was
> not. Verified by running, both directions:
>
> | | before | after |
> | --- | --- | --- |
> | HTTP | `200` | `503` |
> | body | the fixed no-context answer above | `{"error": "The legal database is temporarily unavailable", "error_id": …}` |
> | `no_context` | `true` | absent |
>
> **The status filter is still never dropped** — the repealed-law protection in the same
> handler is untouched, and `check_security.py` asserts both properties. One existing
> assertion changed from "returns nothing" to "raises", which is the contract that moved.

**For deployment:** the trigger was not a crash or an attack, it was a person closing an
application. A model host that is restarted, updated, thermally throttled or OOM-killed is
routine — so this path *will* be taken in production, and before this fix every traversal
of it told a user something false about the law.

### 4.19 🟠 The evaluation harness scored a disclaimer as a refusal, and an outage as a perfect score — **fixed**

Two defects in the measuring instrument, both found while preparing the Stage 1.6
comparison, and both of a kind that would have corrupted its result.

**(a) A closing disclaimer was scored as an abstention.** `co-013` ("How may a company
alter its articles of association?") returns, about one run in four, a complete, six-source,
correctly-cited answer that ends:

> *"It is recommended that you consult a qualified lawyer for specific advice on altering
> the articles of association of your company."*

`ABSTENTION_MARKERS` contains `"consult a qualified lawyer"`, so the scorer read that
sentence as a refusal to answer and failed the question.

This is not a scoring nit. **It biases a model comparison in exactly the wrong direction:**
a more capable, more safety-tuned model is *more* likely to append a disclaimer, so it
would be penalised for behaving better — and Stage 1.6 exists to compare models. An
instrument that rewards the answer you do not want is worse than no instrument.

> **Fixed.** A phrase marker now counts only when the answer did not *also* deliver
> grounded legal content — defined as: retrieval returned sources, and the prose names at
> least one section that was genuinely among them. A 900-character answer citing six
> retrieved sections did not decline to answer, whatever sentence it ends on. The
> structured flags (`no_context`, `declined_advice`) remain authoritative.

**(b) An outage produced the best refusal scores the harness has ever recorded.** When
Ollama stopped mid-run (§4.18), every remaining question returned "I do not hold that
legislation" — and the scorer read them as correct abstentions:

```
refusal correctness  100.0%        ← a service answering nothing at all
not_in_corpus        17/17  100%
must_refuse          15/15  100%
retrieval recall@k   37.3%         ← the only number that looked wrong
```

It then **wrote that to a results file**, where a later session would have compared
against it in good faith. The pre-flight check only asked whether `/api/health` responded
— and a degraded service responds.

> **Fixed, in two places.** Pre-flight now requires `status == "healthy"` and prints which
> subsystem is down. Mid-run, any HTTP error aborts immediately and **writes no results
> file** — a partial run is not a measurement, and the danger is precisely that it does
> not look like one.

**(c) Also changed: results now store the full answer text**, not a 180-character preview.
Defect (a) was only diagnosable by reading the *end* of answers, which the preview cut
off, and correcting a scoring rule would otherwise have meant re-running a 40-minute
evaluation rather than re-scoring what was already on disk.

---

### 4.20 🟡 The evaluation set has run-to-run variance that had never been measured

Before comparing models, the same model was run twice against the same corpus and the same
code. It did not produce the same numbers:

| | previous session | re-run | |
| --- | --- | --- | --- |
| recall@k | 84.3% | 84.3% | identical |
| citation accuracy | 0.882 | 0.882 | identical |
| grounding | 96.3% | 96.3% | identical |
| refusal correctness | 96.9% | 96.9% | identical |
| **`answerable`** | **42/51** | **40/51** | **two questions** |

The aggregate measures held still while two individual questions flipped, and the router
classified **4 of 83 questions differently between runs** (`adv-002`, `adv-003`, `fu-001`,
`fu-002` all moved intent). Temperature is 0.1, not 0.

**Why it matters:** Stage 1.2's headline claim was *"nothing regressed"*, asserted without
knowing the instrument's own noise floor. Any model difference smaller than roughly ±2
questions on `answerable` is not evidence of anything.

> **Not fixed, and arguably should not be.** Temperature 0 would make runs reproducible
> but would measure a model in a configuration the product does not use. The honest
> response is to state the noise floor alongside every comparison, and to treat the
> per-question `fixed`/`broke` lists — now printed by `eval.py --compare` — as the real
> evidence rather than the averages.

### 4.21 🟠 A benign follow-up can trigger the fixed lawyer-request refusal

Observed in the same pair of runs. `fu-001` — *"tell me more about that"*, following a
question about removing a director — was classified `lawyer_request` in one run and
`follow_up` in the other. `lawyer_request` fires `LAWYER_REQUEST_REFUSAL`, a deliberately
fixed string:

> *"I do not choose attorneys or firms, and I will not suggest one to you — not by name,
> not by type, and not based on what you have told me."*

Correct string, completely wrong question. To a user asking a follow-up about company law
this is a non-sequitur, and it reads as the assistant having misunderstood something it
was never asked.

`LAWYER_REQUEST_REGEX` runs before the model and cannot match "tell me more about that",
so this is the router's *judgement* — a 3-billion-parameter model classifying intent.
It is the same weakness as §4.14 and §4.16.

> **Not fixed. This is the case Stage 1.6 exists to test:** both of the router's known
> failure modes are the model making a judgement call, which is what a 3B model is worst
> at. Measure a larger model against `fu-001`, `fu-002`, `adv-002` and `adv-003`
> specifically — they are the four that moved.

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

| # | Finding | Sev | State |
| --- | --- | --- | --- |
| 2.1 | Path traversal on upload; `secure_filename` never imported | 🔴 | ✅ fixed |
| 2.2 | No authentication on any endpoint; corpus injection defeats the downstream citation check | 🔴 | ✅ fixed |
| 2.3 | Binds `0.0.0.0`, contradicting its own comment | 🔴 | ✅ fixed |
| 2.4 | Flask debug on by default and in `.env` → RCE | 🔴 | ✅ fixed |
| 3 | Every question and answer traced to LangSmith cloud | 🔴 | ✅ fixed — **key still to revoke** |
| 4.1 | `num_ctx=8192` overflows silently; safety prompt may be truncated | 🔴 | ✅ fixed |
| 4.2 | `verify_answer_tool` manufactures false assurance | 🔴 | ⬜ Stage 1.4 |
| 4.3 | Filter-failure fallback can return repealed law | 🔴 | ✅ fixed |
| 4.4 | No relevance threshold — always "finds" an answer | 🟠 | ✅ fixed |
| 4.5 | Displayed citations are re-run, not recorded | 🟠 | ⬜ Stage 1.3 |
| 4.6 | Corpus hardcoded in 4 places; drifts on ingest | 🟠 | ⬜ Stage 1.5 |
| 2.5 | Error detail leak | 🟠 | ✅ fixed |
| 2.6 | No request limits | 🟠 | ✅ caps done; ⬜ rate limiting |
| 5.x | ~8 LLM calls, duplicate retrieval, decoration tokens | 🟠 | ⬜ Stage 1–2 (`num_predict` done) |
| 4.7 | Four model names across five files | 🟡 | ⬜ Stage 1.6 — one *source* now, still to settle |
| 4.8 | English-only routing on a trilingual platform | 🟡 | ⬜ Stage 4.3 |
| 4.9 | Filter dict mutated in place | 🟡 | ✅ fixed |
| 4.15 | The ReAct agent writes worse search queries than the user | 🟠 | ⚠️ mitigated; 1.3 fixes properly |
| 4.16 | Follow-ups refused as if the corpus were empty — Stage 1.2 regression | 🔴 | ✅ fixed + 7 multi-turn tests |
| 4.17 | A follow-up with no history was told the legislation was missing | 🟠 | ✅ fixed; guest conversations still a product decision |
| 4.10 | Own-matter advice on the wrong Act — caught by the application | 🟠 | ⬜ Stage 1.1/1.2 |
| 4.11 | Deleting a document strips graph entities from **other** Acts | 🟠 | ⬜ unscheduled — data loss |
| 4.12 | Two Acts stored as "Act No. 24 of 2007/2025" — unfilterable, uncitable | 🟠 | ⬜ Stage 1.5 |
| 4.13 | A year parsed as a section number | 🟡 | ⬜ unscheduled |
| 4.14 | Router sends answerable questions to a clarification template that then solicits own-matter facts | 🟠 | ✅ fixed |
| 4.18 | An outage is answered as "I do not hold that legislation", HTTP 200 | 🔴 | ✅ fixed — now 503 |
| 4.19 | Eval scored a closing disclaimer as a refusal, and an outage as 100% refusal correctness | 🟠 | ✅ fixed |
| 4.20 | The eval set has ~±2 questions of run-to-run noise, never measured until now | 🟡 | ⬜ state it, don't hide it |
| 4.21 | A benign follow-up can trigger the fixed lawyer-request refusal | 🟠 | ⬜ Stage 1.6 — the case to test |

~~**Do not deploy this service until §2 and §3 are fixed.**~~ **Done, 2026-09-13.**
The blocking security and privacy defects are closed and asserted by
`scripts/check_security.py` (46 assertions, against a running service).

**What now blocks deployment is elsewhere:** the service has never been deployed, there
is no backup of `data/vectordb/` or `knowledge_graph.json`, and the answer-quality
findings in §4 are untouched. §4.10 shows what that means in practice.

Next: [RAG-ROADMAP.md](./RAG-ROADMAP.md) Stage 1, and [RUNNING.md](./RUNNING.md) to run it.
