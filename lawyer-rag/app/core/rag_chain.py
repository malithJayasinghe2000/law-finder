"""
LawyerAI RAG System - Hybrid Graph + Vector RAG Chain

The upgraded RAG pipeline that:
1. Takes a user query
2. Retrieves relevant legal document chunks from ChromaDB (Vector search)
3. Extracts entities from the query and traverses the knowledge graph
4. Expands retrieval with graph-discovered related documents
5. Formats everything into a structured, AI-readable prompt
6. Sends to Ollama LLM for response generation
7. Returns the answer with source citations and graph context

Phase 5 removed two things from this pipeline: web-search grounding (a search
result is not a legal authority) and practice-area detection (it existed to pick
attorneys to show the user). See lawyer-finder-web/docs/restructure/.
"""

import logging
from typing import Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langsmith import traceable

from app.core.llm import get_llm
from app.core.vectorstore import search_documents
from app.core.graph_store import get_knowledge_graph
from app.core.entity_extractor import extract_entities_regex
from app.core.query_router import (
    classify_intent,
    rewrite_query,
    generate_conversational_response,
    generate_clarification_response,
    LAWYER_REQUEST_REFUSAL,
)
from app.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------
# Note on where the real enforcement lives.
#
# This prompt is defence in depth, not the guardrail. It is an instruction to a
# small local model, and a model that ignores an instruction fails silently.
# The binding rules run in the Next.js application, in src/lib/ai/policy.ts,
# after generation and before any user sees a character — see
# lawyer-finder-web/docs/restructure/LEGAL-GUARDRAILS.md (rule 6).
#
# What changed here in Phase 5, and why:
#   - The instruction to fall back on "your general legal knowledge" is gone.
#     An answer the model made up is an answer that cannot be cited, and an
#     uncited legal answer is withheld downstream anyway.
#   - "Recommend a specialist lawyer" is gone. Naming a kind of practitioner
#     off the back of what a person described about their own legal problem is
#     the platform channelling work toward lawyers, which is touting under the
#     Intermeddlers with Suitors Ordinance No. 11 of 1894 and reaches the
#     operator criminally.
#   - The own-matter line is now explicit, because "never provide specific legal
#     advice" turned out to be too abstract for the model to apply.
SYSTEM_PROMPT = """You are a legal information assistant for Sri Lankan law.
You are NOT a lawyer and you are NOT anyone's lawyer.

LEGISLATION AVAILABLE TO YOU:
- Companies Act (Consolidated, 2024)
- Civil Procedure Code (Consolidated, 2024)
- Motor Traffic Act (Consolidated, 2024)
- Act No. 24 of 2007 — Computer Crimes Act
- Act No. 24 of 2025 — Amendment

THE LINE YOU MUST NOT CROSS:
You explain what the law says. You never advise a person about their own case.

  ALLOWED:  "Section 12 of the Companies Act requires a director to..."
  ALLOWED:  "The Act sets out three grounds on which an application may be made."
  REFUSED:  "In your case, you would be entitled to compensation."
  REFUSED:  "You should file a claim."
  REFUSED:  "You have a strong case."

If a person describes their own situation, answer the general legal question
underneath it and nothing more. Do not apply the law to their facts, do not tell
them what to do, and do not predict what would happen to them. Say plainly that
you cannot advise on their own matter and that an attorney-at-law can.

NEVER suggest a lawyer, a firm, or a type of specialist — not by name and not by
category — however the person asks. Choosing who advises someone is not yours to
influence. If they ask, tell them the directory lists every verified practice
alphabetically and the choice is theirs.

CITATION RULES:
1. Answer ONLY from the LEGAL CONTEXT below. It is the whole of what you know.
2. Cite the Act name and Section number for every proposition you state.
3. NEVER cite an Act that does not appear in the LEGAL CONTEXT below, even if
   you believe it exists. An invented citation is worse than no answer.
4. If the LEGAL CONTEXT does not answer the question, say exactly that and stop.
   Do not fill the gap from memory.
5. Distinguish Consolidated Acts from Amendment Acts.

STYLE:
- Plain language a non-lawyer can follow, without losing legal accuracy.
- Proper paragraph breaks.
- Be calm and clear. The person may be under real stress, and the most useful
  thing you can give them is an accurate account of the law and an honest
  statement of where your usefulness ends.

LEGAL CONTEXT FROM SRI LANKAN LEGISLATION:
{context}

{graph_context}
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
                # The ingested file this chunk came from. The application uses it
                # to resolve a citation to a LegalDocument the reader can open —
                # a citation nobody can open manufactures authority.
                "source_file": meta.get("source_file", ""),
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


# `detect_practice_areas` and `PRACTICE_AREA_KEYWORDS` were deleted in Phase 5.
#
# They classified what a person had written about their own legal problem into a
# practice area, and that classification was then used to select which attorneys
# to display beside the answer. Two guardrails at once: the platform choosing the
# lawyer (rule 4), and targeting on privileged material (rule 5). The route that
# consumed the output, /api/ai-chat/suggest-lawyers, is deleted, and so is the
# column that stored the result.


@traceable(name="Graph Expansion Retrieval")
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


# ---------------------------------------------------------------------------
# What it says when the corpus does not hold the answer
# ---------------------------------------------------------------------------
# A FIXED STRING, deliberately, for the same reason LAWYER_REQUEST_REFUSAL is
# one: a refusal that a model composes is a refusal that a model can compose its
# way out of. Measured on the golden set before the relevance floor existed, the
# service answered questions about legislation it does not hold 14 times out of
# 16 — describing the powers of the Prevention of Terrorism Act, attributing
# trademark registration to the Companies Act, and inventing a residence
# requirement for citizenship. None of that law is in the corpus.
#
# Note what this message does NOT do: it does not ask the person to describe
# their situation. The clarification template did, offering "my employer fired
# me without notice" as its worked example, which walked users straight into the
# own-matter path this service handles worst. It offers the general form of the
# question instead, the way the application's own refusals do.

_CORPUS_CACHE: Optional[list[str]] = None

# Display names for documents whose stored document_name is unusable.
#
# STOPGAP, and display-only. "Act No. 24 of 2007" is what build_metadata_from_filename
# derived from 24-2007_E.pdf; it is not a name anybody would ask for and not a
# citation anybody could look up (RAG-REVIEW.md §4.12). The real fix is to
# re-ingest with the Act's long title, which is in the first chunk of each PDF.
# This map only affects the sentence below, never a citation.
_DISPLAY_NAMES = {
    "Act No. 24 of 2007": "Computer Crime Act, No. 24 of 2007",
    "Act No. 24 of 2025": "Social Security Contribution Levy (Amendment) Act, No. 24 of 2025",
}


def _corpus_titles() -> list[str]:
    """
    The legislation actually held, read from the vector store and cached.

    Derived rather than hardcoded. The available Acts are currently written into
    four separate places (RAG-REVIEW.md §4.6) and ingesting a new one updates
    none of them, so a hardcoded list here would be a fifth thing to drift.
    """
    global _CORPUS_CACHE
    if _CORPUS_CACHE is None:
        try:
            from app.core.vectorstore import get_all_document_names
            names = [d.get("document_name", "") for d in get_all_document_names()]
            _CORPUS_CACHE = sorted(
                {_DISPLAY_NAMES.get(n, n) for n in names if n and n != "Unknown"}
            )
        except Exception as e:
            logger.warning(f"Could not read corpus names: {e}")
            return []
    return _CORPUS_CACHE


def no_context_response(intent: str) -> dict:
    """The answer when nothing in the corpus clears the relevance floor."""
    held = _corpus_titles()
    holdings = (
        "\n\nThe legislation I hold is:\n"
        + "\n".join(f"  • {t}" for t in held)
        if held else ""
    )
    return {
        "answer": (
            "I do not hold legislation covering that, so I cannot answer it from a "
            "source — and I will not answer it from memory, because an answer I "
            "cannot cite is one you cannot check."
            + holdings
            + "\n\nIf your question is about one of those, try asking it directly — "
            "for example *\"what does the law say about removing a company "
            "director\"* rather than a general topic."
        ),
        "sources": [],
        "chunks_retrieved": 0,
        "intent": intent,
        "no_context": True,
        "graph_entities": [],
        "related_documents": [],
    }


@traceable(name="RAG Query Dispatcher")
def query_rag(
    question: str,
    chat_history: Optional[list[dict]] = None,
    top_k: int = None,
    filter_metadata: Optional[dict] = None,
) -> dict:
    """
    Main entry point for the RAG pipeline. Dispatches to either the
    LangGraph ReAct agentic orchestrator (default) or the original linear
    pipeline (fallback / when ENABLE_AGENTIC_RAG=false).

    Agentic path: The LLM agent decides which tools (vector search, graph
    lookup, web search) to call and in what order, iterating until it has
    enough context to produce a high-quality answer.

    Linear path: Fixed sequence — vector search → graph expand → web search
    → LLM generate. Kept as a reliable fallback.

    Args:
        question: User's legal question
        chat_history: Previous conversation messages
        top_k: Number of chunks to retrieve (linear path only)
        filter_metadata: Additional metadata filters (linear path only)

    Returns:
        Dict with 'answer', 'sources', 'chunks_retrieved', 'web_sources',
        'intent', 'graph_entities', 'related_documents'
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    if chat_history is None:
        chat_history = []

    logger.info(f"RAG Query: '{question[:100]}...' (top_k={top_k})")

    # Step 0: Intent Routing + Smart Document Filter (6-intent system)
    routing = classify_intent(question, chat_history)
    intent = routing["intent"]
    document_filter = routing["document_filter"]
    logger.info(f"Detected intent: {intent}, document_filter: {document_filter}")

    # ── Fast paths (no RAG needed) ────────────────────────────────────────

    if intent == "conversational":
        answer = generate_conversational_response(question, chat_history)
        return {
            "answer": answer,
            "sources": [],
            "chunks_retrieved": 0,
            "intent": intent,
            "graph_entities": [],
            "related_documents": [],
        }

    # clarification_needed is handled AFTER the search below, not here.
    #
    # It used to return immediately, before retrieval ever ran. Measured on the
    # golden set, that discarded 13 of the 18 answerable questions the service
    # got wrong: "What standard of skill and care must a company director
    # exercise?" was met with "could you tell me more about your specific
    # situation?" while the near-identical "What does the Companies Act say
    # about the duties of a director?" was answered correctly from s.189.
    # Nine of the thirteen were Companies Act questions, which is the whole
    # reason that Act scored 5/16 (RAG-REVIEW.md §4.14).
    #
    # Now the search runs first. Asking for clarification is a decision made
    # AFTER looking, not a guess made before.

    if intent == "lawyer_request":
        # Deleted in Phase 5: this used to run generate_lawyer_response(), which
        # classified the person's situation into practice areas and replied
        # "Based on our conversation, I'd recommend consulting a Property
        # Lawyer... I've found some matching lawyers on our platform below."
        #
        # That is the platform selecting practitioners for a person on the basis
        # of what they had just disclosed about their own legal problem. It is
        # rule 4, rule 5 and the 1894 Ordinance in one sentence, and it was the
        # single worst thing left in the codebase.
        logger.info("Refusing lawyer_request — the platform does not choose practitioners")
        return {
            "answer": LAWYER_REQUEST_REFUSAL,
            "sources": [],
            "chunks_retrieved": 0,
            "intent": intent,
            "graph_entities": [],
            "related_documents": [],
        }

    # ── RAG paths (need search) ───────────────────────────────────────────

    if intent == "follow_up":
        search_query = rewrite_query(question, chat_history)
        logger.info(f"Follow-up rewritten: '{search_query[:80]}'")
    else:
        # legal_query, situation_report and clarification_needed all search on
        # the original question.
        search_query = question

    # ── The gate: look before deciding whether there is anything to say ───
    #
    # One search, with the relevance floor applied. Three outcomes:
    #
    #   nothing clears the floor          -> say so, in a fixed string, and stop.
    #                                        No model call at all.
    #   material found, intent was vague  -> answer it. The router's caution is
    #                                        overruled by evidence.
    #   material found, intent was clear  -> carry on as before.
    #
    # This costs one embedding that the agentic path will then repeat, which is
    # the duplicate-retrieval waste already noted in RAG-REVIEW.md §5.3. Paid
    # knowingly: it is the difference between declining to answer and inventing
    # an Act, and Stage 1.3 removes the duplication by carrying results through.
    gate_hits = search_documents(query=search_query, top_k=top_k)

    if not gate_hits:
        if intent == "clarification_needed":
            logger.info("No context and the question was vague — asking for specifics")
            return {**generate_clarification_response(question, chat_history),
                    "intent": intent}
        logger.info("No context cleared the relevance floor — declining to answer")
        return no_context_response(intent)

    if intent == "clarification_needed":
        logger.info(
            "Router said clarification_needed, but retrieval found %d relevant "
            "chunks — answering instead of asking", len(gate_hits),
        )
        intent = "legal_query"

    # Run the RAG pipeline
    if config.ENABLE_AGENTIC_RAG:
        result = _query_rag_agentic(
            question=question,
            search_query=search_query,
            chat_history=chat_history,
            document_filter=document_filter,
        )
    else:
        result = _query_rag_linear(
            question=question,
            search_query=search_query,
            chat_history=chat_history,
            document_filter=document_filter,
            top_k=top_k,
            filter_metadata=filter_metadata,
        )

    # A situation_report used to have this appended to its answer:
    #
    #   "💡 Would you like me to recommend a lawyer who specializes in this
    #    area? Just let me know and I'll show you some options on our platform."
    #
    # Deleted in Phase 5. The trigger for it was the model detecting that a
    # person had just described a personal legal problem — so the platform was
    # offering to steer them toward practitioners at precisely the moment they
    # had disclosed privileged material and were least able to judge the offer.
    # A situation report is now answered like any other question: about the law,
    # never about them.

    result["intent"] = intent
    return result


