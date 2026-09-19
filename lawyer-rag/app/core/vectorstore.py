"""
LawyerAI RAG System - Vector Store Manager

Manages ChromaDB persistent vector store with metadata filtering.
Key feature: supports status-based filtering to distinguish Active vs Repealed sections.
"""

import logging
from typing import Optional
from langchain_chroma import Chroma
from langsmith import traceable
from app.config import config
from app.core.embeddings import get_embeddings

logger = logging.getLogger(__name__)

_vectorstore_instance = None


class RetrievalUnavailable(RuntimeError):
    """
    The corpus could not be searched — as distinct from holding no answer.

    These two are not the same thing and must never share a return value. An
    empty result set is a statement about Sri Lankan legislation ("we do not
    hold that"); a failed search is a statement about this service ("ask again
    later"). Collapsing the second into the first makes the assistant tell a
    user that law it holds does not exist, in a fixed, confident string, over
    HTTP 200 — which is what it did until this class existed. See the comment at
    the raise site in search_documents.
    """


def get_vectorstore() -> Chroma:
    """
    Get or create a singleton ChromaDB vector store instance.
    Uses persistent storage so data survives restarts.
    """
    global _vectorstore_instance
    if _vectorstore_instance is None:
        _vectorstore_instance = Chroma(
            collection_name=config.CHROMA_COLLECTION_NAME,
            embedding_function=get_embeddings(),
            persist_directory=config.CHROMA_PERSIST_DIR,
        )
        logger.info(
            f"ChromaDB initialized: collection='{config.CHROMA_COLLECTION_NAME}', "
            f"persist_dir='{config.CHROMA_PERSIST_DIR}'"
        )
    return _vectorstore_instance


def add_documents(documents: list, batch_size: int = 50) -> int:
    """
    Add documents to the vector store in batches.

    Args:
        documents: List of LangChain Document objects
        batch_size: Number of documents to add per batch (to avoid memory issues)

    Returns:
        Number of documents added
    """
    vs = get_vectorstore()
    total_added = 0

    for i in range(0, len(documents), batch_size):
        batch = documents[i: i + batch_size]
        vs.add_documents(batch)
        total_added += len(batch)
        logger.info(f"Added batch {i // batch_size + 1}: {len(batch)} chunks (total: {total_added})")

    _invalidate_keyword_index()
    return total_added


def _invalidate_keyword_index() -> None:
    """
    Drop the BM25 index after the collection changes.

    Deliberately here, at the mutation, rather than at the four call sites that
    ingest or delete. The keyword index is a snapshot taken at first use, so a
    newly ingested Act would otherwise be findable by meaning and invisible to
    keyword search until someone restarted the service — a half-working state
    that costs a day to diagnose and that nobody would think to look for.

    Imported locally because bm25 imports this module.
    """
    try:
        from app.core.bm25 import reset_bm25_index

        reset_bm25_index()
    except Exception as e:  # never let index bookkeeping fail an ingest
        logger.warning("Could not invalidate the keyword index (%s)", e)


def apply_relevance_floor(results: list, *, query: str = "") -> list:
    """
    Drop a result set that nothing in the corpus actually answers.

    Two gates, because they answer different questions (see config.py):

      RETRIEVAL_MIN_SCORE    applied to the BEST result. If the strongest match
                             is below it, the whole search is a miss and NOTHING
                             is returned — so the pipeline can say it does not
                             hold the material rather than reasoning over six
                             unrelated sections.
      RETRIEVAL_CHUNK_FLOOR  applied per chunk once the gate is cleared. A
                             strong hit may legitimately carry weaker supporting
                             sections along with it.

    Why returning nothing is the point. `search_documents` used to return the
    top k regardless of score, so the corpus always had "an answer". Asked about
    land law, which is not in the corpus, it returned six Companies Act chunks
    under a heading reading "LEGAL CONTEXT FROM SRI LANKAN LEGISLATION" with a
    relevance figure of 8%, and the model dutifully answered. Having sources is
    not the same as being sourced.
    """
    if not results:
        return results

    best = max(score for _, score in results)
    if best < config.RETRIEVAL_MIN_SCORE:
        logger.info(
            "[floor] no result cleared %.2f (best %.3f) for %r — returning nothing",
            config.RETRIEVAL_MIN_SCORE, best, query[:60],
        )
        return []

    kept = [(doc, score) for doc, score in results if score >= config.RETRIEVAL_CHUNK_FLOOR]
    if len(kept) < len(results):
        logger.info(
            "[floor] dropped %d/%d chunks below %.2f",
            len(results) - len(kept), len(results), config.RETRIEVAL_CHUNK_FLOOR,
        )
    return kept


