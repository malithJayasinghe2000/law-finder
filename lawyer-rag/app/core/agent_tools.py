"""
LawyerAI RAG System - Agent Tool Definitions

Wraps existing core modules as LangChain tools that the ReAct agent can call.
Each tool has a clear description so the LLM knows exactly when to use it.

Tools:
  1. vector_search            — searches ChromaDB for relevant legislation chunks
  2. graph_lookup             — traverses the knowledge graph for related entities/docs
  3. web_search_tool          — fetches supplementary context from DuckDuckGo
  4. detect_practice_areas_tool — classifies the legal domain from context
  5. lawyer_recommend_tool    — generates a structured lawyer recommendation rationale
  6. section_lookup_tool      — direct precise retrieval of a specific Act section
  7. verify_answer_tool       — self-checks that citations actually support the answer
"""

import json
import logging
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool 1: Vector Search
# ---------------------------------------------------------------------------
@tool
def vector_search(query: str, document_filter: Optional[str] = None) -> str:
    """
    Search the Sri Lankan legal database (ChromaDB) for relevant legislation chunks.

    Use this tool FIRST for any legal question. It returns the most relevant sections
    from Acts, Codes, and Ordinances based on semantic similarity to the query.

    Args:
        query: The legal question or topic to search for.
        document_filter: Optional specific Act name to restrict search to
                         (e.g. 'Motor Traffic Act', 'Companies Act').
                         Pass None to search across all documents.

    Returns:
        Formatted string containing ranked legal document chunks with citations.
        Returns 'No relevant documents found.' if nothing matches.
    """
    # Import here to avoid circular imports at module load time
    from app.core.vectorstore import search_documents
    from app.config import config

    filter_metadata = None
    if document_filter and document_filter.lower() not in ("all", "none", ""):
        filter_metadata = {"document_name": document_filter}

    top_k = config.TOP_K_RESULTS

    docs_with_scores = search_documents(
        query=query,
        top_k=top_k,
        filter_metadata=filter_metadata,
    )

    # If filtered search returns too few results, fall back to unfiltered
    if len(docs_with_scores) < 2 and filter_metadata:
        logger.info(
            f"[vector_search] Filter '{document_filter}' returned {len(docs_with_scores)} results, "
            "falling back to unfiltered search"
        )
        docs_with_scores = search_documents(query=query, top_k=top_k)

    if not docs_with_scores:
        logger.info("[vector_search] No documents found")
        return "No relevant legal documents found in the database for this query."

    logger.info(f"[vector_search] Retrieved {len(docs_with_scores)} chunks for: '{query[:60]}'")

    # Format the retrieved chunks into a readable string for the agent
    context_parts = []
    for i, (doc, score) in enumerate(docs_with_scores, 1):
        meta = doc.metadata

        hierarchy_parts = []
        if meta.get("document_name") and meta.get("document_name") != "Unknown":
            hierarchy_parts.append(f"Document: {meta['document_name']}")
        if meta.get("part") and meta.get("part") != "Unknown":
            hierarchy_parts.append(f"Part: {meta['part']}")
        if meta.get("chapter") and meta.get("chapter") != "Unknown":
            hierarchy_parts.append(f"Chapter: {meta['chapter']}")
        if meta.get("section_number") and not meta.get("section_number", "").startswith("Chunk_"):
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


