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
    Drop the caches that are snapshots of the collection, after it changes.

    Deliberately here, at the mutation, rather than at the four call sites that
    ingest or delete. Each of these is taken at first use, so a newly ingested
    Act would otherwise land in a half-working state that costs a day to
    diagnose and that nobody would think to look for:

      BM25 index   the Act is findable by meaning and invisible to keyword
                   search until someone restarts the service.
      corpus list  the Act is retrievable, and every system prompt still tells
                   the model it does not exist. That one is not theoretical —
                   on 2026-09-20 it made the service deny holding the Penal
                   Code while quoting from it. See app/core/corpus.py.

    Imported locally because both of those modules import this one.
    """
    try:
        from app.core.bm25 import reset_bm25_index

        reset_bm25_index()
    except Exception as e:  # never let index bookkeeping fail an ingest
        logger.warning("Could not invalidate the keyword index (%s)", e)

    try:
        from app.core.corpus import invalidate_corpus_cache

        invalidate_corpus_cache()
    except Exception as e:
        logger.warning("Could not invalidate the corpus list (%s)", e)


# Publication furniture that appears on the first page of a consolidated PDF and
# nowhere else. Matching any of these, in a chunk that carries no section number,
# is what identifies front matter.
_FRONT_MATTER_MARKERS = (
    "printed on the order of government",
    "to be purchased at the government publications bureau",
    "published by www.lankalaw.net",
    "parliament of the democratic socialist republic",
    "acts of parliament",
    # The amending-instrument list that follows every cover-page title. All
    # three forms are needed: Sri Lanka has Ordinances (pre-1947), Acts, and
    # Laws (the 1972-78 National State Assembly). Writing only two of the three
    # left the Motor Traffic Act's cover page — "Law Nos, 22 of 1973" — as the
    # single unflagged front-matter chunk in the corpus.
    "ordinance nos",
    "act nos",
    "law nos",
    # The long title, which is the other half of every cover page.
    "an act to",
    "an ordinance to",
    "a law to",
    "price :",
    "postage",
)


def is_front_matter(doc) -> bool:
    """
    Is this chunk a title page rather than law?

    WHY THIS EXISTS. Every consolidated PDF begins with a cover page — the Act's
    name, its long title, the list of amending Act numbers, the Government
    Publications Bureau address and the price. The chunker gives these no section
    number, so they are stored as `Chunk_1`. There are exactly 14 in this corpus,
    one per document, and one of them is the 14 characters "Ordinance Nos,".

    They are actively harmful, because a chunk that is mostly the Act's NAME is a
    strong embedding match for any question that names that Act:

        "what is the punishment for theft under the Penal Code?"
              -> Penal Code Chunk_1 at 0.731, the top hit, the title page
        "what is mischief under the Sri Lankan Penal Code?"
              -> Penal Code Chunk_1 at 0.743, the top hit

    That does three bad things at once. It occupies a slot in a six-chunk context
    window with text containing no law; it can clear the relevance gate on its
    own, so a question the corpus cannot answer stops abstaining; and it cannot be
    cited, because there is no section to cite — which means it can never support
    an answer even in principle. See RAG-REVIEW §4.26.

    DELIBERATELY TWO CONDITIONS. Being unciteable is not enough on its own. A
    future ingest of a differently formatted PDF could produce real legal text
    that the chunker fails to number, and silently dropping that would be a much
    worse failure than the one this fixes. So a chunk is only discarded when it is
    unciteable AND it looks like publication furniture — very short, or carrying
    a marker that only ever appears on a cover page.
    """
    meta = doc.metadata or {}
    section = str(meta.get("section_number") or "")
    citeable = section and not section.startswith("Chunk_")
    if citeable:
        return False

    text = " ".join((doc.page_content or "").split())
    if len(text) < 200:
        return True
    lowered = text.lower()
    return any(marker in lowered for marker in _FRONT_MATTER_MARKERS)


def drop_front_matter(results: list, *, query: str = "") -> list:
    """Remove title-page chunks from a scored result list, before the floor."""
    kept = [(doc, score) for doc, score in results if not is_front_matter(doc)]
    dropped = len(results) - len(kept)
    if dropped:
        logger.info(
            "[front-matter] dropped %d title-page chunk(s) carrying no law for %r",
            dropped, query[:60],
        )
    return kept


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

    scores = sorted((score for _, score in results), reverse=True)
    best = scores[0]
    if best < config.RETRIEVAL_MIN_SCORE:
        logger.info(
            "[floor] no result cleared %.2f (best %.3f) for %r — returning nothing",
            config.RETRIEVAL_MIN_SCORE, best, query[:60],
        )
        return []

    # Second gate: does the best hit STAND OUT, or is everything equally mediocre?
    #
    # An absolute threshold answers "is this similar enough?". It cannot answer
    # "is this about the question?", and the difference shows up exactly where it
    # matters. For a question the corpus answers, one chunk is clearly the best.
    # For a question it does not, the top twenty are all vaguely related and all
    # about the same distance away — the shape of "nothing here is it".
    #
    # WHY THIS WAS ADDED. The absolute floor has now been invalidated twice by
    # changes that had nothing to do with it: once by loading nine Acts
    # (RAG-REVIEW §4.24) and once by re-chunking, which made chunks longer and
    # lifted every score. A threshold tuned against one score distribution is not
    # a property of relevance, it is a property of that distribution.
    #
    # Margin is scale-free against a uniform shift, which is what both of those
    # were. That is the reason for preferring it — but it has been measured
    # against ONE corpus at ONE chunk size, so treat the robustness as the
    # intention rather than as an established fact.
    if config.RETRIEVAL_MIN_MARGIN > 0 and len(scores) > 1:
        neighbours = scores[1:11]
        margin = best - (sum(neighbours) / len(neighbours))
        if margin < config.RETRIEVAL_MIN_MARGIN:
            logger.info(
                "[floor] best %.3f does not stand out (margin %.3f < %.3f) for %r "
                "— returning nothing",
                best, margin, config.RETRIEVAL_MIN_MARGIN, query[:60],
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
        # Title pages are removed BEFORE the floor, and before `apply_floor` is
        # consulted, so that every caller sees the same result set the service
        # reasons over — including scripts/sweep_retrieval.py, which recomputes
        # the gate itself. A measurement that sees different chunks from the
        # pipeline is not a measurement of the pipeline.
        results = drop_front_matter(results, query=query)
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


def _chunk_key(doc) -> tuple:
    """
    Identity of a chunk, for merging the dense and keyword result sets.

    Keyed on the TEXT, not on the metadata. The obvious key —
    (source_file, section_number, chunk_index) — is not unique in this corpus:
    measured on 2026-09-20, 670 of 3,860 chunks share such a tuple with at
    least one other chunk, and eight different chunks of the Notaries Ordinance
    all answer to ("Notaries-Consolidated-2024.pdf", "Section 6", 0). The
    consolidated PDFs restate low section numbers inside schedules and forms,
    and `chunk_index` restarts per section, so collisions are routine rather
    than exceptional.

    While this key was only used to drop duplicates that cost recall quietly.
    The moment it became a dict key it started corrupting scores: the dense
    pool is walked in rank order, so a colliding LATER row overwrote an
    earlier, higher-scoring one. mt-002 lost Motor Traffic s.99 at 0.683 and
    reported 0.586 for a different chunk wearing the same key, which dropped
    the question below the relevance gate.

    Two chunks with identical text are genuinely interchangeable here, which is
    what this key now means.
    """
    import hashlib

    meta = doc.metadata or {}
    digest = hashlib.sha1((doc.page_content or "").encode("utf-8")).hexdigest()
    return (str(meta.get("document_name") or ""), digest)


def hybrid_search(
    query: str,
    top_k: int = None,
    filter_metadata: Optional[dict] = None,
    apply_floor: bool = True,
) -> list:
    """
    Dense retrieval fused with BM25 keyword retrieval by Reciprocal Rank Fusion.

    ── What changed on 2026-09-20, and why the first attempt did nothing ─────
    The first version said "BM25 proposes, dense disposes": keyword search
    suggested candidates, and every candidate was then SCORED and RANKED by
    dense similarity. Ranking by dense score is what made it useless — a
    keyword hit could only survive if dense already liked it, and if dense
    already liked it the chunk was in dense's own top `HYBRID_FETCH_K` anyway.
    Measured over the golden set, the numbers were identical with it on and
    off, at every threshold. **The lexical half was given no vote.**

    Now the two halves vote. Membership and ORDER of the returned chunks come
    from Reciprocal Rank Fusion over the dense ranking and the BM25 ranking,
    so a chunk BM25 puts first can rise even where dense puts it 25th.

    ── The one thing deliberately NOT fused: the relevance gate ──────────────
    `RETRIEVAL_MIN_SCORE` is still decided on the best DENSE score across the
    whole candidate pool, exactly as before this function existed. That is the
    gate which took `not_in_corpus` from 12.5% to 100%, and it is the reason
    the threshold did not need re-tuning: it remains a property of the
    embedding model and the corpus, not of how a candidate was found.

    Fusing the gate as well is the tempting next step and it is measured, not
    assumed — see `ENABLE_LEXICAL_GATE` in config.py for what it costs.

    ── An invariant worth keeping ───────────────────────────────────────────
    The single strongest semantic match is ALWAYS returned, even if fusion
    ranks it below `top_k`. Without that, RRF could promote keyword matches
    past the one chunk the gate was computed on, and a caller recomputing the
    best score from the returned list (scripts/sweep_retrieval.py does exactly
    that) would measure something different from what the gate decided.

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

    # key -> [Document, dense_score, dense_rank | None, lexical_rank | None]
    candidates: dict = {}
    for rank, (doc, score) in enumerate(dense, 1):
        candidates[_chunk_key(doc)] = [doc, score, rank, None]

    try:
        from app.core.bm25 import get_bm25_index

        index = get_bm25_index()
        if index is not None:
            document_filter = filter_metadata.get("document_name") if filter_metadata else None
            candidate_ids = index.search(
                query, n=config.HYBRID_FETCH_K, document_filter=document_filter
            )
            for chunk_id, doc, score in _score_candidates(query, candidate_ids):
                if is_front_matter(doc):
                    continue  # BM25 loves a cover page: it is almost all Act name
                lexical_rank = candidate_ids.index(chunk_id) + 1
                key = _chunk_key(doc)
                if key in candidates:
                    candidates[key][3] = lexical_rank
                else:
                    candidates[key] = [doc, score, None, lexical_rank]
    except Exception as e:
        # Never let the lexical half break the semantic half.
        logger.warning("Hybrid search fell back to dense-only (%s)", e)
        trimmed = dense[:top_k]
        return apply_relevance_floor(trimmed, query=query) if apply_floor else trimmed

    rows = list(candidates.values())
    if not rows:
        return []

    k = config.HYBRID_RRF_K

    def rrf(row) -> float:
        _, _, dense_rank, lexical_rank = row
        score = 0.0
        if dense_rank is not None:
            score += 1.0 / (k + dense_rank)
        if lexical_rank is not None:
            score += 1.0 / (k + lexical_rank)
        return score

    best_dense_row = max(rows, key=lambda r: r[1])
    lexical_only = sum(1 for r in rows if r[2] is None)
    if lexical_only:
        logger.info(
            "[hybrid] keyword search added %d candidate(s) dense retrieval missed", lexical_only
        )

    rows.sort(key=lambda r: (rrf(r), r[1]), reverse=True)
    ordered = rows[:top_k]
    if best_dense_row not in ordered:  # the invariant above
        ordered = [best_dense_row] + ordered[: top_k - 1]

    merged = [(row[0], row[1]) for row in ordered]
    if not apply_floor:
        return merged

    lexical_pass = None
    if config.ENABLE_LEXICAL_GATE:
        lexical_pass = next(
            (
                r
                for r in rows
                if r[3] is not None
                and r[3] <= config.HYBRID_LEXICAL_RANK
                and r[1] >= config.RETRIEVAL_LEXICAL_MIN_SCORE
            ),
            None,
        )
        if lexical_pass is not None and best_dense_row[1] < config.RETRIEVAL_MIN_SCORE:
            logger.info(
                "[hybrid] lexical gate: BM25 rank %d at dense %.3f cleared a gate of %.2f for %r",
                lexical_pass[3], lexical_pass[1], config.RETRIEVAL_MIN_SCORE, query[:60],
            )
            kept = [(d, sc) for d, sc in merged if sc >= config.RETRIEVAL_CHUNK_FLOOR]
            return kept or merged[:1]

    return apply_relevance_floor(merged, query=query)


