"""
LawyerAI RAG System - Chat API Endpoint

Handles user queries through the RAG pipeline.
POST /api/chat → Retrieves relevant legal context → Generates response
"""

import logging
import time
from flask import Blueprint, request, jsonify

from app.config import config
from app.core.rag_chain import query_rag
from app.utils.chat_logger import chat_logger
from app.utils.errors import error_response

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

        if not isinstance(data["message"], str):
            return jsonify({"error": "'message' must be a string"}), 400

        message = data["message"].strip()
        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        # Request limits.
        #
        # There were none: one caller could send a 10 MB question or a 500-turn
        # history and hold the model for as long as it took. That is a denial of
        # service against a single-model service with no rate limiting, and on
        # hosted inference it would be a bill.
        #
        # These are rejections, not truncations. Silently answering a different
        # question from the one asked is worse than refusing — especially here,
        # where the caller is a legal assistant and the user cannot see that
        # half their question was dropped.
        if len(message) > config.MAX_MESSAGE_CHARS:
            logger.warning(
                f"Rejected oversized message: {len(message)} chars "
                f"(limit {config.MAX_MESSAGE_CHARS})"
            )
            return jsonify({
                "error": (
                    f"Message too long. The limit is "
                    f"{config.MAX_MESSAGE_CHARS} characters."
                )
            }), 413

        conversation_history = data.get("conversation_history", [])
        if not isinstance(conversation_history, list):
            return jsonify({"error": "'conversation_history' must be a list"}), 400

        # History is trimmed rather than rejected, because the caller does not
        # choose how long a conversation has run and the oldest turns are the
        # least relevant. Keep the most recent turns.
        if len(conversation_history) > config.MAX_HISTORY_TURNS:
            logger.info(
                f"Trimming conversation history: {len(conversation_history)} turns "
                f"-> {config.MAX_HISTORY_TURNS}"
            )
            conversation_history = conversation_history[-config.MAX_HISTORY_TURNS:]

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
        # No "details" field. It carried str(e) — file paths, model names and
        # library internals — to a caller that only ever tells the user the
        # assistant is unavailable. The detail is in the log under error_id.
        return error_response(
            e, "An error occurred while processing your request", 500, context="chat"
        )
