"""
LawyerAI RAG System - LLM Setup

Supports local inference using Ollama or remote inference using Hugging Face Router API.
Low temperature (0.1) ensures factual, deterministic legal responses.
"""

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from app.config import config

_llm_instance = None


def get_llm() -> BaseChatModel:
    """
    Get or create a singleton LLM instance.
    Supports Ollama, Hugging Face Router, OpenAI, or OpenRouter.
    """
    global _llm_instance
    if _llm_instance is None:
        provider = config.LLM_PROVIDER.lower()
        if provider == "huggingface":
            if not config.HF_TOKEN:
                raise ValueError("HF_TOKEN environment variable must be set when LLM_PROVIDER is 'huggingface'.")
            _llm_instance = ChatOpenAI(
                model=config.LLM_MODEL,
                openai_api_key=config.HF_TOKEN,
                openai_api_base=config.HF_API_BASE,
                temperature=config.LLM_TEMPERATURE,
            )
        elif provider == "openai":
            if not config.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY environment variable must be set when LLM_PROVIDER is 'openai'.")
            _llm_instance = ChatOpenAI(
                model=config.LLM_MODEL,
                openai_api_key=config.OPENAI_API_KEY,
                openai_api_base=config.OPENAI_API_BASE,
                temperature=config.LLM_TEMPERATURE,
            )
        elif provider == "openrouter":
            # Use OPENROUTER_API_KEY or fall back to OPENAI_API_KEY
            api_key = config.OPENROUTER_API_KEY or config.OPENAI_API_KEY
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY or OPENAI_API_KEY environment variable must be set when LLM_PROVIDER is 'openrouter'.")
            _llm_instance = ChatOpenAI(
                model=config.LLM_MODEL,
                openai_api_key=api_key,
                openai_api_base=config.OPENROUTER_API_BASE,
                temperature=config.LLM_TEMPERATURE,
            )
        else:
            _llm_instance = ChatOllama(
                model=config.LLM_MODEL,
                base_url=config.OLLAMA_BASE_URL,
                temperature=config.LLM_TEMPERATURE,
                top_p=config.LLM_TOP_P,
                num_ctx=config.LLM_NUM_CTX,
            )
    return _llm_instance


