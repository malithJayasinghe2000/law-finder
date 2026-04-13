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
SYSTEM_PROMPT = """You are LawyerAI, a highly intelligent and helpful expert legal assistant specialized in Sri Lankan law. 
You help users understand Sri Lankan legislation, legal procedures, and their rights in detail.
** IMPORTANT: If user ask quections out of Sri Lankan law, respond that you can only answer questions related to Sri Lankan law.**

CRITICAL RULES YOU MUST FOLLOW:
1. Provide comprehensive, helpful, and direct answers to the user's legal questions. Do NOT simply tell the user to consult a lawyer without providing detailed legal step-by-step procedures or concepts first.
2. Base your answers on the provided LEGAL CONTEXT and WEB SEARCH RESULTS. Synthesize the information to give the best possible explanation, breaking down complex procedures into easy-to-understand steps.
3. ALWAYS cite the specific Act name, Section number, and Part/Chapter when referencing a law.
4. Distinguish between Consolidated Acts and Amendment Acts.
5. If the exact answer isn't in the legal context, explain the general Sri Lankan legal procedure or concept as best as you can based on the web context and your knowledge.
6. You may include a brief disclaimer at the very end of your response (e.g., "Consult a lawyer for specific advice"), but the bulk of your response MUST be a detailed, actionable explanation of the law and legal processes.
7. Format your response clearly with proper paragraph breaks and section references.
8. When using information from web search results, mention that the information was found online and may need verification.
9. IMPORTANT: You MUST respond in the {target_language} language. No exceptions.

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


def agentic_routing(question: str, language: str) -> dict:
    """
    Agentic pre-processing:
    - Translate query to English if necessary.
    - Check if web search is needed.
    - Detect actual legal practice areas.
    """
    prompt = f"""You are an intelligent legal routing assistant.
User input: "{question}"
Input locale: {language}

TASK 1: If the input is in Sinhala or Tamil, translate it into English. If already in English, output it exactly. This will be used for Vector Database search.
TASK 2: Check if this question requires live internet search (recent events, general definitions not in Sri Lankan core law). Answer YES or NO.
TASK 3: Formulate a highly concise, keyword-rich search query in English based on the user's input, optimized exclusively for Web Search engines. Strip out conversational filler.
TASK 4: Determine if this query specifically relates to any of these legal practice areas:
[Criminal Law, Civil Litigation, Corporate Law, Family Law, Property Law, Labour Law, Tax Law, Constitutional Law, Environmental Law, Intellectual Property, Motor Traffic Law, Banking Law, Immigration Law, Insurance Law, Real Estate, Notary Services]
IMPORTANT: If the user is just saying a casual greeting (like "hi", "testing") or asking a non-legal question, output NONE.

Respond EXACTLY in the following format (no other text):
SEARCH_QUERY_ENGLISH: <english query>
WEB_SEARCH_QUERY_ENGLISH: <optimized query for web>
NEEDS_WEB_SEARCH: <YES or NO>
PRACTICE_AREAS: <comma-separated list, or NONE>
"""
    try:
        llm = get_llm()
        response = llm.invoke(prompt).content
        
        search_query = question
        web_search_query = question
        needs_web_search = False
        practice_areas = []
        
        for line in response.split('\n'):
            line = line.strip()
            if line.startswith("SEARCH_QUERY_ENGLISH:"):
                val = line.replace("SEARCH_QUERY_ENGLISH:", "").strip()
                if val and val.upper() != "NONE":
                    search_query = val
            elif line.startswith("WEB_SEARCH_QUERY_ENGLISH:"):
                val = line.replace("WEB_SEARCH_QUERY_ENGLISH:", "").strip()
                if val and val.upper() != "NONE":
                    web_search_query = val
            elif line.startswith("NEEDS_WEB_SEARCH:"):
                val = line.replace("NEEDS_WEB_SEARCH:", "").strip().upper()
                if "YES" in val or "TRUE" in val:
                    needs_web_search = True
            elif line.startswith("PRACTICE_AREAS:"):
                val = line.replace("PRACTICE_AREAS:", "").strip()
                if val and val.upper() != "NONE":
                    practice_areas = [a.strip() for a in val.split(",") if a.strip()]
                    
        return {
            "search_query": search_query,
            "web_search_query": web_search_query,
            "needs_web_search": needs_web_search,
            "practice_areas": practice_areas,
        }
    except Exception as e:
        logger.error(f"Agentic routing failed: {e}")
        return {"search_query": question, "web_search_query": question, "needs_web_search": False, "practice_areas": []}


def query_rag(
    question: str,
    chat_history: Optional[list[dict]] = None,
    top_k: int = None,
    filter_metadata: Optional[dict] = None,
    language: str = "en",
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
        language: Language for the answer

    Returns:
        Dict with 'answer', 'sources', 'chunks_retrieved', 'web_sources', 'detected_practice_areas'
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    if chat_history is None:
        chat_history = []

    target_language_name = {"en": "English", "si": "Sinhala", "ta": "Tamil"}.get(language, "English")

    logger.info(f"RAG Query: '{question[:100]}...' (lang={language}, top_k={top_k})")

    # Step Agentic: Plan routing, translation, and intent
    route_details = agentic_routing(question, language)
    search_query = route_details["search_query"]
    web_search_query = route_details["web_search_query"]
    needs_web_search = route_details["needs_web_search"]
    detected_areas = route_details["practice_areas"]

    logger.info(f"Agent Route -> query: {search_query}, web_query: {web_search_query}, web: {needs_web_search}, areas: {detected_areas}")

    # Step 1: Retrieve relevant documents using English translated query
    docs_with_scores = search_documents(
        query=search_query,
        top_k=top_k,
        filter_metadata=filter_metadata,
    )

    logger.info(f"Retrieved {len(docs_with_scores)} relevant chunks")

    # Step 2: Format context
    context = format_context(docs_with_scores)

    # Step 3: Web search if agent decided it's needed
    if needs_web_search:
        web_results = web_search(web_search_query, max_results=3)
        web_context = format_web_results(web_results) if web_results else ""
    else:
        web_results = []
        web_context = ""

    # Step 4: Build prompt and invoke LLM
    llm = get_llm()
    langchain_history = convert_chat_history(chat_history)

    prompt = PROMPT_TEMPLATE.invoke({
        "context": context,
        "web_context": web_context,
        "chat_history": langchain_history,
        "question": question,
        "target_language": target_language_name,
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