def _score_candidates(query: str, candidate_ids: list) -> list:
    """
    Score BM25 candidates with the same dense metric.

    Returns (chunk_id, Document, dense_score) so the caller can recover each
    candidate's BM25 RANK — Chroma returns rows in distance order, not in the
    order the ids were given, so the rank has to be carried by id rather than
    by position. Getting that wrong would silently feed RRF the wrong ranking.

    Uses the raw Chroma collection because langchain's wrapper cannot restrict
    a scored query to a set of ids. The status filter is applied again here
    even though the index holds only Active chunks — belt and braces on the one
    property that must never slip.
    """
    import math

    from langchain_core.documents import Document

    from app.core.embeddings import get_embeddings

    if not candidate_ids:
        return []

    collection = get_vectorstore()._collection
    result = collection.query(
        query_embeddings=[get_embeddings().embed_query(query)],
        ids=list(candidate_ids),
        n_results=len(candidate_ids),
        where={"status": "Active"},
        include=["documents", "metadatas", "distances"],
    )

    scored = []
    for chunk_id, text, meta, distance in zip(
        result["ids"][0], result["documents"][0], result["metadatas"][0], result["distances"][0]
    ):
        meta = meta or {}
        scored.append(
            (
                chunk_id,
                Document(page_content=text or "", metadata=meta),
                1.0 - distance / math.sqrt(2),
            )
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