@traceable(name="Vector Store Search")
def search_documents(
    query: str,
    top_k: int = None,
    filter_metadata: Optional[dict] = None,
    apply_floor: bool = True,
) -> list:
    """
    Search the vector store with optional metadata filtering.

    Args:
        query: Search query text
        top_k: Number of results to return
        filter_metadata: ChromaDB metadata filter dict
        apply_floor: Drop results that nothing really answers (default True).
                     Pass False ONLY for an exact-metadata lookup, where the
                     caller has already decided WHICH section it wants and the
                     similarity score is not the thing being judged — see
                     section_lookup_tool.

    Returns:
        List of (Document, score) tuples. **May be empty**, and an empty list is
        a real answer meaning "the corpus does not hold this", not an error.
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    vs = get_vectorstore()

    # Always filter for Active documents unless explicitly overridden.
    #
    # Copy rather than mutate. This used to write status into the dict the
    # CALLER passed, so a caller reusing one filter across several searches
    # accumulated keys it never set.
    if filter_metadata is None:
        filter_metadata = {"status": "Active"}
    else:
        filter_metadata = dict(filter_metadata)
        filter_metadata.setdefault("status", "Active")

    # Fix for ChromaDB multiple conditions
    if filter_metadata and len(filter_metadata) > 1:
        if "$and" not in filter_metadata and "$or" not in filter_metadata:
            filter_metadata = {"$and": [{k: v} for k, v in filter_metadata.items()]}

    try:
        results = vs.similarity_search_with_relevance_scores(
            query=query,
            k=top_k,
            filter=filter_metadata,
        )
        return apply_relevance_floor(results, query=query) if apply_floor else results
    except Exception as e:
        # The status filter is NEVER dropped.
        #
        # This fallback used to re-run the search with no filter at all. The
        # default filter is {"status": "Active"}, so any filter error — a
        # malformed document_name, an empty collection, a Chroma version
        # difference in how $and is parsed — made REPEALED sections eligible to
        # be retrieved and cited.
        #
        # For a legal assistant that is the worst failure available. Not a wrong
        # answer that looks wrong: a confident statement of law that was
        # repealed, correctly cited to a section that really exists, which
        # neither the model nor the downstream citation check can catch. The
        # application's UNSUPPORTED_CITATION check in src/lib/ai/policy.ts
        # verifies that a citation matches what retrieval returned — and
        # repealed text that retrieval returned matches perfectly.
        #
        # So the retry drops the caller's document filter (the usual cause) and
        # keeps status. If that fails too, return nothing: no context is a
        # correct answer here, because the pipeline reports "I do not hold that"
        # rather than inventing one.
        logger.warning(
            f"Filtered search failed ({e}); retrying with the status filter only"
        )
        try:
            results = vs.similarity_search_with_relevance_scores(
                query=query,
                k=top_k,
                filter={"status": "Active"},
            )
            return apply_relevance_floor(results, query=query) if apply_floor else results
        except Exception as e2:
            # NOT an empty result. This used to `return []`, and an empty list
            # means "the corpus does not hold this" — a statement of fact about
            # the corpus that we have no basis for when the search could not run
            # at all.
            #
            # Reproduced live, 2026-09-14, during Stage 1.6 — and reproduced by
            # the most ordinary cause there is: somebody quit Ollama because the
            # laptop was getting hot. Embeddings come from Ollama too, so
            # retrieval goes down with it. Mid-evaluation the service answered
            # "How may a director be removed from office?" — which IS in the
            # corpus, it is eval case co-005 — with:
            #
            #   "I do not hold legislation covering that ... The legislation I
            #    hold is: Civil Procedure Code, Companies Act, ..."
            #
            # listing the Companies Act as held in the same breath as denying it,
            # then suggesting the user re-ask the exact question it had just
            # declined. HTTP 200, and `no_context: true` — so the structured
            # signal the evaluator trusts was false too. /api/health knew the
            # truth (`degraded`, `ollama: unreachable`); nothing on the request
            # path asked it.
            #
            # This is the same mistake the follow-up branch in rag_chain.py
            # already guards against a few lines below, in its own words: say the
            # true thing rather than claiming not to hold the legislation, "which
            # may be false and is what a user reported as confusing".
            #
            # Worth keeping in mind for deployment: the trigger was not a crash
            # or an attack, it was a person closing an application. A model host
            # that is restarted, updated, thermally throttled or OOM-killed is
            # routine, so this path will be taken in production, and every time
            # it is taken the user is told something false about Sri Lankan law.
            #
            # The status filter is still NEVER dropped — see the comment above.
            # We are not loosening the repealed-law protection, only refusing to
            # report an outage as a fact about Sri Lankan legislation.
            logger.error(
                f"Status-filtered search also failed ({e2}); retrieval is "
                "UNAVAILABLE. Reporting this as an error rather than as an empty "
                "corpus, which would tell the user we do not hold legislation we "
                "do hold."
            )
            raise RetrievalUnavailable(
                "the vector store could not be searched"
            ) from e2


def _chunk_key(meta: dict) -> tuple:
    """Identity of a chunk, for de-duplicating dense and keyword hits."""
    return (
        str(meta.get("source_file") or ""),
        str(meta.get("section_number") or ""),
        meta.get("chunk_index"),
    )


def hybrid_search(
    query: str,
    top_k: int = None,
    filter_metadata: Optional[dict] = None,
    apply_floor: bool = True,
) -> list:
    """
    Dense retrieval widened by BM25 keyword candidates.

    ── The design, and the one line that matters ─────────────────────────────
    **BM25 decides what is findable. Dense similarity still decides what is
    relevant.**

    Keyword search is good at the thing embeddings are worst at — matching the
    user's actual words — and bad at the thing the relevance floor depends on.
    A question about land law will always match *some* chunk on a common word,
    and admitting those on BM25's own score would undo the floor that took
    `not_in_corpus` from 12.5% to 100%.

    So BM25 only proposes candidates. Every candidate is then scored by the SAME
    dense metric, through the same collection, and passed through the SAME
    `apply_relevance_floor`. `RETRIEVAL_MIN_SCORE` therefore means exactly what
    it meant before this function existed, and did not need re-tuning: it is a
    property of the embedding model and the corpus, not of how candidates were
    found.

    Chroma's relevance for this collection is `1 - distance / sqrt(2)` (l2
    space). That is not an assumption — it was verified against
    `similarity_search_with_relevance_scores` on the same chunks and matched to
    six decimal places.

    ── Why this exists ──────────────────────────────────────────────────────
    Three user reports in one evening, all the same failure: "company
    registration", "legal actions", "resign from the company" each found nothing
    while the corpus held the answer under different wording. `synonyms.py`
    patches the pairs somebody wrote down; this fixes the class.

    Degrades to dense-only if the keyword index is unavailable, which is the
    behaviour that shipped before.
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    dense = search_documents(
        query=query,
        top_k=config.HYBRID_FETCH_K,
        filter_metadata=filter_metadata,
        apply_floor=False,
    )

    if not config.ENABLE_HYBRID_SEARCH:
        trimmed = dense[:top_k]
        return apply_relevance_floor(trimmed, query=query) if apply_floor else trimmed

    merged = list(dense)
    try:
        from app.core.bm25 import get_bm25_index

        index = get_bm25_index()
        if index is not None:
            document_filter = filter_metadata.get("document_name") if filter_metadata else None
            candidate_ids = index.search(
                query, n=config.HYBRID_FETCH_K, document_filter=document_filter
            )
            if candidate_ids:
                seen = {_chunk_key(doc.metadata) for doc, _ in dense}
                merged.extend(_score_candidates(query, candidate_ids, seen))
    except Exception as e:
        # Never let the lexical half break the semantic half.
        logger.warning("Hybrid search fell back to dense-only (%s)", e)

    merged.sort(key=lambda pair: pair[1], reverse=True)
    merged = merged[:top_k]
    return apply_relevance_floor(merged, query=query) if apply_floor else merged


