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

    return total_added


@traceable(name="Vector Store Search")
def search_documents(
    query: str,
    top_k: int = None,
    filter_metadata: Optional[dict] = None,
) -> list:
    """
    Search the vector store with optional metadata filtering.

    Args:
        query: Search query text
        top_k: Number of results to return
        filter_metadata: ChromaDB metadata filter dict

    Returns:
        List of (Document, score) tuples
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
        return vs.similarity_search_with_relevance_scores(
            query=query,
            k=top_k,
            filter=filter_metadata,
        )
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
            return vs.similarity_search_with_relevance_scores(
                query=query,
                k=top_k,
                filter={"status": "Active"},
            )
        except Exception as e2:
            logger.error(
                f"Status-filtered search also failed ({e2}); returning no results "
                "rather than searching unfiltered, which could surface repealed law"
            )
            return []


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
