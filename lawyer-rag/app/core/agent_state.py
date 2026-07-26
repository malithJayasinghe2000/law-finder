"""
LawyerAI RAG System - Agent State Definition

Defines the typed state dict that flows through the LangGraph ReAct agent.
Each field is accumulated as the agent calls tools across multiple steps.
"""

from typing import Annotated, Sequence, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    State that flows through every node in the LangGraph agent.

    Fields:
        messages:          Accumulated conversation messages (user + AI + tool results).
                           Uses `add_messages` reducer to append (not overwrite).
        question:          The original user query (unchanged throughout).
        search_query:      Possibly rewritten query (for follow-up turns).
        docs_context:      Formatted string of retrieved legal document chunks.
        graph_context:     Formatted string of knowledge graph entities/relationships.
        web_context:       Formatted string of web search results.
        sources:           List of source citation dicts (for API response).
        web_sources:       List of web source dicts (for API response).
        graph_entities:    List of graph entity dicts (for API response).
        related_documents: List of related document names (for API response).
        detected_practice_areas: List of detected legal practice area strings.
        chunks_retrieved:  Count of vector chunks retrieved.
        tool_calls_made:   Set of tool names already invoked (prevents redundant calls).
        final_answer:      The agent's synthesized final text answer.
    """
    messages: Annotated[Sequence[BaseMessage], add_messages]
    question: str
    search_query: str
    docs_context: str
    graph_context: str
    web_context: str
    sources: list[dict]
    web_sources: list[dict]
    graph_entities: list[dict]
    related_documents: list[str]
    detected_practice_areas: list[str]
    chunks_retrieved: int
    tool_calls_made: list[str]
    final_answer: str