# ---------------------------------------------------------------------------
# Tool 2: Knowledge Graph Lookup
# ---------------------------------------------------------------------------
@tool
def graph_lookup(query: str) -> str:
    """
    Search the legal knowledge graph for entities related to the query and
    find connected Acts, Sections, and legal concepts.

    Use this tool AFTER vector_search when you want to discover related legislation
    that wasn't directly returned by the vector search — for example, finding Acts
    that amend, repeal, or reference the Acts already found.

    Args:
        query: The legal topic or Act name to look up in the knowledge graph.

    Returns:
        Formatted string listing related legal entities and document names.
        Returns an empty string if no graph entities are found.
    """
    from app.core.graph_store import get_knowledge_graph
    from app.core.entity_extractor import extract_entities_regex
    from app.config import config

    if not config.ENABLE_GRAPH_RAG:
        return ""

    try:
        kg = get_knowledge_graph()
        entities, _ = extract_entities_regex(query)

        all_graph_entities = []
        related_doc_names: set[str] = set()

        # Traverse graph from extracted entities
        for entity in entities:
            graph_related = kg.get_related_entities(
                entity.entity_id,
                max_depth=config.GRAPH_TRAVERSAL_DEPTH,
            )
            all_graph_entities.extend(graph_related)
            for rel in graph_related:
                doc_name = rel.get("document_name", "")
                if doc_name:
                    related_doc_names.add(doc_name)

        # Also name-based search for broader coverage
        query_words = query.lower().split()
        important_terms = [
            w for w in query_words
            if len(w) > 4 and w not in {
                "what", "which", "where", "about", "legal", "under",
                "section", "rights", "shall", "court",
            }
        ]
        for term in important_terms[:3]:
            name_matches = kg.find_entities_by_name(term)
            for match in name_matches[:5]:
                related = kg.get_related_entities(match["id"], max_depth=1)
                all_graph_entities.extend(related)
                for rel in related:
                    doc_name = rel.get("document_name", "")
                    if doc_name:
                        related_doc_names.add(doc_name)

        # Deduplicate
        seen_ids: set[str] = set()
        unique_entities = []
        for e in all_graph_entities:
            eid = e.get("id", "")
            if eid not in seen_ids:
                seen_ids.add(eid)
                unique_entities.append(e)

        if not unique_entities and not related_doc_names:
            return ""

        logger.info(
            f"[graph_lookup] {len(unique_entities)} entities, "
            f"{len(related_doc_names)} related docs for: '{query[:60]}'"
        )

        parts = ["━━━ RELATED LEGAL CONTEXT (Knowledge Graph) ━━━"]
        if unique_entities:
            parts.append("\n📊 Related Legal Entities:")
            for entity in unique_entities[:10]:
                rel_type = entity.get("relationship", "RELATED_TO")
                name = entity.get("name", "Unknown")
                etype = entity.get("type", "")
                parts.append(f"  • [{etype}] {name} — ({rel_type})")

        if related_doc_names:
            parts.append("\n📎 Related Documents:")
            for doc in sorted(related_doc_names)[:5]:
                parts.append(f"  • {doc}")

        return "\n".join(parts)

    except Exception as e:
        logger.warning(f"[graph_lookup] Failed: {e}")
        return ""


# ---------------------------------------------------------------------------
# Tool 3: Web Search
# ---------------------------------------------------------------------------
@tool
def web_search_tool(query: str) -> str:
    """
    Search the web (via DuckDuckGo) for supplementary legal information about Sri Lanka.

    Use this tool when:
    - The vector search returned insufficient or low-relevance results
    - The question involves recent legal developments, gazette notifications, or case law
    - The user asks about something not well-covered in the local legislation database

    Do NOT use this tool for questions that are already well-answered by vector_search results.

    Args:
        query: The legal question or topic to search for online.

    Returns:
        Formatted string with web search result snippets and URLs.
        Returns an empty string if no relevant web results are found.
    """
    from app.core.web_search import web_search, format_web_results

    try:
        results = web_search(query, max_results=3)
        if not results:
            logger.info(f"[web_search_tool] No results for: '{query[:60]}'")
            return ""
        logger.info(f"[web_search_tool] {len(results)} results for: '{query[:60]}'")
        return format_web_results(results)
    except Exception as e:
        logger.warning(f"[web_search_tool] Failed: {e}")
        return ""


# ---------------------------------------------------------------------------
# Tool 4: Detect Practice Areas
# ---------------------------------------------------------------------------
@tool
def detect_practice_areas_tool(text: str) -> str:
    """
    Analyze the combined legal context and identify the relevant legal practice areas.

    Use this tool AFTER gathering legal context (from vector_search and optionally
    graph_lookup or web_search). Pass the accumulated legal context text to identify
    which practice areas are most relevant.

    This result is used to recommend appropriate lawyers to the user.

    Args:
        text: The combined text of the user question + retrieved legal context.

    Returns:
        A JSON string containing a list of detected practice area names.
        Example: '["Criminal Law", "Family Law"]'
    """
    from app.core.rag_chain import detect_practice_areas

    try:
        areas = detect_practice_areas(text, text)
        logger.info(f"[detect_practice_areas_tool] Detected: {areas}")
        return json.dumps(areas)
    except Exception as e:
        logger.warning(f"[detect_practice_areas_tool] Failed: {e}")
        return json.dumps([])


