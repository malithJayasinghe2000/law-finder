"""LawyerAI RAG System - Configuration Management"""

import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# ---------------------------------------------------------------------------
# Tracing — off, and held off
# ---------------------------------------------------------------------------
# Until Stage 0 this service ran with LANGCHAIN_TRACING_V2=true and a live
# LangSmith API key in .env. @traceable decorates query_rag(question=...),
# search_documents(query=...) and both pipeline functions, and LangSmith traces
# function inputs and outputs — so the full text of every question a person
# asked a legal assistant, the legislation retrieved for it, and the generated
# answer were transmitted to a US cloud service.
#
# That is sensitive personal data with no documented lawful basis, an
# undocumented cross-border transfer (counsel question 19, happening in
# production rather than in theory), and a sub-processor that no firm was told
# about and no processor agreement covers.
#
# app/utils/chat_logger.py had already reasoned this through and stopped writing
# question text to a LOCAL file, on the grounds that a second unmanaged copy of
# someone's legal problem is a liability with no matching benefit. The same
# content was leaving the country by environment variable at the same time.
#
# Why this is not simply a .env edit. Everything downstream — langchain,
# langsmith, the @traceable decorator — reads os.environ directly and never
# consults this Config object, and load_dotenv() has already pushed whatever
# .env says into os.environ by the line above. So config resolves the intent
# once and then writes the answer back into the environment, which is the thing
# the libraries actually obey.
#
# Turning this back on is a decision with a legal precondition, not a config
# tweak: self-host the collector (Langfuse), or mask inputs and outputs, and
# record the sub-processor in DATA-INVENTORY.md first.
_TRACING_ENABLED: bool = os.getenv("RAG_TRACING_ENABLED", "false").lower() == "true"

if not _TRACING_ENABLED:
    for _var in ("LANGCHAIN_TRACING_V2", "LANGSMITH_TRACING", "LANGCHAIN_TRACING"):
        os.environ[_var] = "false"
    # Belt and braces: with no API key in the environment there is no credential
    # to transmit under, even if some future import flips a tracing flag back on.
    for _var in ("LANGCHAIN_API_KEY", "LANGSMITH_API_KEY"):
        os.environ.pop(_var, None)

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
VECTORDB_DIR = DATA_DIR / "vectordb"
GRAPH_DIR = DATA_DIR / "graph"
UPLOADS_DIR = DATA_DIR / "uploads"
CHAT_LOG_DIR = DATA_DIR / "chat_logs"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
VECTORDB_DIR.mkdir(parents=True, exist_ok=True)
GRAPH_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
CHAT_LOG_DIR.mkdir(parents=True, exist_ok=True)


