# LawyerAI RAG System

A Python RAG (Retrieval-Augmented Generation) service holding Sri Lankan legislation.
It is called **only** by the Next.js application server, which applies
`lawyer-finder-web/src/lib/ai/policy.ts` to every answer before a user sees it.

> **Read [docs/RUNNING.md](./docs/RUNNING.md) before running this.** It covers the
> service token (without which nothing works), why the port is 5001, and the gunicorn
> setting that silently segfaults.
>
> **[docs/RAG-REVIEW.md](./docs/RAG-REVIEW.md)** is the full review of what is good here
> and what is not; **[docs/RAG-ROADMAP.md](./docs/RAG-ROADMAP.md)** is the plan.

## Architecture

- **LLM**: Ollama, local inference. The model is `LLM_MODEL` in `.env` and **nowhere
  else** — this README used to name a different model from the two config files and a
  docstring, four answers to one question
- **Embeddings**: `nomic-embed-text` via Ollama
- **Vector Store**: ChromaDB (persistent, metadata-filtered; `status: Active` is never
  dropped from a query, so repealed sections cannot be cited as current law)
- **Framework**: LangChain / LangGraph, a ReAct agent over four retrieval tools
- **API**: Flask behind gunicorn. **No CORS** — nothing in a browser calls this. Every
  route except `/api/health` requires an `X-Service-Token` header

## Quick Start

### Prerequisites

1. **Python 3.11+** installed
2. **Ollama** installed and running (`https://ollama.com`)
3. Pull the models named in your `.env` — read the names from it rather than
   copying them from here, so this file can never disagree with what runs:
   ```bash
   ollama pull "$(grep '^LLM_MODEL=' .env | cut -d= -f2-)"
   ollama pull "$(grep '^EMBEDDING_MODEL=' .env | cut -d= -f2-)"
   ```
   (Only needed when `LLM_PROVIDER=ollama`. A hosted provider pulls nothing —
   but it sends every question out of Sri Lanka, so read the preconditions in
   `app/core/llm.py` before setting one.)

### Setup

```bash
# Navigate to the RAG project
cd lawyer-rag

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env

# REQUIRED: generate the service token and put the SAME value in
# lawyer-rag/.env and lawyer-finder-web/.env. The service will not start
# without it, because it has no other authentication.
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Ingest Documents

```bash
# Batch ingest all PDFs from Acts directory
python -m scripts.ingest_all --clear

# Test with sample queries
python -m scripts.test_query
```

### Run the API Server

```bash
# Production shape
gunicorn -c gunicorn.conf.py wsgi:app

# Development
python -m app.main
```

Server starts at `http://127.0.0.1:5001` — loopback only, and 5001 rather than 5000
because on macOS port 5000 is AirPlay Receiver and it *answers*, which is how one caller
spent months talking to the wrong thing.

### Check it

```bash
python scripts/check_security.py   # 45 assertions against the running service
python scripts/test_chat.py        # the HTTP endpoints, with real questions
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send query → get RAG response |
| `POST` | `/api/ingest` | Upload & ingest a new PDF |
| `POST` | `/api/ingest/amendment` | Process amendment with override logic |
| `POST` | `/api/ingest/batch` | Batch ingest all PDFs |
| `GET` | `/api/documents` | List all ingested documents |
| `DELETE` | `/api/documents/<name>` | Remove a document |
| `GET` | `/api/health` | Health check — **the only route that needs no token** |

> Every example below needs the token. Export it first:
>
> ```bash
> export RAG_TOKEN=$(grep '^RAG_SERVICE_TOKEN=' .env | cut -d= -f2-)
> ```

### Chat Example

```bash
curl -X POST http://127.0.0.1:5001/api/chat \
  -H "X-Service-Token: $RAG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Section 14 of the Civil Procedure Code?"}'
```

### Ingest Example

```bash
# Single document
curl -X POST http://127.0.0.1:5001/api/ingest \
  -H "X-Service-Token: $RAG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "../Acts/Consolidated-Civil-Procedure-Code-upto-Act-No.-43-of-2024.pdf"}'

# Batch ingest
curl -X POST http://127.0.0.1:5001/api/ingest/batch \
  -H "X-Service-Token: $RAG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clear_existing": true}'
```

### Amendment Processing

```bash
curl -X POST http://127.0.0.1:5001/api/ingest/amendment \
  -H "X-Service-Token: $RAG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "../Acts/24-2025_E.pdf",
    "principal_act_name": "Civil Procedure Code"
  }'
```

## Project Structure

```
lawyer-rag/
├── wsgi.py                   # gunicorn entry point
├── gunicorn.conf.py          # serving config — read the preload_app comment
├── app/
│   ├── main.py              # Flask app factory + the auth hook
│   ├── config.py             # Configuration
│   ├── api/                  # REST endpoints
│   │   ├── chat.py           # Chat endpoint
│   │   ├── ingest.py         # Ingestion endpoints
│   │   └── documents.py      # Document management
│   ├── core/                 # Core RAG components
│   │   ├── chunker.py        # Smart legal chunker
│   │   ├── embeddings.py     # Embedding model
│   │   ├── llm.py            # LLM setup
│   │   ├── vectorstore.py    # ChromaDB manager
│   │   └── rag_chain.py      # RAG pipeline
│   ├── utils/
│   │   ├── chat_logger.py    # metrics only — never message content
│   │   └── errors.py         # opaque error ids; detail goes to the log
│   └── ingestion/            # Document processing
│       ├── pdf_parser.py     # PDF extraction
│       ├── metadata_builder.py  # Metadata construction
│       └── amendment_processor.py  # Amendment overrides
├── scripts/
│   ├── check_security.py     # 45 security assertions, against a LIVE service
│   ├── ingest_all.py         # Batch ingestion
│   ├── test_chat.py          # HTTP endpoint tests
│   └── test_query.py         # In-process pipeline tests
├── docs/                     # RUNNING.md, RAG-REVIEW.md, RAG-ROADMAP.md
├── data/
│   └── vectordb/             # ChromaDB storage
├── requirements.txt
└── .env
```

## Adding New Documents

1. Place the PDF in the `Acts/` directory
2. Call the ingest API or re-run batch ingestion
3. For amendments, use the `/api/ingest/amendment` endpoint

## Environment Variables

See `.env.example` — every variable is documented there, with the reasoning for the ones
that matter. `RAG_SERVICE_TOKEN` is required; `RAG_TRACING_ENABLED` must stay `false`
until the precondition in [docs/RAG-REVIEW.md §3](./docs/RAG-REVIEW.md) is met.