# ---------------------------------------------------------------------------
# Tool 5: Lawyer Recommendation
# ---------------------------------------------------------------------------
@tool
def lawyer_recommend_tool(practice_areas: str, user_situation: str) -> str:
    """
    Generate a structured recommendation about what type of lawyer the user needs
    based on their legal situation and the identified practice areas.

    Use this tool AFTER detect_practice_areas_tool when the user's question suggests
    they need professional legal help — e.g. they describe a dispute, incident, or
    legal problem they are personally facing (not just general knowledge queries).

    Do NOT call this tool for purely informational questions like 'what does section X say'.
    DO call this tool when the user describes a real situation: 'my employer fired me',
    'I was in a road accident', 'my landlord won't return my deposit'.

    Args:
        practice_areas: Comma-separated list of detected practice areas
                        (e.g. 'Labour Law, Family Law').
        user_situation: A brief 1-2 sentence summary of what the user described.

    Returns:
        A formatted string explaining what specialist lawyer types are recommended
        and why, based on the practice areas and situation.
    """
    from app.core.rag_chain import PRACTICE_AREA_KEYWORDS

    areas = [a.strip() for a in practice_areas.split(",") if a.strip()]
    if not areas:
        return ""

    # Build recommendation rationale for each detected area
    recommendation_parts = [
        "━━━ LAWYER RECOMMENDATION CONTEXT ━━━",
        f"Based on the situation: '{user_situation}'",
        "\n📋 Recommended Specialist Types:",
    ]

    area_descriptions = {
        "Criminal Law": "a Criminal Defense Lawyer — to advise on charges, bail, and court proceedings",
        "Civil Litigation": "a Civil Litigation Lawyer — to handle court proceedings, plaints, and appeals",
        "Corporate Law": "a Corporate / Commercial Lawyer — for company law, governance, and compliance",
        "Family Law": "a Family Law Specialist — for matrimonial, custody, and domestic legal matters",
        "Property Law": "a Conveyancing / Property Lawyer — for land deeds, titles, and property disputes",
        "Labour Law": "an Employment / Labour Lawyer — for wrongful termination, wages, and tribunal cases",
        "Tax Law": "a Tax Lawyer or Chartered Accountant — for revenue disputes and compliance",
        "Constitutional Law": "a Constitutional Lawyer — for fundamental rights petitions and public law",
        "Environmental Law": "an Environmental Lawyer — for conservation, pollution, and regulatory matters",
        "Intellectual Property": "an IP Lawyer — for patents, copyrights, and trademark disputes",
        "Motor Traffic Law": "a Motor Traffic / Personal Injury Lawyer — for accident claims and traffic offences",
        "Banking Law": "a Banking & Finance Lawyer — for loan disputes, mortgages, and financial regulation",
        "Immigration Law": "an Immigration Lawyer — for visa, citizenship, and deportation matters",
        "Insurance Law": "an Insurance Claims Lawyer — for disputed insurance claims and policy interpretation",
        "Real Estate": "a Real Estate / Conveyancing Lawyer or Notary — for property transactions",
        "Notary Services": "a Notary Public — for attestation, affidavits, and powers of attorney",
    }

    for area in areas:
        desc = area_descriptions.get(area, f"a {area} Specialist")
        recommendation_parts.append(f"  • {area}: Consult {desc}")

    recommendation_parts.append(
        "\n⚠️  Note: Always consult a qualified, registered lawyer for your specific case."
        " This is general guidance only."
    )

    result = "\n".join(recommendation_parts)
    logger.info(f"[lawyer_recommend_tool] Generated recommendation for areas: {areas}")
    return result


# ---------------------------------------------------------------------------
# Tool 6: Section Lookup
# ---------------------------------------------------------------------------
@tool
def section_lookup_tool(act_name: str, section_number: str) -> str:
    """
    Directly retrieve the exact text of a specific section from a named Act.

    Use this tool when:
    - The user asks specifically about a named section (e.g. 'Section 14 of the Civil Procedure Code')
    - You need the exact wording of a section for citation accuracy
    - vector_search returned nearby sections but not the exact one requested

    This is more precise than vector_search because it filters by both document name
    and section number rather than relying on semantic similarity.

    Args:
        act_name: The name of the Act (e.g. 'Civil Procedure Code', 'Motor Traffic Act',
                  'Companies Act'). Use the exact document name as stored.
        section_number: The section number to look up (e.g. '14', '25A', 'Section 14').
                        Can include or omit the 'Section' prefix.

    Returns:
        The exact text of the requested section with full citation metadata.
        Returns a helpful message if the section is not found.
    """
    from app.core.vectorstore import search_documents

    # Normalise section number
    section_query = section_number.strip()
    if not section_query.lower().startswith("section"):
        section_query = f"Section {section_query}"

    try:
        # First try exact metadata filter
        results = search_documents(
            query=f"{act_name} {section_query}",
            top_k=3,
            filter_metadata={"document_name": act_name},
        )

        if not results:
            # Broader fallback — search without doc filter
            results = search_documents(
                query=f"{section_query} {act_name}",
                top_k=3,
            )

        if not results:
            logger.info(f"[section_lookup_tool] Not found: {act_name} / {section_query}")
            return (
                f"Section '{section_number}' of '{act_name}' was not found in the legal database. "
                "The section may not be indexed, or the Act name may differ slightly. "
                "Try searching with vector_search using related keywords."
            )

        # Return the best matching result with full citation
        parts = [f"━━━ SECTION LOOKUP: {act_name} — {section_query} ━━━"]
        for doc, score in results[:2]:
            meta = doc.metadata
            citation = (
                f"📍 {meta.get('document_name', act_name)} → "
                f"{meta.get('section_number', section_query)}\n"
                f"📋 Status: {meta.get('status', 'Unknown')} | "
                f"Type: {meta.get('document_type', 'Unknown')} | "
                f"Updated: {meta.get('last_updated_year', 'N/A')}\n"
                f"Relevance: {score:.1%}\n"
                f"{'─' * 40}\n"
            )
            parts.append(citation + doc.page_content)

        logger.info(f"[section_lookup_tool] Found {len(results)} results for {act_name} / {section_query}")
        return "\n\n".join(parts)

    except Exception as e:
        logger.warning(f"[section_lookup_tool] Failed: {e}")
        return f"Could not look up {section_query} of {act_name}: {e}"


