"""
LawyerAI RAG System - Web Search Module

Provides web search capabilities using DuckDuckGo.
Used when the local legal database doesn't have enough context,
or for general legal questions about Sri Lanka.
"""

import logging
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)


def web_search(query: str, max_results: int = 5) -> list[dict]:
    """
    Search the web using DuckDuckGo for additional context.

    Args:
        query: Search query string
        max_results: Maximum number of results

    Returns:
        List of dicts with 'title', 'body', 'href'
    """
    try:
        logger.info(f"Web search: '{query[:80]}...'")
        with DDGS() as ddgs:
            results = list(ddgs.text(
                f"Sri Lanka law legal {query}",
                max_results=max_results,
            ))
        logger.info(f"Web search returned {len(results)} results")
        return results
    except Exception as e:
        logger.warning(f"Web search failed: {e}")
        return []


def format_web_results(results: list[dict]) -> str:
    """Format web search results into context string."""
    if not results:
        return ""

    parts = ["\\n--- WEB SEARCH RESULTS ---"]
    for i, r in enumerate(results, 1):
        parts.append(
            f"\\n[Web Source {i}] {r.get('title', 'N/A')}\\n"
            f"URL: {r.get('href', 'N/A')}\\n"
            f"Summary: {r.get('body', 'N/A')}"
        )
    return "\\n".join(parts)