@traceable(name="Agentic RAG Pipeline")
def _query_rag_agentic(
    question: str,
    search_query: str,
    chat_history: list[dict],
    document_filter: str,
) -> dict:
    """
    Agentic path: delegates to the LangGraph ReAct orchestrator.
    The agent decides which tools to call and in what order.
    Falls back to the linear pipeline if the agent raises an exception.
    """
    from app.core.legal_agent import run_legal_agent

    try:
        # Enrich the question with the document filter hint so the agent
        # can pass it directly to vector_search without extra reasoning steps
        enriched_question = search_query
        if document_filter and document_filter != "All":
            enriched_question = (
                f"{search_query}\n\n[Hint: This question is likely covered by the "
                f"'{document_filter}'. Use it as the document_filter in vector_search.]"
            )

        result = run_legal_agent(
            question=enriched_question,
            chat_history=chat_history[-4:],
        )

        # Strip internal debug keys before returning to the API
        result.pop("_agent_tool_calls", None)

        # If the agent found nothing but the gate did, use the linear path.
        #
        # The agent writes its own search query, and a 3B model writes worse
        # queries than the user does. Measured: asked "Within what time must an
        # application be made to have a deceased person's will proved?" — which
        # scores 0.747 against s.524 — the agent searched for "time limit to
        # prove a deceased person", scoring 0.604, and the relevance floor
        # correctly rejected its paraphrase.
        #
        # Before the floor, that bad query still returned six chunks and the
        # right section happened to be among them, so the weakness was invisible.
        # It was always there. The floor did not cause it; it revealed it.
        #
        # The gate search in query_rag used the USER'S OWN WORDS and did find
        # material, so falling back to the linear pipeline — which searches on
        # the user's question rather than the agent's rewrite — recovers the
        # answer. The proper fix is Stage 1.3, carrying the gate's results
        # through instead of searching three times.
        if not result.get("sources"):
            logger.info(
                "Agent returned no sources though the gate found material — "
                "falling back to the linear pipeline on the user's own wording"
            )
            return _query_rag_linear(
                question=question,
                search_query=search_query,
                chat_history=chat_history,
                document_filter=document_filter,
                top_k=config.TOP_K_RESULTS,
                filter_metadata=None,
            )

        return result

    except Exception as e:
        logger.error(f"Agentic pipeline failed, falling back to linear: {e}")
        # Graceful degradation — fall through to the linear pipeline
        return _query_rag_linear(
            question=question,
            search_query=search_query,
            chat_history=chat_history,
            document_filter=document_filter,
            top_k=config.TOP_K_RESULTS,
            filter_metadata=None,
        )


