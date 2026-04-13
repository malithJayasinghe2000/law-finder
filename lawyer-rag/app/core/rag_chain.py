"""
LawyerAI RAG System - RAG Chain

The core RAG pipeline that:
1. Takes a user query
2. Retrieves relevant legal document chunks from ChromaDB (Active only)
3. Searches the web for additional context
4. Formats them into a structured prompt
5. Sends to Ollama LLM for response generation
6. Returns the answer with source citations and detected practice areas
"""

import logging
from typing import Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from app.core.llm import get_llm
from app.core.vectorstore import search_documents
from app.core.web_search import web_search, format_web_results
from app.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Practice Areas Mapping — for lawyer suggestion matching
# ---------------------------------------------------------------------------
PRACTICE_AREA_KEYWORDS = {
    "Criminal Law": ["criminal", "penal", "offence", "murder", "theft", "robbery", "assault", "bail", "arrest"],
    "Civil Litigation": ["civil", "procedure", "plaint", "defendant", "plaintiff", "suit", "decree", "appeal"],
    "Corporate Law": ["company", "companies", "director", "shareholder", "incorporation", "corporate", "board", "dividend"],
    "Family Law": ["marriage", "divorce", "custody", "maintenance", "adoption", "matrimonial", "dowry"],
    "Property Law": ["property", "land", "deed", "title", "lease", "rent", "tenant", "landlord", "partition"],
    "Labour Law": ["labour", "labor", "employment", "worker", "wages", "termination", "industrial", "workmen"],
    "Tax Law": ["tax", "revenue", "income tax", "vat", "customs", "duty", "fiscal"],
    "Constitutional Law": ["constitution", "fundamental rights", "supreme court", "constitutional"],
    "Environmental Law": ["environment", "pollution", "forest", "wildlife", "conservation", "ecological"],
    "Intellectual Property": ["patent", "copyright", "trademark", "intellectual property", "ip rights"],
    "Motor Traffic Law": ["motor", "traffic", "vehicle", "driving", "license", "road", "accident"],
    "Banking Law": ["banking", "bank", "finance", "loan", "mortgage", "financial", "cheque"],
    "Immigration Law": ["immigration", "visa", "passport", "citizenship", "alien", "deportation"],
    "Insurance Law": ["insurance", "claim", "policy", "premium", "indemnity"],
    "Real Estate": ["real estate", "property", "conveyance", "deed", "land registry", "notary"],
    "Notary Services": ["notary", "attestation", "affidavit", "power of attorney", "deed"],
}

# ---------------------------------------------------------------------------
# System Prompt — Designed for Sri Lankan Legal Context
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are LawyerAI, an expert legal assistant specialized in Sri Lankan law. 
You help users understand Sri Lankan legislation, legal procedures, and their rights.

CRITICAL RULES YOU MUST FOLLOW:
1. Base your answers primarily on the provided LEGAL CONTEXT below. If the context is insufficient, you may use WEB SEARCH RESULTS for supplementary information.
2. ALWAYS cite the specific Act name, Section number, and Part/Chapter when referencing a law.
3. If neither the legal context nor web results contain enough information, clearly state:
   "I don't have enough information in my Knowledge Base to answer this question accurately. 
   Please consult a qualified lawyer for specific legal advice."
4. Distinguish between Consolidated Acts (full compiled laws) and Amendment Acts (changes to existing laws).
5. When multiple sections are relevant, reference all of them.
6. Use clear, simple language that non-lawyers can understand, but maintain legal accuracy.
7. NEVER provide specific legal advice — always recommend consulting a professional lawyer for specific cases.
8. Format your response clearly with proper paragraph breaks and section references.
9. When using information from web search results, mention that the information was found online and may need verification.

LEGAL CONTEXT FROM SRI LANKAN LEGISLATION:
{context}

