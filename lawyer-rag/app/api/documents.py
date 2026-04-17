"""
LawyerAI RAG System - Document Management API Endpoints

Provides endpoints for managing documents in the vector store:
- List all documents
- Delete a document
- Reindex all documents
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

logger = logging.getLogger(__name__)

documents_bp = Blueprint("documents", __name__)


@documents_bp.route("/api/documents", methods=["GET"])
def list_documents():
    """
    List all ingested documents with their metadata and chunk counts.

    Response:
    {
        "documents": [
            {
                "document_name": "Civil Procedure Code",
                "document_type": "Consolidated Act",
                "status": "Active",
                "last_updated_year": 2024,
                "chunk_count": 245,
                "active_chunks": 230,
                "repealed_chunks": 15
            }
        ],
        "collection_stats": { ... }
    }
    """
    try:
        documents = get_all_document_names()
        stats = get_collection_stats()

        return jsonify({
            "documents": documents,
            "collection_stats": stats,
        }), 200

    except Exception as e:
        logger.error(f"Error listing documents: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/api/documents/<path:doc_name>", methods=["DELETE"])
def delete_document(doc_name: str):
    """
    Delete all chunks belonging to a specific document.

    URL Parameter:
        doc_name: The document_name to delete (URL-encoded if needed)
    """
    try:
        deleted_count = delete_document_by_name(doc_name)

        if deleted_count == 0:
            return jsonify({
                "error": f"No document found with name: '{doc_name}'"
            }), 404

        return jsonify({
            "success": True,
            "message": f"Deleted document '{doc_name}'",
            "chunks_deleted": deleted_count,
        }), 200

    except Exception as e:
        logger.error(f"Error deleting document: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/api/health", methods=["GET"])
def health_check():
    """
    Health check endpoint.
    Verifies connectivity to Ollama and ChromaDB.
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
                "llm_model": config.LLM_MODEL,
                "embedding_model": config.EMBEDDING_MODEL,
                "llm_available": any(config.LLM_MODEL in m for m in models),
                "embedding_available": any(config.EMBEDDING_MODEL in m for m in models),
            }
        else:
            status["services"]["ollama"] = {"status": "error", "code": resp.status_code}
            status["status"] = "degraded"
    except Exception as e:
        status["services"]["ollama"] = {"status": "unreachable", "error": str(e)}
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

    http_code = 200 if status["status"] == "healthy" else 503
    return jsonify(status), http_code