@traceable(name="Linear RAG Pipeline")
def _query_rag_linear(
    question: str,
    search_query: str,
    chat_history: list[dict],
    document_filter: str,
    top_k: int,
    filter_metadata: Optional[dict],
) -> dict:
    """
    Original linear RAG pipeline — kept as a reliable fallback.
    Runs when ENABLE_AGENTIC_RAG=false or when the agent raises an exception.
    """
    # Build metadata filter from Smart Router's document_filter
    smart_filter = filter_metadata  # Preserve any user-provided filter
    if document_filter and document_filter != "All":
        smart_filter = smart_filter.copy() if smart_filter else {}
        smart_filter["document_name"] = document_filter
        logger.info(f"Smart filter applied: searching only '{document_filter}'")

    # Step 1: Retrieve relevant documents (vector search with smart filter)
    docs_with_scores = search_documents(
        query=search_query,
        top_k=top_k,
        filter_metadata=smart_filter,
    )

    # If smart filter returned too few results, fall back to unfiltered search
    if len(docs_with_scores) < 2 and document_filter != "All":
        logger.info(f"Smart filter '{document_filter}' returned only {len(docs_with_scores)} results, falling back to unfiltered search")
        docs_with_scores = search_documents(
            query=search_query,
            top_k=top_k,
            filter_metadata=filter_metadata,  # Use original filter (or None)
        )

    logger.info(f"Vector search: {len(docs_with_scores)} chunks retrieved")

    # Step 2: Graph expansion — find related entities and documents
    graph_entities, related_doc_names = _graph_expand_retrieval(search_query, docs_with_scores)

    # Step 3: Retrieve additional chunks from graph-discovered documents
    if related_doc_names and config.ENABLE_GRAPH_RAG:
        for doc_name in list(related_doc_names)[:config.GRAPH_EXPANSION_K]:
            try:
                expanded_docs = search_documents(
                    query=search_query,
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

    # Step 6 used to be a DuckDuckGo search whose results were fed to the model
    # as grounding alongside the legislation. Removed in Phase 5.
    #
    # A web result is not a legal authority. Passing one to the model produces an
    # answer that reads exactly like a statute-grounded answer while resting on
    # whatever a search engine returned that morning — and an answer with no
    # legislation behind it is withheld by the application anyway, so this path
    # only ever produced work that could not be published.

    # Step 6: Build prompt and invoke LLM
    llm = get_llm()
    langchain_history = convert_chat_history(chat_history)

    prompt = PROMPT_TEMPLATE.invoke({
        "context": context,
        "graph_context": graph_context,
        "chat_history": langchain_history,
        "question": question,
    })

    response = llm.invoke(prompt)
    answer = response.content

    # Step 7: Extract source citations.
    # These come from vector-store metadata, not from the model, so the model
    # cannot invent an entry here. That is what makes them checkable.
    sources = format_sources(docs_with_scores)

    logger.info(
        f"Generated response: {len(answer)} chars, {len(sources)} sources, "
        f"{len(graph_entities)} graph entities"
    )

    return {
        "answer": answer,
        "sources": sources,
        "chunks_retrieved": len(docs_with_scores),
        "graph_entities": [
            {"name": e.get("name", ""), "type": e.get("type", ""), "relationship": e.get("relationship", "")}
            for e in graph_entities[:10]
        ],
        "related_documents": related_doc_names[:5],
    }
