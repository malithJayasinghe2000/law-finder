"""
LawyerAI RAG System — LangGraph ReAct Agent Orchestrator

Implements an industry-standard ReAct (Reason + Act) agent using LangGraph's
prebuilt `create_react_agent`. The agent:

  1. Receives the user's legal question
  2. Reasons about which tools to call and in what order
  3. Calls tools (vector_search, graph_lookup, web_search, detect_practice_areas)
  4. Iterates until it has enough context to produce a high-quality answer
  5. Synthesises a final answer with proper citations

The agent is stateless between requests (no persistent LangGraph checkpointer).
Chat history is injected into the initial message list for context.

Architecture:
  ┌─────────────────────────────────────────────────────┐
  │  LangGraph ReAct Agent                              │
  │                                                     │
  │  HumanMessage (question + history)                  │
  │       │                                             │
  │       ▼                                             │
  │  [LLM reasons → decides which tool to call]         │
  │       │                                             │
  │       ▼                                             │
  │  [Tool Executor] ── vector_search                   │
  │                  ── graph_lookup                    │
  │                  ── web_search_tool                 │
  │                  ── detect_practice_areas_tool      │
  │       │                                             │
  │       ▼                                             │
  │  [LLM synthesises final answer]                     │
  └─────────────────────────────────────────────────────┘
"""

import json
import logging
from typing import Optional

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage

from app.core.llm import get_llm
from app.core.agent_tools import AGENT_TOOLS, vector_search, graph_lookup
from app.core.rag_chain import (
    format_sources,
    convert_chat_history,
    detect_practice_areas,
    PRACTICE_AREA_KEYWORDS,
)
from app.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Agent System Prompt
# ---------------------------------------------------------------------------
AGENT_SYSTEM_PROMPT = """You are LawyerAI, an expert legal assistant specialised in Sri Lankan law.
You help users understand Sri Lankan legislation, legal procedures, and their rights.

You have access to the following tools. Use them in this recommended order:

1. **vector_search** — ALWAYS call this first for any legal question. Search the local Sri Lankan 
   legal database for relevant Acts, Sections, and legislation chunks. Use the most specific 
   query possible. If the question mentions a specific Act (e.g. "Motor Traffic Act"), pass that
   as the document_filter parameter.

2. **section_lookup_tool** — Call this to retrieve the exact text of a specific section from a named Act,
   especially if vector_search did not return the precise section requested.

3. **graph_lookup** — Call this AFTER vector_search if you found relevant documents and want to 
   discover related Acts or amendments. Helps find legislation that cross-references the topic.

4. **web_search_tool** — Call this ONLY if:
   - The vector_search returned low-relevance or insufficient results, OR
   - The question involves recent legal developments, gazette notifications, or case law
   Do NOT call web_search if the vector_search already provided sufficient context.

5. **detect_practice_areas_tool** — ALWAYS call this towards the end if you answered a legal question, OR if the user asks about lawyers. Pass a brief summary of the legal topic + the user's question. This classifies the legal domain for lawyer recommendations.

6. **lawyer_recommend_tool** — Call this AFTER detect_practice_areas_tool if the user explicitly asks for a lawyer recommendation (e.g., "can you recommend a lawyer", "find me a lawyer"), OR if the user describes a personal legal situation or dispute where they might need to hire a lawyer.

7. **verify_answer_tool** — Call this right before giving your final answer if you are citing specific 
   sections of Acts, to self-check that the cited sections actually say what you claim they say.

CRITICAL RULES FOR YOUR FINAL ANSWER:
- Base your answer primarily on the legal documents retrieved by vector_search.
- ALWAYS cite the specific Act name and Section number when referencing a law.
- If context is insufficient, state: "I don't have enough information in my Knowledge Base 
  to answer this accurately. Please consult a qualified lawyer."
- Distinguish between Consolidated Acts (full compiled laws) and Amendment Acts (changes to existing laws).
- Use clear, simple language non-lawyers can understand, while maintaining legal accuracy.
- NEVER provide specific legal advice — always recommend consulting a professional lawyer for specific cases.
- When using web search results, note that the information was found online and may need verification.
- Format your response with proper paragraph breaks and section references.
- **NEVER mention your internal tools (like verify_answer_tool, vector_search, etc.) to the user.** You must use the tools yourself internally. Do not ask the user to use them.
"""


