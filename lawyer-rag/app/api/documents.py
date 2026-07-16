"""
LawyerAI RAG System - Document Management API Endpoints

Provides endpoints for managing documents in the vector store:
- List all documents with categories and graph stats
- Get single document details with related documents
- List categories with counts
- Get graph visualization data
- Delete a document
- Health check
"""

import logging
import traceback
import requests
from flask import Blueprint, request, jsonify

from app.config import config
from app.core.vectorstore import (
    get_all_document_names,
    delete_document_by_name,
    get_collection_stats,
)
from app.core.graph_store import get_knowledge_graph

logger = logging.getLogger(__name__)

documents_bp = Blueprint("documents", __name__)


@documents_bp.route("/api/documents", methods=["GET"])
def list_documents():
    """
    List all ingested documents with their metadata, chunk counts, and graph stats.

    Query parameters:
    - category: Filter by category
    - search: Search by document name

    Response:
    {
        "documents": [...],
        "collection_stats": { ... },
        "graph_stats": { ... }
    }
    """
    try:
        documents = get_all_document_names()
        stats = get_collection_stats()

        # Get graph stats
        graph_stats = {}
        if config.ENABLE_GRAPH_RAG:
            try:
                kg = get_knowledge_graph()
                graph_stats = kg.get_stats()

                # Add entity count per document
                for doc in documents:
                    doc_name = doc.get("document_name", "")
                    doc_entities = kg.get_document_entities(doc_name)
                    doc["graph_entity_count"] = len(doc_entities)

                    # Get related documents
                    related = kg.get_related_documents(doc_name)
                    doc["related_documents"] = related[:5]
            except Exception as e:
                logger.warning(f"Failed to get graph stats: {e}")

        # Apply filters
        category_filter = request.args.get("category", "").strip()
        search_filter = request.args.get("search", "").strip().lower()

        if category_filter:
            documents = [
                d for d in documents
                if d.get("category", "").lower() == category_filter.lower()
            ]

        if search_filter:
            documents = [
                d for d in documents
                if search_filter in d.get("document_name", "").lower()
            ]

        return jsonify({
            "documents": documents,
            "collection_stats": stats,
            "graph_stats": graph_stats,
        }), 200

    except Exception as e:
        logger.error(f"Error listing documents: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/api/documents/categories", methods=["GET"])
def list_categories():
    """
    List all document categories with their document counts.
    """
    try:
        documents = get_all_document_names()

        # Count documents by category
        category_counts = {}
        for doc in documents:
            cat = doc.get("category", doc.get("document_type", "Uncategorized"))
            category_counts[cat] = category_counts.get(cat, 0) + 1

        categories = [
            {"name": cat, "count": count}
            for cat, count in sorted(category_counts.items())
        ]

        # Add configured categories with 0 count if not present
        existing_names = {c["name"] for c in categories}
        for cat_name in config.DOCUMENT_CATEGORIES:
            if cat_name not in existing_names:
                categories.append({"name": cat_name, "count": 0})

        return jsonify({"categories": categories}), 200

    except Exception as e:
        logger.error(f"Error listing categories: {e}")
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/api/documents/<path:doc_name>", methods=["GET"])
def get_document(doc_name: str):
    """
    Get details for a specific document including related documents from graph.
    """
    try:
        documents = get_all_document_names()
        doc = next((d for d in documents if d["document_name"] == doc_name), None)

        if not doc:
            return jsonify({"error": f"Document not found: '{doc_name}'"}), 404

        # Get graph data
        related_docs = []
        graph_entities = []
        if config.ENABLE_GRAPH_RAG:
            try:
                kg = get_knowledge_graph()
                related_docs = kg.get_related_documents(doc_name)
                doc_entities = kg.get_document_entities(doc_name)
                graph_entities = [
                    {"id": e["id"], "name": e.get("name", ""), "type": e.get("type", "")}
                    for e in doc_entities
                ]
            except Exception as e:
                logger.warning(f"Failed to get graph data: {e}")

        return jsonify({
            "document": doc,
            "related_documents": related_docs,
            "graph_entities": graph_entities,
        }), 200

    except Exception as e:
        logger.error(f"Error getting document: {e}")
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/api/documents/<path:doc_name>/graph", methods=["GET"])
def get_document_graph(doc_name: str):
    """
    Get graph visualization data for a specific document.
    Returns nodes and edges for frontend rendering.
    """
    try:
        if not config.ENABLE_GRAPH_RAG:
            return jsonify({"nodes": [], "edges": [], "message": "Graph RAG is disabled"}), 200

        kg = get_knowledge_graph()
        graph_data = kg.get_graph_data_for_document(doc_name)

        return jsonify(graph_data), 200

    except Exception as e:
        logger.error(f"Error getting document graph: {e}")
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/api/documents/<path:doc_name>", methods=["DELETE"])
def delete_document(doc_name: str):
    """
    Delete all chunks belonging to a specific document from both
    vector store and knowledge graph.
    """
    try:
        # Delete from vector store
        deleted_count = delete_document_by_name(doc_name)

        # Delete from knowledge graph
        graph_removed = 0
        if config.ENABLE_GRAPH_RAG:
            try:
                kg = get_knowledge_graph()
                graph_removed = kg.remove_document_entities(doc_name)
            except Exception as e:
                logger.warning(f"Failed to remove graph entities: {e}")

        if deleted_count == 0 and graph_removed == 0:
            return jsonify({
                "error": f"No document found with name: '{doc_name}'"
            }), 404

        return jsonify({
            "success": True,
            "message": f"Deleted document '{doc_name}'",
            "chunks_deleted": deleted_count,
            "graph_entities_removed": graph_removed,
        }), 200

    except Exception as e:
        logger.error(f"Error deleting document: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/api/health", methods=["GET"])