def _score_candidates(query: str, candidate_ids: list, seen: set) -> list:
    """
    Score BM25 candidates with the same dense metric, skipping ones already found.

    Uses the raw Chroma collection because langchain's wrapper cannot restrict a
    scored query to a set of ids. The status filter is applied again here even
    though the index holds only Active chunks — belt and braces on the one
    property that must never slip.
    """
    import math

    from langchain_core.documents import Document

    from app.core.embeddings import get_embeddings

    collection = get_vectorstore()._collection
    result = collection.query(
        query_embeddings=[get_embeddings().embed_query(query)],
        ids=list(candidate_ids),
        n_results=len(candidate_ids),
        where={"status": "Active"},
        include=["documents", "metadatas", "distances"],
    )

    scored = []
    for text, meta, distance in zip(
        result["documents"][0], result["metadatas"][0], result["distances"][0]
    ):
        meta = meta or {}
        key = _chunk_key(meta)
        if key in seen:
            continue
        seen.add(key)
        scored.append(
            (Document(page_content=text or "", metadata=meta), 1.0 - distance / math.sqrt(2))
        )

    if scored:
        logger.info(
            "[hybrid] keyword search added %d candidate(s) dense retrieval missed", len(scored)
        )
    return scored


def get_all_document_names() -> list[dict]:
    """
    Get a list of all unique document names and their metadata in the store.

    Returns:
        List of dicts with document info
    """
    vs = get_vectorstore()
    collection = vs._collection

    # Get all metadata from the collection
    all_data = collection.get(include=["metadatas"])

    if not all_data or not all_data["metadatas"]:
        return []

    # Aggregate by document_name
    docs_map = {}
    for meta in all_data["metadatas"]:
        name = meta.get("document_name", "Unknown")
        if name not in docs_map:
            docs_map[name] = {
                "document_name": name,
                "document_type": meta.get("document_type", "Unknown"),
                "status": meta.get("status", "Unknown"),
                "last_updated_year": meta.get("last_updated_year", "Unknown"),
                "source_file": meta.get("source_file", "Unknown"),
                "chunk_count": 0,
                "active_chunks": 0,
                "repealed_chunks": 0,
            }
        docs_map[name]["chunk_count"] += 1
        if meta.get("status") == "Active":
            docs_map[name]["active_chunks"] += 1
        elif meta.get("status") == "Repealed":
            docs_map[name]["repealed_chunks"] += 1

    return list(docs_map.values())


