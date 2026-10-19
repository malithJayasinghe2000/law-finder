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
import re
from typing import Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langsmith import traceable

from app.core.llm import get_llm, message_text
from app.core.vectorstore import search_documents, hybrid_search
from app.core.synonyms import expand_query
from app.core.corpus import corpus_bullets, held_legislation, DISPLAY_NAMES
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
# {legislation} is filled at call time from app/core/corpus.py. It was a
# hardcoded list of five Acts, and on 2026-09-20 nine more were ingested while
# this block went on naming the original five — so the model was told it did not
# hold legislation that retrieval was handing it. See corpus.py for what that
# produced.
SYSTEM_PROMPT = """You are a legal information assistant for Sri Lankan law.
You are NOT a lawyer and you are NOT anyone's lawyer.

LEGISLATION AVAILABLE TO YOU:
{legislation}

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
4. THE SAME RULE APPLIES TO SECTION NUMBERS. Do not cite a section that is not
   in the LEGAL CONTEXT below, even when the Act itself is there and even when
   you are confident the section exists. "Section 207 of the Companies Act" is
   a violation if the context contains only s.206 — the Act is real, s.207 may
   be real, and the sentence still misleads, because a reader cannot tell the
   difference between a section you read and one you remembered.
5. Do not add related provisions, background or cross-references of your own.
   Answer the question asked, from the context given, and stop. A short
   grounded answer beats a thorough one that is partly from memory.
6. If the LEGAL CONTEXT does not answer the question, say exactly that and stop.
   Do not fill the gap from memory.
7. Distinguish Consolidated Acts from Amendment Acts.

STYLE:
- Plain language a non-lawyer can follow, without losing legal accuracy.
- NEVER refer to "the provided context", "the legal context", "the retrieved
  text" or "the provided provisions". The reader never sees any context; to them
  it is jargon. Say "the Acts I hold" or "the legislation I hold" instead:
    NOT:  "The provided legal context does not contain the definition."
    SAY:  "The Acts I hold do not set out the definition."
- Proper paragraph breaks.
- WRITE IMPERSONALLY. Describe what the law requires of a person in general —
  "a company must apply to the Registrar", "an applicant must file" — never
  "you should" or "you must". Second person turns an explanation of the law into
  an instruction to the reader, which is advice, and the answer will be withheld
  before they see it. Same sentence, different subject:
    WITHHELD:  "You should file the application with the Registrar."
    PUBLISHED: "An applicant must file the application with the Registrar."
  This is not a style preference. It is the difference between explaining the
  law and telling somebody what to do about their case.
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

def _corpus_titles() -> list[str]:
    """
    The legislation actually held. Thin alias over app/core/corpus.py.

    This module used to own the cache and the display-name map. They moved so
    that the SYSTEM PROMPTS and the ROUTER could share them — those were the
    places still naming a hardcoded five Acts when nine more were ingested.
    """
    return held_legislation()


# A question that cannot stand on its own: "tell me more about that", "explain
# more", "what about it". Short, and leaning on something said earlier.
#
# Kept deliberately tight — it must not catch a real question that happens to
# contain "that", so it requires the question to be SHORT as well as anaphoric.
_ANAPHORIC = re.compile(
    r"^\s*(and\s+)?(tell me more|explain( more| further)?|more( detail| info| about)?|"
    r"go on|continue|what about (that|it|this)|elaborate|expand|why( is)? (that|it)|"
    r"(tell me )?more about (that|it|this))\b",
    re.IGNORECASE,
)


def looks_anaphoric(question: str) -> bool:
    """True when a question only makes sense as a follow-up."""
    q = (question or "").strip()
    return len(q.split()) <= 8 and bool(_ANAPHORIC.match(q))


def no_history_response(intent: str) -> dict:
    """
    The answer to a follow-up asked with no conversation behind it.

    Without this, such a question fell through to no_context_response and was
    told "I do not hold legislation covering that" — which is FALSE and
    confusing. The corpus may hold the subject perfectly well; what is missing
    is any way to know what "that" refers to.

    This happens for real: a signed-out visitor has no stored conversation (see
    the history note in src/app/api/ai/ask/route.ts — history is read from the
    database for a signed-in user so a client cannot fabricate a conversation to
    steer the model), so every question a guest asks is a first turn. Reported by
    a user on 2026-09-13, who quite reasonably read the old message as the
    assistant having lost the legislation it had just quoted.

    Saying the true thing costs nothing and removes the confusion.
    """
    return {
        "answer": (
            "I am not sure what \"that\" refers to — I do not have the earlier part of "
            "this conversation.\n\n"
            "Could you ask the whole question in one go? For example, instead of "
            "*\"tell me more about that\"*, try *\"tell me more about removing a company "
            "director under the Companies Act\"*.\n\n"
            "If you sign in, I can follow a conversation across several questions."
        ),
        "sources": [],
        "chunks_retrieved": 0,
        "intent": intent,
        "needs_context": True,
        "graph_entities": [],
        "related_documents": [],
    }


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

    # ⚠️ ONLY the fast path may answer conversationally without searching.
    #
    # `generate_conversational_response` is a free-form LLM call with NO
    # retrieval, no relevance floor, no sources and nothing for the citation
    # check to bite on. It is the one path in this service that is ALLOWED to
    # speak from the model's memory, on the assumption that it is only ever
    # reached by "hi" and "thanks".
    #
    # A 3B router broke that assumption. Reported by the owner on 2026-09-21:
    #
    #     "what is the process of register a company"
    #       -> router: intent=conversational ("a general inquiry about the
    #          process of registering a company, which falls under the
    #          conversational intent category")
    #       -> no search, 0 sources, and a confident invented answer:
    #          a "Sri Lanka Companies Registration Department database", a
    #          "Memorandum and Articles of Association" (the 2007 Act abolished
    #          the memorandum), a "Share Capital Deed" (not a thing), and
    #          Central Bank approval.
    #
    # Nothing downstream could catch it: there were no citations to check, so
    # `findUnsupportedProseCitations` had nothing to compare. The answer was
    # withheld only because it happened to say "you'll need to" and tripped the
    # ADVICE gate — luck standing in for a control, and the user saw a refusal
    # about legal advice for a perfectly general question.
    #
    # So the router's conversational verdict is now treated exactly like its
    # clarification_needed verdict (§4.14): a guess to be overruled by
    # evidence. Search first; if nothing clears the floor, it really was small
    # talk and the conversational reply is correct.
    if intent == "conversational" and routing.get("source") == "fast":
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

    if intent == "lawyer_request" and routing.get("source") == "fast":
        # Deleted in Phase 5: this used to run generate_lawyer_response(), which
        # classified the person's situation into practice areas and replied
        # "Based on our conversation, I'd recommend consulting a Property
        # Lawyer... I've found some matching lawyers on our platform below."
        #
        # That is the platform selecting practitioners for a person on the basis
        # of what they had just disclosed about their own legal problem. It is
        # rule 4, rule 5 and the 1894 Ordinance in one sentence, and it was the
        # single worst thing left in the codebase.
        #
        # ── Why this is gated on source == "fast" ──────────────────────────
        #
        # `lawyer_request` was the LAST intent whose path skipped retrieval on
        # the 3B router's opinion alone. §4.35 is what that costs: the router
        # called "what is the process of register a company" small talk, the
        # no-retrieval path invented company law, and the user was shown a
        # refusal about legal advice they had never asked for.
        #
        # This is the same shape, one intent over, and it was measured rather
        # than assumed. Of thirteen ways of asking for a practitioner, the old
        # deterministic regex caught ONE; the other twelve reached this refusal
        # only because a 3-billion-parameter model happened to agree. When the
        # model is wrong in the other direction, a general legal question gets a
        # fixed touting refusal with no retrieval, no sources and no recourse.
        #
        # So the rule is now the one §4.35 asks for in as many words: *every
        # intent whose path skips retrieval must be reachable only by a
        # deterministic rule, never by the model's opinion.* The rule is
        # `matches_lawyer_request`, which was widened at the same time to cover
        # the twelve forms it was missing.
        #
        # An LLM-produced `lawyer_request` verdict does NOT return here. It
        # falls through to the search below and survives only as a fallback
        # when nothing clears the relevance floor — exactly how the router's
        # `conversational` verdict is treated above.
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
    gate_hits = hybrid_search(query=search_query, top_k=top_k)

    # ── Second chance for a follow-up ─────────────────────────────────────
    #
    # "tell me more about that" carries none of its own meaning. Searched
    # literally it scores 0.350 and the floor correctly rejects it; rewritten
    # against the conversation it becomes "What specific provisions of the
    # Companies Act relate to the removal of a director from office?" and scores
    # 0.761.
    #
    # This is NOT gated on intent == "follow_up", deliberately. The router is a
    # 3B model and it classified exactly this question as `legal_query`, so
    # trusting it here would leave the bug in place for the cases that matter
    # most — the ones where it guesses wrong. The test is evidence instead: we
    # have history, the literal question found nothing, so try the question the
    # conversation implies before declaring the corpus empty.
    #
    # It costs an extra LLM call ONLY when a search has already failed, so a
    # question that stands on its own pays nothing.
    #
    # Found by a user, not by the evaluation set: every question in
    # eval/questions.yaml was single-turn, so multi-turn was untested. Follow-up
    # cases were added at the same time as this fix.
    if not gate_hits and chat_history and search_query == question:
        rewritten = rewrite_query(question, chat_history)
        if rewritten and rewritten.strip() and rewritten != question:
            retry_hits = hybrid_search(query=rewritten, top_k=top_k)
            if retry_hits:
                logger.info(
                    "Follow-up rescued: %r found nothing, %r found %d chunks",
                    question[:60], rewritten[:60], len(retry_hits),
                )
                gate_hits = retry_hits
                search_query = rewritten
                # It WAS a follow-up, whatever the router said.
                intent = "follow_up"

    # ── Third chance: the user's words, in the statute's vocabulary ───────
    #
    # Lay language and statutory language are different registers for the same
    # thing, and the gap is wide enough to fail the relevance floor. A user
    # asked "what is the process of company registration" and was told the
    # service holds no legislation covering it — while holding the Companies
    # Act, which says "incorporation" 108 times, "company registration" once,
    # and "register a company" never.
    #
    # Deliberately LAST, and deliberately conditional on having found nothing:
    # a question that already retrieves is never touched, so this cannot make a
    # working query worse. It can only add one more attempt to one that has
    # already failed, and it costs a single embedding when it runs at all.
    #
    # This is a patch over a retrieval weakness, not a fix for it. Stage 2.1
    # (hybrid search with BM25) matches literal words without anyone
    # maintaining a word list, and would have caught "registration" on the
    # first attempt. See app/core/synonyms.py.
    if not gate_hits:
        expanded = expand_query(search_query)
        if expanded:
            expanded_hits = hybrid_search(query=expanded, top_k=top_k)
            if expanded_hits:
                logger.info(
                    "Vocabulary rescued: %r found nothing, %r found %d chunks",
                    search_query[:60], expanded[:60], len(expanded_hits),
                )
                gate_hits = expanded_hits
                search_query = expanded
                # The router may have called this vague because IT did not
                # recognise the lay wording either. Retrieval has now found
                # material, and evidence outranks the router — the same
                # reasoning as the clarification gate above (§4.14).
                if intent == "clarification_needed":
                    intent = "legal_query"

    if not gate_hits:
        # A follow-up with nothing behind it. Say the true thing — that the
        # reference cannot be resolved — rather than claiming not to hold the
        # legislation, which may be false and is what a user reported as
        # confusing.
        if looks_anaphoric(question) and not chat_history:
            logger.info("Anaphoric question with no history — asking for the full question")
            return no_history_response(intent)

        if intent == "conversational":
            # The router called it small talk and retrieval found nothing to
            # contradict that, so it probably was. This is the ONLY route to the
            # ungrounded reply other than the exact-match fast path.
            logger.info("No context and the router said conversational — replying as small talk")
            answer = generate_conversational_response(question, chat_history)
            return {
                "answer": answer,
                "sources": [],
                "chunks_retrieved": 0,
                "intent": intent,
                "graph_entities": [],
                "related_documents": [],
            }

        if intent == "lawyer_request":
            # The router said this was a request for a practitioner, the
            # deterministic rule did not agree, and retrieval found nothing to
            # contradict the router. Nothing was suppressed by guessing: the
            # search ran first and came back empty.
            #
            # The touting refusal is the better message of the two available
            # here. "I do not hold legislation covering that" is the wrong
            # thing to say to somebody asking for a lawyer — the corpus is not
            # the reason we will not answer — and this message ends by offering
            # to explain the law on whatever they are dealing with, which is
            # the useful half.
            logger.info(
                "No context and the router said lawyer_request — declining to "
                "choose a practitioner"
            )
            return {
                "answer": LAWYER_REQUEST_REFUSAL,
                "sources": [],
                "chunks_retrieved": 0,
                "intent": intent,
                "graph_entities": [],
                "related_documents": [],
            }

        if intent == "clarification_needed":
            logger.info("No context and the question was vague — asking for specifics")
            return {**generate_clarification_response(question, chat_history),
                    "intent": intent}
        logger.info("No context cleared the relevance floor — declining to answer")
        return no_context_response(intent)

    # Evidence overrules the router's guess. Only LLM-produced verdicts get
    # this far: an exact-match greeting and a deterministic lawyer-request both
    # returned above, so nothing here is overruling a rule — only an opinion.
    #
    # For `lawyer_request` specifically: a question the deterministic rule did
    # not recognise as touting, which retrieves Sri Lankan legislation above the
    # relevance floor, is answered from that legislation. The answer is about
    # the law and never about a practitioner — this service holds no attorney
    # data at all, and `LAWYER_REQUEST_REFUSAL` is a fixed string precisely so
    # that nothing here can compose its way into a recommendation.
    if intent in ("clarification_needed", "conversational", "lawyer_request"):
        logger.info(
            "Router said %s, but retrieval found %d relevant chunks — "
            "answering from the corpus instead", intent, len(gate_hits),
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
        # Read at call time, never hardcoded — see app/core/corpus.py.
        "legislation": corpus_bullets(),
    })

    response = llm.invoke(prompt)
    answer = message_text(response)

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