def health_check():
    """
    Health check endpoint.
    Verifies connectivity to Ollama, ChromaDB, and Knowledge Graph.
    """
    status = {
        "status": "healthy",
        "services": {},
    }

    # Check Ollama
    try:
        resp = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])]
            status["services"]["ollama"] = {
                "status": "connected",
                "url": config.OLLAMA_BASE_URL,
                "available_models": models,
                "llm_model": config.LLM_MODEL if config.LLM_PROVIDER == "ollama" else None,
                "embedding_model": config.EMBEDDING_MODEL,
                "llm_available": any(config.LLM_MODEL in m for m in models) if config.LLM_PROVIDER == "ollama" else None,
                "embedding_available": any(config.EMBEDDING_MODEL in m for m in models),
            }
        else:
            status["services"]["ollama"] = {"status": "error", "code": resp.status_code}
            status["status"] = "degraded"
    except Exception as e:
        status["services"]["ollama"] = {"status": "unreachable", "error": str(e)}
        status["status"] = "degraded"

    # Check Hugging Face Router if active
    if config.LLM_PROVIDER.lower() == "huggingface":
        try:
            if not config.HF_TOKEN:
                status["services"]["huggingface"] = {"status": "error", "error": "HF_TOKEN not configured"}
                status["status"] = "degraded"
            else:
                headers = {"Authorization": f"Bearer {config.HF_TOKEN}"}
                resp = requests.get(f"{config.HF_API_BASE}/models", headers=headers, timeout=5)
                if resp.status_code == 200:
                    available_models = [m.get("id") for m in resp.json().get("data", []) if isinstance(m, dict)]
                    status["services"]["huggingface"] = {
                        "status": "connected",
                        "url": config.HF_API_BASE,
                        "llm_model": config.LLM_MODEL,
                        "model_available": any(config.LLM_MODEL == m for m in available_models if m),
                    }
                else:
                    status["services"]["huggingface"] = {
                        "status": "partial",
                        "code": resp.status_code,
                        "url": config.HF_API_BASE,
                        "llm_model": config.LLM_MODEL,
                        "message": "Connected but models list returned non-200."
                    }
        except Exception as e:
            status["services"]["huggingface"] = {"status": "unreachable", "error": str(e)}
            status["status"] = "degraded"

    # Check OpenAI if active
    if config.LLM_PROVIDER.lower() == "openai":
        try:
            if not config.OPENAI_API_KEY:
                status["services"]["openai"] = {"status": "error", "error": "OPENAI_API_KEY not configured"}
                status["status"] = "degraded"
            else:
                headers = {"Authorization": f"Bearer {config.OPENAI_API_KEY}"}
                resp = requests.get(f"{config.OPENAI_API_BASE}/models", headers=headers, timeout=5)
                if resp.status_code == 200:
                    status["services"]["openai"] = {
                        "status": "connected",
                        "url": config.OPENAI_API_BASE,
                        "llm_model": config.LLM_MODEL,
                    }
                else:
                    status["services"]["openai"] = {"status": "error", "code": resp.status_code, "message": resp.text}
                    status["status"] = "degraded"
        except Exception as e:
            status["services"]["openai"] = {"status": "unreachable", "error": str(e)}
            status["status"] = "degraded"

    # Check OpenRouter if active
    if config.LLM_PROVIDER.lower() == "openrouter":
        try:
            api_key = config.OPENROUTER_API_KEY or config.OPENAI_API_KEY
            if not api_key:
                status["services"]["openrouter"] = {"status": "error", "error": "OPENROUTER_API_KEY / OPENAI_API_KEY not configured"}
                status["status"] = "degraded"
            else:
                headers = {"Authorization": f"Bearer {api_key}"}
                resp = requests.get(f"{config.OPENROUTER_API_BASE}/models", headers=headers, timeout=5)
                if resp.status_code == 200:
                    status["services"]["openrouter"] = {
                        "status": "connected",
                        "url": config.OPENROUTER_API_BASE,
                        "llm_model": config.LLM_MODEL,
                    }
                else:
                    status["services"]["openrouter"] = {"status": "error", "code": resp.status_code, "message": resp.text}
                    status["status"] = "degraded"
        except Exception as e:
            status["services"]["openrouter"] = {"status": "unreachable", "error": str(e)}
            status["status"] = "degraded"

    # Check ChromaDB
    try:
        stats = get_collection_stats()
        status["services"]["chromadb"] = {
            "status": "connected",
            **stats,
        }
    except Exception as e:
        status["services"]["chromadb"] = {"status": "error", "error": str(e)}
        status["status"] = "degraded"

    # Check Knowledge Graph
    if config.ENABLE_GRAPH_RAG:
        try:
            kg = get_knowledge_graph()
            graph_stats = kg.get_stats()
            status["services"]["knowledge_graph"] = {
                "status": "connected",
                **graph_stats,
            }
        except Exception as e:
            status["services"]["knowledge_graph"] = {"status": "error", "error": str(e)}

    http_code = 200 if status["status"] == "healthy" else 503
    return jsonify(status), http_code
