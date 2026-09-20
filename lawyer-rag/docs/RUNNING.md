# Running the RAG service

> Written 2026-09-13, at the end of Stage 0. Everything here was run, not drafted.

---

## The short version

```bash
cd lawyer-rag
source venv/bin/activate

# Production-shaped. This is how it should run anywhere that is not your laptop.
gunicorn -c gunicorn.conf.py wsgi:app

# Development. Same code, Flask's dev server, auto-reload.
python -m app.main
```

Then, from `lawyer-finder-web/`, `npm run dev`. The application is the only caller.

---

## First-time setup

### 1. Dependencies

```bash
cd lawyer-rag
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Ollama

```bash
ollama serve                      # leave running

# Read the names from .env rather than typing them, so this page can never
# disagree with what actually runs.
ollama pull "$(grep '^LLM_MODEL=' .env | cut -d= -f2-)"
ollama pull "$(grep '^EMBEDDING_MODEL=' .env | cut -d= -f2-)"
```

> **Which model?** `LLM_PROVIDER` and `LLM_MODEL` in `.env`, and nowhere else.
> `config.py` reads them and `app/core/llm.py` builds the client. The README, two
> config files and a docstring used to name four different models between them, so
> nobody could say which one a user's question actually reached; Stage 1.6 settled
> that, and the way it stays settled is that no other file names a model.
>
> **Only Ollama needs a pull.** `LLM_PROVIDER=google` uses a hosted API — and sends
> the full text of every question out of Sri Lanka. That is a cross-border transfer
> and an undisclosed sub-processor until someone discloses it. Read the
> preconditions in `app/core/llm.py._build_google` first; they are not optional and
> they are not code.

### 3. The service token — **required, the service will not start without it**

Generate one:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Put the **same value** in both places:

| File | Variable |
| --- | --- |
| `lawyer-rag/.env` | `RAG_SERVICE_TOKEN=<value>` |
| `lawyer-finder-web/.env` | `RAG_SERVICE_TOKEN="<value>"` |

Every route except `/api/health` requires it as an `X-Service-Token` header. Miss it
and the service answers `401`; the application turns that into *"The legal database is
not responding at the moment"* and a `503`, which is graceful but looks exactly like
the service being down. **If the assistant is mysteriously unavailable, check that the
two tokens match before anything else.**

### 4. Ingest the corpus

```bash
python -m scripts.ingest_all --clear
python -m scripts.test_query
```

---

## Checking it works

```bash
# Liveness. The one route that needs no token.
curl -s localhost:5001/api/health | python -m json.tool

# The security assertions, against the running service. 45 of them.
python scripts/check_security.py

# The HTTP endpoints, end to end, with real questions.
python scripts/test_chat.py
```

`check_security.py` is the one to run after touching `main.py`, anything in `app/api/`,
or `config.py`. It asserts the Stage 0 properties — authentication on every route, the
loopback bind, upload containment, the request caps, opaque errors, tracing off, and
that retrieval never drops the `status: Active` filter.

---

## Things that will confuse you

### The port is 5001, not 5000

On macOS, port 5000 is AirPlay Receiver, and it **answers** — so a caller pointed at
5000 gets a response that is not this service. `src/app/api/legal-documents/[id]/route.ts`
defaulted to 5000 until Stage 0, which is why its corpus enrichment silently never
worked. The default now lives in one place, `src/lib/ai/ragService.ts`.

### Do not set `preload_app = True` in the gunicorn config

It segfaults. Verified: gunicorn logs `Listening at http://127.0.0.1:5001`, then
`[WARNING] Worker (pid:…) was sent SIGSEGV!` on every request, in a crash loop.
Preloading imports ChromaDB's native stack in the master and then `fork()`s, and the
child does not survive it. **The service looks healthy — open port, clean startup log —
and answers nothing.** The comment in `gunicorn.conf.py` says this too.

### Reload by restarting, not with `kill -HUP`

To pick up a change under `app/**`, **stop the service and start it again**.

`kill -HUP <master>` is gunicorn's graceful reload and it does not work here. It
puts the worker into a crash loop — a new worker pid every three or four
seconds, `/api/health` never answering — which looks exactly like the
`preload_app` segfault below and is not the same thing. Observed 2026-09-20:

```
t=4s   pids: 71093 5585   health:
t=8s   pids: 71093 5720   health:
t=12s  pids: 71093 5833   health:
```

The master survives, so the port stays open and the service still looks up. A
clean stop and start of the identical code booted first time and answered in
145 ms.

The likely cause is the same one behind every other rule on this page: ChromaDB
holds the store, the reloading worker and the outgoing worker overlap, and two
clients on one directory is the thing this service cannot do. **Do not debug it
by importing `app.core.rag_chain` in a second shell while the service is
running** — that is a second Chroma client too, and it makes the symptom worse
rather than explaining it. Stop the service first; `get_vectorstore()` is lazy,
so an import on its own is cheap once nothing else holds the directory.

### One gunicorn worker, on purpose

`app/core/llm.py`, `app/core/vectorstore.py` and `app/core/graph_store.py` each hold a
module-level singleton, and the knowledge graph is mutated during ingestion and saved
to a single JSON file. Two workers means two ChromaDB clients on one directory and two
processes writing `knowledge_graph.json`. Concurrency is a Stage 3 item; until it is
done, `workers = 1` is the honest setting. Requests are slow because inference is slow —
the lever is `timeout`, not `workers`.

### Running the service dirties your git tree

`lawyer-rag/data/` is **tracked in git** — the ChromaDB store, the HNSW index binaries and
`knowledge_graph.json`. Simply starting the service touches `chroma.sqlite3`, so
`git status` will show it modified after any run, with no change to the corpus.

```bash
# confirm the corpus is logically unchanged before assuming the worst
curl -s -H "X-Service-Token: $RAG_TOKEN" localhost:5001/api/documents \
  | python -c "import json,sys; print(json.load(sys.stdin)['collection_stats'])"

# then discard the churn
git checkout -- lawyer-rag/data/
```

**Two things follow from this, and they pull in opposite directions.**

It is why an accidental deletion during Stage 0 was recoverable at all — the knowledge
graph was restored straight from `HEAD` after an ingest-and-delete probe stripped nine
nodes belonging to the Criminal Procedure Code (`RAG-REVIEW.md` §4.11). **That was luck,
not a backup.**

It is also a bad place for a live database: a 21 MB binary in git, rewritten whenever the
service runs, that nobody can diff. The real answer is to stop tracking `data/` and back it
up properly — Stage 3 — but **do not untrack it before a backup exists**, because today
git is the only copy there is.

### `FLASK_DEBUG` must stay false

The Werkzeug debugger opens an interactive Python console on any unhandled exception.
Anyone who can reach the port and make the app throw gets a shell as the service user.
It defaulted to `true` and `.env` set `true` as well, on a `0.0.0.0` bind. `main.py`
now logs a warning if you turn it on.

### The service binds to 127.0.0.1 and should stay there

The only legitimate caller is the Next.js server. `FLASK_HOST` exists so a deployment
can bind a private interface, not so it can bind a public one.

---

## Tracing is off, and turning it on has a precondition

`RAG_TRACING_ENABLED=false`. When it was on, LangSmith received the full text of every
question, the legislation retrieved for it, and the answer generated — sensitive
personal data, no lawful basis, an undocumented transfer out of Sri Lanka, and a
sub-processor no firm was told about.

`app/config.py` does not merely read the flag; it writes `LANGCHAIN_TRACING_V2=false`
back into the environment and removes any LangSmith API key, because langchain and
langsmith read `os.environ` directly and never consult our config object.

Before turning it on: self-host the collector (Langfuse) or mask inputs and outputs,
and record the sub-processor in
`lawyer-finder-web/docs/restructure/DATA-INVENTORY.md`.

---

## Deploying it (not done yet)

Not deployed anywhere. When it is, the shape is:

- `gunicorn -c gunicorn.conf.py wsgi:app` under a process manager, on a private network
- `/api/health` as the readiness probe — it checks Ollama **and** Chroma, not just
  process liveness
- `RAG_SERVICE_TOKEN` from a secrets manager, matched on both sides
- **Back up `data/vectordb/` and `data/graph/knowledge_graph.json`.** Nothing backs
  them up today and re-ingestion is expensive. See `RAG-ROADMAP.md` Stage 3.
- Hosted inference instead of local Ollama, which needs a GPU host and is a second
  thing to operate — Stage 3, and it makes Stage 1.6 easy
