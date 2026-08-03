"""
LawyerAI RAG System - Chat API Endpoint

Handles user queries through the RAG pipeline.
POST /api/chat → Retrieves relevant legal context → Generates response
"""

import logging
import time
import traceback
from flask import Blueprint, request, jsonify

from app.core.rag_chain import query_rag
from app.utils.chat_logger import chat_logger

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
        "sources": [...],          # retrieval metadata, not model-generated
        "intent": "legal_query",   # advisory; the caller decides what to require
        "chunks_retrieved": 6
    }

    Note: this endpoint is called only by the Next.js application, server side,
    which applies src/lib/ai/policy.ts to whatever comes back before any user
    sees it. It was previously called straight from the browser. Do not expose
    it publicly again.
    """
    try:
        data = request.get_json()

        if not data or "message" not in data:
            return jsonify({"error": "Missing 'message' field in request body"}), 400

        message = data["message"].strip()
        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        conversation_history = data.get("conversation_history", [])

        # The question itself is deliberately not logged. It is an account of
        # someone's legal problem; see app/utils/chat_logger.py.
        logger.info(f"Chat request received ({len(message)} chars)")

        started = time.monotonic()

        # Execute RAG pipeline
        result = query_rag(
            question=message,
            chat_history=conversation_history,
        )

        duration_ms = int((time.monotonic() - started) * 1000)

        # Metrics only — no message content.
        chat_logger.log_interaction(
            user_message=message,
            response=result,
            conversation_history=conversation_history,
            duration_ms=duration_ms,
        )

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Chat error: {e}\n{traceback.format_exc()}")
        return jsonify({
            "error": "An error occurred while processing your request",
            "details": str(e),
        }), 500