# ---------------------------------------------------------------------------
# Source extraction helpers (run post-agent to rebuild structured metadata)
# ---------------------------------------------------------------------------
def _extract_sources_from_tool_calls(messages: list) -> tuple[list[dict], list[dict], list[dict], list[str]]:
    """
    Walk through the agent's message trace and extract structured metadata
    from tool results for the API response.

    Returns:
        (sources, web_sources, graph_entities, related_documents)
    """
    from app.core.vectorstore import search_documents
    from app.core.web_search import web_search as _web_search

    sources: list[dict] = []
    web_sources: list[dict] = []
    graph_entities: list[dict] = []
    related_documents: list[str] = []

    # We re-extract structured data by replaying the tool inputs found in messages
    for msg in messages:
        if not isinstance(msg, AIMessage):
            continue
        if not getattr(msg, "tool_calls", None):
            continue

        for tc in msg.tool_calls:
            tool_name = tc.get("name", "")
            tool_args = tc.get("args", {})

            # Re-run vector search to get structured source metadata
            if tool_name == "vector_search" and not sources:
                try:
                    query = tool_args.get("query", "")
                    document_filter = tool_args.get("document_filter")
                    filter_metadata = None
                    if document_filter and document_filter.lower() not in ("all", "none", ""):
                        filter_metadata = {"document_name": document_filter}

                    docs = search_documents(
                        query=query,
                        top_k=config.TOP_K_RESULTS,
                        filter_metadata=filter_metadata,
                    )
                    if len(docs) < 2 and filter_metadata:
                        docs = search_documents(query=query, top_k=config.TOP_K_RESULTS)

                    sources = format_sources(docs)
                except Exception as e:
                    logger.warning(f"Could not re-extract sources: {e}")

            # Re-run web search to get structured web source metadata
            elif tool_name == "web_search_tool" and not web_sources:
                try:
                    query = tool_args.get("query", "")
                    results = _web_search(query, max_results=3)
                    web_sources = [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("href", ""),
                            "snippet": r.get("body", ""),
                        }
                        for r in results
                    ]
                except Exception as e:
                    logger.warning(f"Could not re-extract web sources: {e}")

            # Extract graph context from graph_lookup
            elif tool_name == "graph_lookup":
                try:
                    from app.core.graph_store import get_knowledge_graph
                    from app.core.entity_extractor import extract_entities_regex
                    query = tool_args.get("query", "")
                    entities, _ = extract_entities_regex(query)
                    kg = get_knowledge_graph()
                    for entity in entities[:3]:
                        related = kg.get_related_entities(entity.entity_id, max_depth=1)
                        for r in related[:5]:
                            graph_entities.append({
                                "name": r.get("name", ""),
                                "type": r.get("type", ""),
                                "relationship": r.get("relationship", ""),
                            })
                            doc_name = r.get("document_name", "")
                            if doc_name and doc_name not in related_documents:
                                related_documents.append(doc_name)
                except Exception as e:
                    logger.warning(f"Could not extract graph entities: {e}")

    return sources, web_sources, graph_entities[:10], related_documents[:5]


# ---------------------------------------------------------------------------
# Main agent runner
# ---------------------------------------------------------------------------
def run_legal_agent(
    question: str,
    chat_history: Optional[list[dict]] = None,
) -> dict:
    """
    Run the LangGraph ReAct legal agent on a user question.

    The agent will dynamically decide which tools to call and will iterate
    until it produces a satisfactory final answer.

    Args:
        question:      The user's legal question.
        chat_history:  Previous conversation turns as list of {role, content} dicts.

    Returns:
        Dict with keys: answer, sources, web_sources, chunks_retrieved,
        detected_practice_areas, graph_entities, related_documents.
    """
    from langgraph.prebuilt import create_react_agent

    if chat_history is None:
        chat_history = []

    logger.info(f"[LegalAgent] Starting for: '{question[:100]}'")

    # ── Build the LLM with tools bound ─────────────────────────────────────
    llm = get_llm()
    llm_with_tools = llm.bind_tools(AGENT_TOOLS)

    # ── Build initial message list ──────────────────────────────────────────
    # Convert chat history to LangChain messages
    lc_history = convert_chat_history(
        chat_history[-6:] if len(chat_history) > 6 else chat_history
    )

    initial_messages = [SystemMessage(content=AGENT_SYSTEM_PROMPT)]
    initial_messages.extend(lc_history)
    initial_messages.append(HumanMessage(content=question))

    # ── Create and run the ReAct agent ─────────────────────────────────────
    agent = create_react_agent(
        model=llm_with_tools,
        tools=AGENT_TOOLS,
    )

    agent_config = {
        "recursion_limit": config.AGENT_MAX_ITERATIONS,
    }

    try:
        result = agent.invoke(
            {"messages": initial_messages},
            config=agent_config,
        )
    except Exception as e:
        logger.error(f"[LegalAgent] Agent execution failed: {e}")
        # Graceful fallback — extract whatever answer the agent had before failing
        raise

    all_messages = result.get("messages", [])

    # ── Extract the final answer ────────────────────────────────────────────
    final_answer = ""
    for msg in reversed(all_messages):
        if isinstance(msg, AIMessage) and msg.content and not getattr(msg, "tool_calls", None):
            final_answer = msg.content
            break

    if not final_answer:
        final_answer = "I was unable to process your query. Please try rephrasing your question."

    # ── Collect detected practice areas from tool messages ──────────────────
    detected_practice_areas: list[str] = []
    for msg in all_messages:
        if isinstance(msg, ToolMessage) and "detect_practice_areas" in getattr(msg, "name", ""):
            try:
                areas = json.loads(msg.content)
                if isinstance(areas, list):
                    detected_practice_areas = areas
            except (json.JSONDecodeError, TypeError):
                pass

    # Fallback: extract from final answer if tool wasn't called or returned empty
    if not detected_practice_areas:
        detected_practice_areas = detect_practice_areas(question, final_answer)

    # ── Extract structured source metadata ──────────────────────────────────
    sources, web_sources, graph_entities, related_documents = _extract_sources_from_tool_calls(
        all_messages
    )

    # Count chunks retrieved from sources
    chunks_retrieved = len(sources)

    # ── Log agent trace summary ─────────────────────────────────────────────
    tool_calls_made = []
    for msg in all_messages:
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            for tc in msg.tool_calls:
                tool_calls_made.append(tc.get("name", "unknown"))

    logger.info(
        f"[LegalAgent] Done — tools called: {tool_calls_made}, "
        f"answer: {len(final_answer)} chars, "
        f"sources: {len(sources)}, practice_areas: {detected_practice_areas}"
    )

    return {
        "answer": final_answer,
        "sources": sources,
        "web_sources": web_sources,
        "chunks_retrieved": chunks_retrieved,
        "detected_practice_areas": detected_practice_areas,
        "graph_entities": graph_entities,
        "related_documents": related_documents,
        # Debug metadata (useful for monitoring, not sent to frontend)
        "_agent_tool_calls": tool_calls_made,
    }
