"""
LawyerAI RAG System - LLM Setup

Uses Ollama for local inference. Low temperature (0.1) keeps legal answers
factual and close to deterministic.

The model is config.LLM_MODEL. Do NOT name a specific model in this docstring:
the previous one said gemma3:4b while config defaulted to qwen3.5:9b, .env ran
llama3.2:3b and .env.example said gemma4:e2b — four different answers to "which
model answers a legal question", in four files, none of them right. Settling
that is Stage 1.6; the fix is one model named in one place, which is config.
"""

from langchain_ollama import ChatOllama
from app.config import config

_llm_instance = None


def get_llm() -> ChatOllama:
    """
    Get or create a singleton LLM instance.

    num_ctx and num_predict are the two bounds that were missing:

      num_ctx      was 8192, and the agent pipeline does not fit in 8192. Ollama
                   truncates silently on overflow, so the system prompt carrying
                   "you never advise a person about their own case" was among
                   the things that could vanish without a log line. Now 32768.

      num_predict  did not exist, so generation was unbounded. A model that
                   began repeating itself ran until the caller's 60s timeout.
    """
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatOllama(
            model=config.LLM_MODEL,
            base_url=config.OLLAMA_BASE_URL,
            temperature=config.LLM_TEMPERATURE,
            top_p=config.LLM_TOP_P,
            num_ctx=config.LLM_NUM_CTX,
            num_predict=config.LLM_NUM_PREDICT,
        )
    return _llm_instance