class Config:
    """Central configuration for the RAG system."""

    # Ollama
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen3.5:9b")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

    # ChromaDB
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", str(VECTORDB_DIR))
    CHROMA_COLLECTION_NAME: str = os.getenv("CHROMA_COLLECTION_NAME", "sri_lanka_legal_acts")

    # Flask
    #
    # FLASK_HOST defaults to loopback. main.py used to bind 0.0.0.0 directly
    # beneath a comment saying the service must not be reachable from the public
    # internet — the comment said one thing and the code did the opposite, which
    # is worse than no comment because a reviewer reads the comment and moves on.
    #
    # FLASK_DEBUG defaults to FALSE. It used to default to true, and .env set it
    # true as well. The Werkzeug debugger opens an interactive Python console on
    # any unhandled exception; on a 0.0.0.0 bind that is remote code execution as
    # the service user, reachable by anyone who can make the app throw.
    FLASK_HOST: str = os.getenv("FLASK_HOST", "127.0.0.1")
    FLASK_PORT: int = int(os.getenv("FLASK_PORT", "5000"))
    FLASK_DEBUG: bool = os.getenv("FLASK_DEBUG", "false").lower() == "true"

    # The shared secret every caller must present as X-Service-Token.
    #
    # There is exactly one legitimate caller — the Next.js server — so a shared
    # secret is the right weight of mechanism. It is read here rather than at
    # request time so that a missing token is a startup failure (see
    # require_service_token in main.py) instead of a service that silently
    # accepts everyone.
    RAG_SERVICE_TOKEN: str = os.getenv("RAG_SERVICE_TOKEN", "")

    # Request limits. Without these one caller can send a 10 MB question or a
    # 500-turn history and hold the model indefinitely.
    MAX_MESSAGE_CHARS: int = int(os.getenv("MAX_MESSAGE_CHARS", "4000"))
    MAX_HISTORY_TURNS: int = int(os.getenv("MAX_HISTORY_TURNS", "10"))
    MAX_CONTENT_LENGTH: int = int(os.getenv("MAX_CONTENT_LENGTH_MB", "50")) * 1024 * 1024

    # RAG
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1500"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))
    TOP_K_RESULTS: int = int(os.getenv("TOP_K_RESULTS", "6"))

    # ── The relevance floor ───────────────────────────────────────────────
    #
    # Retrieval used to return the top k regardless of score, so the corpus
    # ALWAYS had "an answer". Ask about land law — which is not held — and six
    # unrelated Companies Act chunks came back under a heading telling the model
    # "LEGAL CONTEXT FROM SRI LANKAN LEGISLATION". Measured on the golden set,
    # the service then answered questions about legislation it does not hold
    # 14 times out of 16.
    #
    # Two thresholds, not one, because they answer different questions:
    #
    #   RETRIEVAL_MIN_SCORE   "is there ANY good match?" — applied to the BEST
    #                         result. Below it, the whole search is treated as a
    #                         miss and nothing is returned, so the pipeline can
    #                         say it does not hold the material.
    #
    #   RETRIEVAL_CHUNK_FLOOR "is this chunk worth putting in the context?" —
    #                         applied per chunk, once the search has cleared the
    #                         gate above. A strong hit may legitimately carry
    #                         weaker supporting sections with it.
    #
    # Tuned against eval/questions.yaml, not guessed. At 0.62/0.50 on the 76
    # questions:
    #
    #        abstain  answerable answered   recall kept   not_in_corpus abstained
    #   0.00        (no floor)      100%           96%                        0%
    #   0.58                         91%           87%                       75%
    #   0.60                         91%           87%                       88%
    #   0.62  <-                     89%           85%                      100%
    #   0.64                         83%           80%                      100%
    #
    # 0.62 is chosen over 0.60 deliberately. It costs one more answerable
    # question (cpc-002, top score 0.608) and buys the last two not_in_corpus
    # cases. For a legal assistant, stating law it does not hold is a worse
    # failure than declining a question it could have answered: the first is
    # invisible to the reader, the second is obvious to them.
    #
    # Re-tune with `python -m scripts.eval --compare eval/results/baseline.json`
    # after any change to the embedding model, the chunker or the corpus. These
    # numbers are properties of THIS corpus and THIS embedding model.
    RETRIEVAL_MIN_SCORE: float = float(os.getenv("RETRIEVAL_MIN_SCORE", "0.62"))
    RETRIEVAL_CHUNK_FLOOR: float = float(os.getenv("RETRIEVAL_CHUNK_FLOOR", "0.50"))

    # Acts source directory
    ACTS_SOURCE_DIR: str = os.getenv("ACTS_SOURCE_DIR", str(BASE_DIR.parent / "Acts"))

    # LLM Parameters
    LLM_TEMPERATURE: float = 0.1  # Low temperature for factual legal responses
    LLM_TOP_P: float = 0.9

    # Context window.
    #
    # This was 8192, and the pipeline does not fit in 8192. One vector_search
    # returns TOP_K_RESULTS x CHUNK_SIZE = 6 x 1500 = ~9,000 characters, about
    # 2,300 tokens — and a ReAct agent re-sends the entire message list on every
    # step, so after three tool calls the conversation carries three full tool
    # results. Adding the agent system prompt, chat history and reasoning turns
    # put a typical question at ~9,400-10,300 tokens before the answer was even
    # generated.
    #
    # Ollama does not raise on overflow; it silently truncates. Nobody chooses
    # what survives, and what may be dropped includes the system prompt carrying
    # "you never advise a person about their own case" and the citation rules.
    # A safety instruction that disappears without a log line is not a control.
    LLM_NUM_CTX: int = int(os.getenv("LLM_NUM_CTX", "32768"))

    # Maximum tokens in a single generation. There was no cap at all, so a model
    # that started repeating itself ran until the caller's 60s timeout, having
    # consumed the whole window on the way. A legal answer with citations does
    # not need more than this; running past it means something has gone wrong.
    LLM_NUM_PREDICT: int = int(os.getenv("LLM_NUM_PREDICT", "1536"))

    # Graph RAG
    ENABLE_GRAPH_RAG: bool = os.getenv("ENABLE_GRAPH_RAG", "true").lower() == "true"
    GRAPH_PERSIST_PATH: str = os.getenv("GRAPH_PERSIST_PATH", str(GRAPH_DIR / "knowledge_graph.json"))
    GRAPH_TRAVERSAL_DEPTH: int = int(os.getenv("GRAPH_TRAVERSAL_DEPTH", "2"))
    GRAPH_EXPANSION_K: int = int(os.getenv("GRAPH_EXPANSION_K", "3"))

    # Agentic RAG (LangGraph ReAct Orchestrator)
    # Set ENABLE_AGENTIC_RAG=false to fall back to the linear pipeline
    ENABLE_AGENTIC_RAG: bool = os.getenv("ENABLE_AGENTIC_RAG", "true").lower() == "true"
    # Max LangGraph recursion steps — prevents infinite tool-call loops
    # Each tool call + LLM response counts as 2 steps; 10 = ~5 tool calls max
    AGENT_MAX_ITERATIONS: int = int(os.getenv("AGENT_MAX_ITERATIONS", "10"))

    # Upload directory for admin-uploaded documents
    UPLOADS_DIR: str = os.getenv("UPLOADS_DIR", str(UPLOADS_DIR))

    # Chat Log Directory
    CHAT_LOG_DIR: str = os.getenv("CHAT_LOG_DIR", str(CHAT_LOG_DIR))

    # Tracing. Resolved at module import above, where the environment the
    # libraries actually read is set. Exposed here so /api/health can report it.
    TRACING_ENABLED: bool = _TRACING_ENABLED
    LANGCHAIN_PROJECT: str = os.getenv("LANGCHAIN_PROJECT", "lawyer-rag")

    # Legal Document Categories
    DOCUMENT_CATEGORIES = [
        "Sri Lanka Law Reports",
        "Acts & Ordinances",
        "Amendment Acts",
        "Gazette Notifications",
        "Supreme Court Decisions",
        "Court of Appeal Decisions",
    ]


config = Config()