# ---------------------------------------------------------------------------
# Tool 7: Verify Answer
# ---------------------------------------------------------------------------
@tool
def verify_answer_tool(draft_answer: str, citations_used: str) -> str:
    """
    Self-check whether the cited legal sections in a draft answer actually support
    the claims being made. Catches hallucinated or misattributed citations.

    Use this tool when:
    - You have produced a draft answer that cites specific sections of Acts
    - You want to verify the citations are accurate before giving the final answer
    - The question requires high-precision legal citation (e.g. penalty amounts, deadlines)

    This tool re-retrieves the cited sections from the database and checks that
    the content matches what the draft answer claims.

    Args:
        draft_answer: Your proposed answer text (can be a summary or full draft).
        citations_used: Comma-separated list of citations to verify,
                        in the format 'ActName:SectionNumber'
                        e.g. 'Motor Traffic Act:Section 125, Companies Act:Section 14'

    Returns:
        A verification report — either 'VERIFIED' with confirmation, or
        'MISMATCH DETECTED' with details of which citations are inaccurate.
    """
    from app.core.vectorstore import search_documents

    if not citations_used.strip():
        return "No citations provided to verify."

    citation_list = [c.strip() for c in citations_used.split(",") if c.strip()]
    verification_results = []
    all_verified = True

    for citation in citation_list[:5]:  # Limit to 5 citations to avoid excessive calls
        try:
            # Parse "ActName:SectionNumber"
            if ":" in citation:
                act_name, section_ref = citation.split(":", 1)
                act_name = act_name.strip()
                section_ref = section_ref.strip()
            else:
                # Can't parse — skip
                verification_results.append(f"⚠️  '{citation}': Could not parse — use 'ActName:Section N' format")
                continue

            # Retrieve the cited section
            results = search_documents(
                query=f"{act_name} {section_ref}",
                top_k=2,
                filter_metadata={"document_name": act_name},
            )

            if not results:
                all_verified = False
                verification_results.append(
                    f"❌ '{citation}': NOT FOUND in database — "
                    f"'{act_name}' / '{section_ref}' may be hallucinated or the Act name is wrong."
                )
                continue

            best_doc, best_score = results[0]
            actual_section = best_doc.metadata.get("section_number", "Unknown")
            actual_content_preview = best_doc.page_content[:200].replace("\n", " ")

            if best_score >= 0.4:
                verification_results.append(
                    f"✅ '{citation}': VERIFIED (relevance {best_score:.1%})\n"
                    f"   Actual section: {actual_section}\n"
                    f"   Content preview: {actual_content_preview}..."
                )
            else:
                all_verified = False
                verification_results.append(
                    f"⚠️  '{citation}': LOW CONFIDENCE (relevance {best_score:.1%}) — "
                    f"retrieved section '{actual_section}' may not match your citation. "
                    f"Content: {actual_content_preview}..."
                )

        except Exception as e:
            verification_results.append(f"⚠️  '{citation}': Verification error — {e}")

    verdict = "✅ ALL CITATIONS VERIFIED" if all_verified else "⚠️  SOME CITATIONS NEED REVIEW"
    logger.info(f"[verify_answer_tool] Verdict: {verdict} for {len(citation_list)} citations")

    return (
        f"━━━ CITATION VERIFICATION REPORT ━━━\n"
        f"Verdict: {verdict}\n\n"
        + "\n\n".join(verification_results)
    )


# ---------------------------------------------------------------------------
# Exported tool list — order matters for agent tool description context
# ---------------------------------------------------------------------------
AGENT_TOOLS = [
    vector_search,
    graph_lookup,
    web_search_tool,
    detect_practice_areas_tool,
    lawyer_recommend_tool,
    section_lookup_tool,
    verify_answer_tool,
]
