"""LawyerAI RAG System - Configuration Management"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

    # LLM Provider Configuration ("ollama", "huggingface", "openai", "openrouter")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama")

    # Ollama
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen3.5:9b")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

    # Hugging Face Router Configuration (for LLM_PROVIDER=huggingface)
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    HF_API_BASE: str = os.getenv("HF_API_BASE", "https://router.huggingface.co/v1")

    # OpenAI Configuration (for LLM_PROVIDER=openai)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_API_BASE: str = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")

    # OpenRouter Configuration (for LLM_PROVIDER=openrouter)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_API_BASE: str = os.getenv("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")



    # ChromaDB
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", str(VECTORDB_DIR))
    CHROMA_COLLECTION_NAME: str = os.getenv("CHROMA_COLLECTION_NAME", "sri_lanka_legal_acts")

    # Flask
    FLASK_PORT: int = int(os.getenv("FLASK_PORT", "5000"))
    FLASK_DEBUG: bool = os.getenv("FLASK_DEBUG", "true").lower() == "true"

    # RAG
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1500"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))
    TOP_K_RESULTS: int = int(os.getenv("TOP_K_RESULTS", "6"))

    # Acts source directory
    ACTS_SOURCE_DIR: str = os.getenv("ACTS_SOURCE_DIR", str(BASE_DIR.parent / "Acts"))

    # LLM Parameters
    LLM_TEMPERATURE: float = 0.1  # Low temperature for factual legal responses
    LLM_TOP_P: float = 0.9
    LLM_NUM_CTX: int = 8192  # Context window size

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

    # LangSmith Tracing
    LANGCHAIN_TRACING_V2: bool = os.getenv("LANGCHAIN_TRACING_V2", "false").lower() == "true"
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
