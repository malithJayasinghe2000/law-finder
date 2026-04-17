"""
Quick Test Script - Test the RAG pipeline with sample queries.

Usage:
    python -m scripts.test_query
"""

import sys
import json
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.utils.helpers import setup_logging
from app.core.rag_chain import query_rag
from app.core.vectorstore import get_collection_stats, get_all_document_names

setup_logging("INFO")


def test_queries():
    """Run test queries against the RAG system."""

    # Check collection stats first
    stats = get_collection_stats()
    print(f"\n{'='*60}")
    print(f"Vector Store Stats:")
    print(f"  Collection: {stats['collection_name']}")
    print(f"  Total chunks: {stats['total_chunks']}")
    print(f"{'='*60}")

    if stats["total_chunks"] == 0:
        print("\nNo documents in vector store! Run ingestion first:")
        print("  python -m scripts.ingest_all --clear")
        return

    # List documents
    docs = get_all_document_names()
    print(f"\nIngested Documents:")
    for doc in docs:
        print(f"  - {doc['document_name']} ({doc['document_type']}) "
              f"[{doc['active_chunks']} active, {doc['repealed_chunks']} repealed]")

    # Test queries
    test_questions = [
        "What are the key provisions of the Civil Procedure Code regarding filing cases?",
        "What does the Companies Act say about director responsibilities?",
        "What are the traffic violation penalties under the Motor Traffic Act?",
    ]

    for question in test_questions:
        print(f"\n{'='*60}")
        print(f"Q: {question}")
        print(f"{'='*60}")

        result = query_rag(question=question)

        print(f"\nA: {result['answer'][:500]}...")
        print(f"\nSources ({result['chunks_retrieved']} chunks):")
        for src in result["sources"][:3]:
            print(f"  - {src['document_name']} / {src['section']} "
                  f"(score: {src['relevance_score']})")


if __name__ == "__main__":
    test_queries()
