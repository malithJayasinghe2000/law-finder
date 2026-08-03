"""
LawyerAI RAG System — LangGraph ReAct Agent Orchestrator

Implements an industry-standard ReAct (Reason + Act) agent using LangGraph's
prebuilt `create_react_agent`. The agent:

  1. Receives the user's legal question
  2. Reasons about which tools to call and in what order
  3. Calls tools (vector_search, graph_lookup, section_lookup, verify_answer)
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
  │                  ── section_lookup_tool              │
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
)
from app.config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Agent System Prompt
# ---------------------------------------------------------------------------
AGENT_SYSTEM_PROMPT = """You are LawyerAI, an expert legal assistant specialised in Sri Lankan law.
You help users understand Sri Lankan legislation, legal procedures, and their rights.

AVAILABLE LEGISLATION IN YOUR DATABASE:
- Companies Act (Consolidated, 2024)
- Civil Procedure Code (Consolidated, 2024)
- Motor Traffic Act (Consolidated, 2024)
- Act No. 24 of 2007 — Computer Crimes Act
- Act No. 24 of 2025 — Amendment

IMPORTANT: If the question is about a legal area NOT covered by these Acts
(e.g. Family Law, Property Law, Labour Law, Tax Law, Criminal Law), say plainly
that you do not hold that legislation and stop. Do not answer it from general
knowledge: an answer you cannot cite is withheld before the user sees it, and a
confident guess about the law is the most harmful thing you can produce.
Never suggest what kind of lawyer they need — that choice is not yours to shape.

ABSOLUTE RULES (NEVER BREAK THESE):
- NEVER mention your internal tools to the user. Do not say "vector_search", "verify_answer_tool", "section_lookup_tool", etc. Use them silently.
- NEVER narrate your actions (e.g. "I will call the vector_search function...").
- NEVER output raw JSON or tool call formats in your text response.
- NEVER use placeholder text like "[insert section number]" or "[section X]". If you don't know the exact section, say "as prescribed by the relevant regulations" or omit the reference.
- NEVER provide specific legal advice. Always recommend consulting a professional lawyer for specific cases.
- If context is insufficient, say: "I don't have enough information in my Knowledge Base to answer this accurately. Please consult a qualified lawyer."
- Be conversational and empathetic — the user may be in a stressful legal situation.

TOOLS (use in this order):

1. **vector_search** — Call FIRST for legal questions. Searches the Sri Lankan legislation database. Use document_filter if you know the Act name.

2. **section_lookup_tool** — Retrieves exact text of a specific section from a named Act.

3. **graph_lookup** — Call AFTER vector_search to discover related Acts or amendments.

5. **verify_answer_tool** — Call before your final answer if you are citing specific sections.

ANSWER FORMAT:
- Base answers on retrieved legal documents. Cite Act name and Section number.
- Use clear, simple language. Format with proper paragraph breaks.
- When using web search results, note they may need verification.
- NEVER mention tool names in your response. This is an absolute rule.
"""


# ---------------------------------------------------------------------------
# Source extraction helpers (run post-agent to rebuild structured metadata)
# ---------------------------------------------------------------------------
def _extract_sources_from_tool_calls(messages: list) -> tuple[list[dict], list[dict], list[str]]:
    """
    Walk through the agent's message trace and extract structured metadata
    from tool results for the API response.

    Returns:
        (sources, graph_entities, related_documents)
    """
    from app.core.vectorstore import search_documents

    sources: list[dict] = []
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

    return sources, graph_entities[:10], related_documents[:5]


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
        Dict with keys: answer, sources, chunks_retrieved, graph_entities,
        related_documents.
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

    # Strip reasoning model's <think>...</think> tags
    if final_answer:
        import re as _re
        final_answer = _re.sub(r'<think>.*?</think>', '', final_answer, flags=_re.DOTALL).strip()

    if not final_answer:
        final_answer = "I was unable to process your query. Please try rephrasing your question."

    # ── Extract structured source metadata ──────────────────────────────────
    sources, graph_entities, related_documents = _extract_sources_from_tool_calls(
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
        f"sources: {len(sources)}"
    )

    return {
        "answer": final_answer,
        "sources": sources,
        "chunks_retrieved": chunks_retrieved,
        "graph_entities": graph_entities,
        "related_documents": related_documents,
        # Debug metadata (useful for monitoring, not sent to frontend)
        "_agent_tool_calls": tool_calls_made,
    }
