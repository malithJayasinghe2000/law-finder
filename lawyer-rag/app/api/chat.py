"""
LawyerAI RAG System - Chat API Endpoint

Handles user queries through the RAG pipeline.
POST /api/chat → Retrieves relevant legal context → Generates response
"""

import logging
import traceback
from flask import Blueprint, request, jsonify

from app.core.rag_chain import query_rag

logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    """
    Chat endpoint for RAG-powered legal Q&A.

    Request Body:
    {
        "message": "What is Section 14 of the Civil Procedure Code?",
        "conversation_history": [
            {"role": "user", "content": "..."},
            {"role": "assistant", "content": "..."}
        ]
    }

    Response:
    {
        "answer": "According to Section 14...",
        "sources": [...],
        "chunks_retrieved": 6
    }
    """
    try:
        data = request.get_json()

        if not data or "message" not in data:
            return jsonify({"error": "Missing 'message' field in request body"}), 400

        message = data["message"].strip()
        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        conversation_history = data.get("conversation_history", [])

        logger.info(f"Chat request: '{message[:80]}...'")

        language = data.get("language", "en")

        # Execute RAG pipeline
        result = query_rag(
            question=message,
            chat_history=conversation_history,
            language=language
        )

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Chat error: {e}\n{traceback.format_exc()}")
        return jsonify({
            "error": "An error occurred while processing your request",
            "details": str(e),
        }), 500
