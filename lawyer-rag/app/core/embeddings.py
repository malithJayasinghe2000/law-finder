"""
LawyerAI RAG System - Embedding Model Setup

Uses nomic-embed-text via Ollama for fully local, high-accuracy embeddings.
nomic-embed-text produces 768-dimensional vectors and is a top performer
on the MTEB benchmark for its size class.
"""

from langchain_ollama import OllamaEmbeddings
from app.config import config

_embeddings_instance = None


def get_embeddings() -> OllamaEmbeddings:
    """
    Get or create a singleton embedding model instance.
    Uses nomic-embed-text via Ollama for local embeddings.
    """
    global _embeddings_instance
    if _embeddings_instance is None:
        _embeddings_instance = OllamaEmbeddings(
            model=config.EMBEDDING_MODEL,
            base_url=config.OLLAMA_BASE_URL,
        )
    return _embeddings_instance
