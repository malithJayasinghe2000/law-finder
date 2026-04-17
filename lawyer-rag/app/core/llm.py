"""
LawyerAI RAG System - LLM Setup

Uses Ollama with gemma3:4b for local inference.
Low temperature (0.1) ensures factual, deterministic legal responses.
"""

from langchain_ollama import ChatOllama
from app.config import config

_llm_instance = None


def get_llm() -> ChatOllama:
    """
    Get or create a singleton LLM instance.
    Uses gemma3:4b via Ollama for local inference.
    """
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatOllama(
            model=config.LLM_MODEL,
            base_url=config.OLLAMA_BASE_URL,
            temperature=config.LLM_TEMPERATURE,
            top_p=config.LLM_TOP_P,
            num_ctx=config.LLM_NUM_CTX,
        )
    return _llm_instance
