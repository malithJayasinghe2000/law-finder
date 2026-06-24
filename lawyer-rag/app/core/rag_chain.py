"""
LawyerAI RAG System - Hybrid Graph + Vector RAG Chain

The upgraded RAG pipeline that:
1. Takes a user query
2. Retrieves relevant legal document chunks from ChromaDB (Vector search)
3. Extracts entities from the query and traverses the knowledge graph
4. Expands retrieval with graph-discovered related documents
5. Searches the web for additional context
6. Formats everything into a structured, AI-readable prompt
7. Sends to Ollama LLM for response generation
8. Returns the answer with source citations, graph context, and detected practice areas
"""

import logging
from typing import Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from app.core.llm import get_llm
from app.core.vectorstore import search_documents
from app.core.web_search import web_search, format_web_results
from app.core.graph_store import get_knowledge_graph
from app.core.entity_extractor import extract_entities_regex
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
# System Prompt — Enhanced for Graph RAG with AI-readable formatting
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
10. When RELATED DOCUMENTS are provided, mention the connections between acts/laws to provide comprehensive context.

LEGAL CONTEXT FROM SRI LANKAN LEGISLATION:
{context}

{graph_context}

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
    Format retrieved documents into a structured, AI-readable context string.
    Each chunk includes full hierarchy path and source metadata for citation.
    """
    if not docs_with_scores:
        return "No relevant legal documents found in the database."

    context_parts = []
    for i, (doc, score) in enumerate(docs_with_scores, 1):
        meta = doc.metadata

        # Build a clear hierarchy path
        hierarchy_parts = []
        if meta.get('document_name') and meta.get('document_name') != 'Unknown':
            hierarchy_parts.append(f"Document: {meta['document_name']}")
        if meta.get('part') and meta.get('part') != 'Unknown':
            hierarchy_parts.append(f"Part: {meta['part']}")
        if meta.get('chapter') and meta.get('chapter') != 'Unknown':
            hierarchy_parts.append(f"Chapter: {meta['chapter']}")
        if meta.get('section_number') and not meta.get('section_number', '').startswith('Chunk_'):
            hierarchy_parts.append(f"Section: {meta['section_number']}")

        hierarchy = " → ".join(hierarchy_parts) if hierarchy_parts else "Unknown Location"

        header = (
            f"━━━ SOURCE {i} (Relevance: {score:.1%}) ━━━\n"
            f"📍 {hierarchy}\n"
            f"📋 Type: {meta.get('document_type', 'Unknown')} | "
            f"Status: {meta.get('status', 'Unknown')} | "
            f"Updated: {meta.get('last_updated_year', 'N/A')}\n"
            f"{'─' * 40}\n"
        )
        context_parts.append(header + doc.page_content)

    return "\n\n".join(context_parts)


def format_graph_context(graph_entities: list, related_docs: list) -> str:
    """
    Format graph-discovered relationships into readable context for the LLM.
    """
    if not graph_entities and not related_docs:
        return ""

    parts = ["\n━━━ RELATED LEGAL CONTEXT (Knowledge Graph) ━━━"]

    if graph_entities:
        parts.append("\n📊 Related Legal Entities:")
        for entity in graph_entities[:10]:  # Limit to top 10
            rel_type = entity.get("relationship", "RELATED_TO")
            name = entity.get("name", "Unknown")
            etype = entity.get("type", "")
            parts.append(f"  • [{etype}] {name} — ({rel_type})")

    if related_docs:
        parts.append("\n📎 Related Documents:")
        for doc in related_docs[:5]:
            parts.append(f"  • {doc}")

    return "\n".join(parts)


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


def _graph_expand_retrieval(question: str, initial_docs: list) -> tuple[list, list[str]]:
    """
    Use the knowledge graph to expand retrieval beyond vector search results.

    1. Extract entities from the question
    2. Find matching entities in the graph
    3. Traverse to find related documents
    4. Return graph entities and related document names

    Args:
        question: The user's query
        initial_docs: Already-retrieved docs (for context)

    Returns:
        Tuple of (graph_entities, related_document_names)
    """
    if not config.ENABLE_GRAPH_RAG:
        return [], []

    try:
        kg = get_knowledge_graph()

        # Extract entities from the question text
        entities, _ = extract_entities_regex(question)

        all_graph_entities = []
        related_doc_names = set()

        # For each extracted entity, find related entities in the graph
        for entity in entities:
            graph_related = kg.get_related_entities(
                entity.entity_id,
                max_depth=config.GRAPH_TRAVERSAL_DEPTH,
            )
            all_graph_entities.extend(graph_related)

            # Collect document names from related entities
            for rel in graph_related:
                doc_name = rel.get("document_name", "")
                if doc_name:
                    related_doc_names.add(doc_name)

        # Also search by name for broader matching
        query_words = question.lower().split()
        important_terms = [w for w in query_words if len(w) > 4 and w not in {
            "what", "which", "where", "about", "legal", "under", "section",
        }]

        for term in important_terms[:3]:  # Limit searches
            name_matches = kg.find_entities_by_name(term)
            for match in name_matches[:5]:
                related = kg.get_related_entities(match["id"], max_depth=1)
                all_graph_entities.extend(related)
                for rel in related:
                    doc_name = rel.get("document_name", "")
                    if doc_name:
                        related_doc_names.add(doc_name)

        # Remove docs that are already in the initial results
        initial_doc_names = set()
        for doc, _ in initial_docs:
            initial_doc_names.add(doc.metadata.get("document_name", ""))

        related_doc_names -= initial_doc_names

        # Deduplicate graph entities
        seen_ids = set()
        unique_entities = []
        for e in all_graph_entities:
            eid = e.get("id", "")
            if eid not in seen_ids:
                seen_ids.add(eid)
                unique_entities.append(e)

        logger.info(
            f"Graph expansion: {len(unique_entities)} related entities, "
            f"{len(related_doc_names)} related docs"
        )

        return unique_entities, sorted(related_doc_names)

    except Exception as e:
        logger.warning(f"Graph expansion failed: {e}")
        return [], []


def query_rag(
    question: str,
    chat_history: Optional[list[dict]] = None,
    top_k: int = None,
    filter_metadata: Optional[dict] = None,
) -> dict:
    """
    Execute the full hybrid Graph + Vector RAG pipeline:
    1. Retrieve relevant chunks from ChromaDB (vector search)
    2. Extract entities and traverse knowledge graph for related context
    3. Expand retrieval with graph-discovered documents
    4. Search the web for additional context
    5. Format all context in an AI-readable structure
    6. Generate response using Ollama LLM
    7. Return answer + sources + graph context + practice areas

    Args:
        question: User's legal question
        chat_history: Previous conversation messages
        top_k: Number of chunks to retrieve
        filter_metadata: Additional metadata filters

    Returns:
        Dict with 'answer', 'sources', 'chunks_retrieved', 'web_sources',
        'detected_practice_areas', 'graph_entities', 'related_documents'
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    if chat_history is None:
        chat_history = []

    logger.info(f"RAG Query: '{question[:100]}...' (top_k={top_k})")

    # Step 1: Retrieve relevant documents (vector search)
    docs_with_scores = search_documents(
        query=question,
        top_k=top_k,
        filter_metadata=filter_metadata,
    )

    logger.info(f"Vector search: {len(docs_with_scores)} chunks retrieved")

    # Step 2: Graph expansion — find related entities and documents
    graph_entities, related_doc_names = _graph_expand_retrieval(question, docs_with_scores)

    # Step 3: Retrieve additional chunks from graph-discovered documents
    if related_doc_names and config.ENABLE_GRAPH_RAG:
        for doc_name in list(related_doc_names)[:config.GRAPH_EXPANSION_K]:
            try:
                expanded_docs = search_documents(
                    query=question,
                    top_k=2,  # Get top 2 chunks from each related doc
                    filter_metadata={"document_name": doc_name},
                )
                docs_with_scores.extend(expanded_docs)
            except Exception as e:
                logger.warning(f"Failed to expand with doc '{doc_name}': {e}")

        logger.info(f"After graph expansion: {len(docs_with_scores)} total chunks")

    # Step 4: Format context
    context = format_context(docs_with_scores)

    # Step 5: Format graph context
    graph_context = format_graph_context(graph_entities, related_doc_names)

    # Step 6: Web search for additional context
    web_results = web_search(question, max_results=3)
    web_context = format_web_results(web_results) if web_results else ""

    # Step 7: Detect practice areas for lawyer suggestions
    detected_areas = detect_practice_areas(question, context)
    logger.info(f"Detected practice areas: {detected_areas}")

    # Step 8: Build prompt and invoke LLM
    llm = get_llm()
    langchain_history = convert_chat_history(chat_history)

    prompt = PROMPT_TEMPLATE.invoke({
        "context": context,
        "graph_context": graph_context,
        "web_context": web_context,
        "chat_history": langchain_history,
        "question": question,
    })

    response = llm.invoke(prompt)
    answer = response.content

    # Step 9: Extract source citations
    sources = format_sources(docs_with_scores)

    # Step 10: Format web sources
    web_sources = [
        {
            "title": r.get("title", ""),
            "url": r.get("href", ""),
            "snippet": r.get("body", ""),
        }
        for r in web_results
    ]

    logger.info(
        f"Generated response: {len(answer)} chars, {len(sources)} sources, "
        f"{len(web_sources)} web sources, {len(graph_entities)} graph entities"
    )

    return {
        "answer": answer,
        "sources": sources,
        "web_sources": web_sources,
        "chunks_retrieved": len(docs_with_scores),
        "detected_practice_areas": detected_areas,
        "graph_entities": [
            {"name": e.get("name", ""), "type": e.get("type", ""), "relationship": e.get("relationship", "")}
            for e in graph_entities[:10]
        ],
        "related_documents": related_doc_names[:5],
    }