{web_context}
"""

# ---------------------------------------------------------------------------
# Prompt Template
# ---------------------------------------------------------------------------
PROMPT_TEMPLATE = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{question}"),
])


def format_context(docs_with_scores: list) -> str:
    """
    Format retrieved documents into a structured context string.

    Each chunk includes its source metadata for citation.
    """
    if not docs_with_scores:
        return "No relevant legal documents found in the database."

    context_parts = []
    for i, (doc, score) in enumerate(docs_with_scores, 1):
        meta = doc.metadata
        header = (
            f"--- Source {i} ---\n"
            f"Document: {meta.get('document_name', 'Unknown')}\n"
            f"Type: {meta.get('document_type', 'Unknown')}\n"
            f"Section: {meta.get('section_number', 'N/A')}\n"
            f"Part: {meta.get('part', 'N/A')}\n"
            f"Chapter: {meta.get('chapter', 'N/A')}\n"
            f"Status: {meta.get('status', 'Unknown')}\n"
            f"Last Updated: {meta.get('last_updated_year', 'N/A')}\n"
            f"Relevance Score: {score:.3f}\n"
            f"---\n"
        )
        context_parts.append(header + doc.page_content)

    return "\n\n".join(context_parts)


def format_sources(docs_with_scores: list) -> list[dict]:
    """Extract source citation information from retrieved documents."""
    sources = []
    seen = set()

    for doc, score in docs_with_scores:
        meta = doc.metadata
        key = f"{meta.get('document_name', '')}-{meta.get('section_number', '')}"

        if key not in seen:
            seen.add(key)
            sources.append({
                "document_name": meta.get("document_name", "Unknown"),
                "document_type": meta.get("document_type", "Unknown"),
                "section": meta.get("section_number", "N/A"),
                "part": meta.get("part", "N/A"),
                "chapter": meta.get("chapter", "N/A"),
                "status": meta.get("status", "Unknown"),
                "last_updated_year": meta.get("last_updated_year", "N/A"),
                "relevance_score": round(score, 3),
                "chunk_preview": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
            })

    return sources


def convert_chat_history(history: list[dict]) -> list:
    """Convert chat history dicts to LangChain message objects."""
    messages = []
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    return messages


def detect_practice_areas(question: str, context: str) -> list[str]:
    """
    Detect relevant practice areas from the question and retrieved context.
    Returns a list of matching practice area names.
    """
    combined_text = f"{question} {context}".lower()
    detected = []

    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in combined_text:
                detected.append(area)
                break  # One match per area is enough

    return detected[:5]  # Limit to top 5 areas


def query_rag(
    question: str,
    chat_history: Optional[list[dict]] = None,
    top_k: int = None,
    filter_metadata: Optional[dict] = None,
) -> dict:
    """
    Execute the full RAG pipeline:
    1. Retrieve relevant chunks from ChromaDB
    2. Search the web for additional context
    3. Format context with source metadata
    4. Generate response using Ollama LLM
    5. Return answer + source citations + detected practice areas

    Args:
        question: User's legal question
        chat_history: Previous conversation messages
        top_k: Number of chunks to retrieve
        filter_metadata: Additional metadata filters

    Returns:
        Dict with 'answer', 'sources', 'chunks_retrieved', 'web_sources', 'detected_practice_areas'
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    if chat_history is None:
        chat_history = []

    logger.info(f"RAG Query: '{question[:100]}...' (top_k={top_k})")

    # Step 1: Retrieve relevant documents
    docs_with_scores = search_documents(
        query=question,
        top_k=top_k,
        filter_metadata=filter_metadata,
    )

    logger.info(f"Retrieved {len(docs_with_scores)} relevant chunks")

    # Step 2: Format context
    context = format_context(docs_with_scores)

    # Step 3: Web search for additional context
    web_results = web_search(question, max_results=3)
    web_context = format_web_results(web_results) if web_results else ""

    # Step 4: Detect practice areas for lawyer suggestions
    detected_areas = detect_practice_areas(question, context)
    logger.info(f"Detected practice areas: {detected_areas}")

    # Step 5: Build prompt and invoke LLM
    llm = get_llm()
    langchain_history = convert_chat_history(chat_history)

    prompt = PROMPT_TEMPLATE.invoke({
        "context": context,
        "web_context": web_context,
        "chat_history": langchain_history,
        "question": question,
    })

    response = llm.invoke(prompt)
    answer = response.content

    # Step 6: Extract source citations
    sources = format_sources(docs_with_scores)

    # Step 7: Format web sources
    web_sources = [
        {
            "title": r.get("title", ""),
            "url": r.get("href", ""),
            "snippet": r.get("body", ""),
        }
        for r in web_results
    ]

    logger.info(f"Generated response: {len(answer)} chars, {len(sources)} sources, {len(web_sources)} web sources")

    return {
        "answer": answer,
        "sources": sources,
        "web_sources": web_sources,
        "chunks_retrieved": len(docs_with_scores),
        "detected_practice_areas": detected_areas,
    }
