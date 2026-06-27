"""
LawyerAI RAG System - Web Search Module

Provides web search capabilities using DuckDuckGo.
Used when the local legal database doesn't have enough context,
or for general legal questions about Sri Lanka.
"""

import logging
from duckduckgo_search import DDGS
from langchain_core.prompts import ChatPromptTemplate
from app.core.llm import get_llm

logger = logging.getLogger(__name__)


SEARCH_OPTIMIZATION_PROMPT = """You are an expert at creating internet search queries.
Convert the user's conversational legal question into a highly optimized, keyword-dense search query for DuckDuckGo.
Keep it under 6 words. Focus on the core legal concepts. Do NOT include filler words like "how do I", "what is", "another thing".

User question: {question}

Return ONLY the optimized search keywords. Do not include any explanations.
"""

def optimize_search_query(query: str) -> str:
    """Uses an LLM to convert a conversational query into a keyword-dense search query."""
    try:
        llm = get_llm()
        prompt = ChatPromptTemplate.from_messages([
            ("system", SEARCH_OPTIMIZATION_PROMPT),
            ("human", "{question}")
        ])
        response = llm.invoke(prompt.invoke({"question": query}))
        optimized = response.content.strip()
        logger.info(f"Optimized search query: '{query}' -> '{optimized}'")
        return optimized
    except Exception as e:
        logger.error(f"Error optimizing search query: {e}")
        return query


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
        # Step 1: Optimize the query
        optimized_query = optimize_search_query(query)
        
        # Step 2: Enforce Sri Lanka law context
        final_query = f"{optimized_query} Sri Lanka law"
        
        logger.info(f"Executing Web search: '{final_query}'")
        with DDGS() as ddgs:
            results = list(ddgs.text(
                final_query,
                max_results=max_results + 3, # Request more to allow for filtering
            ))
            
        # Step 3: Relevance Filtering
        filtered_results = []
        banned_domains = ["dictionary", "wiktionary", "thesaurus", "cambridge.org", "oxfordlearners", "merriam-webster", "collinsdictionary", "vocabulary.com"]
        
        for r in results:
            body = r.get("body", "").lower()
            title = r.get("title", "").lower()
            href = r.get("href", "").lower()
            combined = body + " " + title
            
            # Skip if it's a known dictionary site
            if any(banned in href for banned in banned_domains):
                continue
                
            # Skip if the title suggests it's just a definition
            if "definition" in title or "meaning" in title or "synonym" in title:
                continue
            
            # Simple keyword check to ensure it's somewhat related to law or Sri Lanka
            valid_keywords = ["law", "legal", "act", "court", "police", "sri lanka", "attorney", "lawyer", "gazette", "justice", "penal", "traffic", "accident"]
            if any(keyword in combined for keyword in valid_keywords):
                filtered_results.append(r)
                
            if len(filtered_results) >= max_results:
                break
                
        logger.info(f"Web search returned {len(filtered_results)} valid results out of {len(results)}")
        return filtered_results
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
