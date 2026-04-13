# LawyerAI RAG System

A deployment-friendly Python RAG (Retrieval-Augmented Generation) system for the LawyerAI legal assistant platform. Powers the AI chatbot with accurate Sri Lankan legal knowledge.

## Architecture

- **LLM**: Ollama `gemma4:e2b` (local inference)
- **Embeddings**: `nomic-embed-text` via Ollama (local, high-accuracy)
- **Vector Store**: ChromaDB (persistent, metadata-filtered)
- **Framework**: LangChain for RAG orchestration
- **API**: Flask with CORS for Next.js frontend integration

## Quick Start

### Prerequisites

1. **Python 3.11+** installed
2. **Ollama** installed and running (`https://ollama.com`)
3. Pull required models:
   ```bash
   ollama pull gemma4:e2b
   ollama pull nomic-embed-text
   ```

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
copy .env.example .env  # Windows
# cp .env.example .env  # macOS/Linux
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
python -m app.main
```

Server starts at `http://localhost:5000`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send query → get RAG response |
| `POST` | `/api/ingest` | Upload & ingest a new PDF |
| `POST` | `/api/ingest/amendment` | Process amendment with override logic |
| `POST` | `/api/ingest/batch` | Batch ingest all PDFs |
| `GET` | `/api/documents` | List all ingested documents |
| `DELETE` | `/api/documents/<name>` | Remove a document |
| `GET` | `/api/health` | Health check |

### Chat Example

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Section 14 of the Civil Procedure Code?"}'
```

### Ingest Example

```bash
# Single document
curl -X POST http://localhost:5000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"file_path": "../Acts/Consolidated-Civil-Procedure-Code-upto-Act-No.-43-of-2024.pdf"}'

# Batch ingest
curl -X POST http://localhost:5000/api/ingest/batch \
  -H "Content-Type: application/json" \
  -d '{"clear_existing": true}'
```

### Amendment Processing

```bash
curl -X POST http://localhost:5000/api/ingest/amendment \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "../Acts/24-2025_E.pdf",
    "principal_act_name": "Civil Procedure Code"
  }'
```

## Project Structure

```
lawyer-rag/
├── app/
│   ├── main.py              # Flask entry point
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
│   └── ingestion/            # Document processing
│       ├── pdf_parser.py     # PDF extraction
│       ├── metadata_builder.py  # Metadata construction
│       └── amendment_processor.py  # Amendment overrides
├── scripts/
│   ├── ingest_all.py         # Batch ingestion
│   └── test_query.py         # Test queries
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

See `.env.example` for all available configuration options.

ollama pull nomic-embed-text