def delete_document_by_name(document_name: str) -> int:
    """
    Delete all chunks belonging to a specific document.

    Args:
        document_name: The document_name metadata value to match

    Returns:
        Number of chunks deleted
    """
    vs = get_vectorstore()
    collection = vs._collection

    # Find all IDs matching this document_name
    results = collection.get(
        where={"document_name": document_name},
        include=[],
    )

    if not results or not results["ids"]:
        return 0

    ids_to_delete = results["ids"]
    collection.delete(ids=ids_to_delete)
    logger.info(f"Deleted {len(ids_to_delete)} chunks for document: '{document_name}'")
    _invalidate_keyword_index()
    return len(ids_to_delete)


def update_chunk_status(
    document_name: str,
    section_number: str,
    new_status: str = "Repealed",
) -> int:
    """
    Update the status of specific chunks (e.g., marking sections as Repealed).

    Args:
        document_name: The document name to filter
        section_number: The section number to update
        new_status: New status value (e.g., "Repealed", "Active")

    Returns:
        Number of chunks updated
    """
    vs = get_vectorstore()
    collection = vs._collection

    # Find matching chunks
    results = collection.get(
        where={
            "$and": [
                {"document_name": document_name},
                {"section_number": section_number},
            ]
        },
        include=["metadatas"],
    )

    if not results or not results["ids"]:
        return 0

    # Update each chunk's status
    for i, chunk_id in enumerate(results["ids"]):
        updated_meta = results["metadatas"][i].copy()
        updated_meta["status"] = new_status
        collection.update(
            ids=[chunk_id],
            metadatas=[updated_meta],
        )

    logger.info(
        f"Updated {len(results['ids'])} chunks: "
        f"'{document_name}' / '{section_number}' → status='{new_status}'"
    )
    # CRITICAL, not housekeeping. This is the call that marks a section
    # Repealed, and the keyword index holds only Active chunks as a snapshot.
    # Without this, a section repealed a moment ago stays keyword-findable and
    # can be cited as current law — the one failure this service must never
    # produce, and the exact reason the dense path never drops the status
    # filter.
    _invalidate_keyword_index()
    return len(results["ids"])


def get_collection_stats() -> dict:
    """Get statistics about the vector store collection."""
    vs = get_vectorstore()
    collection = vs._collection
    count = collection.count()

    return {
        "collection_name": config.CHROMA_COLLECTION_NAME,
        "total_chunks": count,
        "persist_directory": config.CHROMA_PERSIST_DIR,
    }
