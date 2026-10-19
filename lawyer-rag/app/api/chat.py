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
from app.core.vectorstore import RetrievalUnavailable
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

    except RetrievalUnavailable as e:
        # 503, not 200, and emphatically not an answer.
        #
        # When retrieval cannot run, the honest report is that this service is
        # unavailable. The alternative — which is what happened before — is a
        # confident fixed string telling the user we hold no legislation
        # covering their question, which is a false statement about the law
        # rather than about the service, and it arrives over HTTP 200 so the
        # application's policy layer publishes it.
        #
        # 503 is already handled gracefully upstream: src/lib/ai/rag.ts turns a
        # non-200 into "The legal database is not responding at the moment".
        # That message is true. "I do not hold that legislation" was not.
        return error_response(
            e,
            "The legal database is temporarily unavailable",
            503,
            context="chat retrieval",
        )

    except Exception as e:
        # No "details" field. It carried str(e) — file paths, model names and
        # library internals — to a caller that only ever tells the user the
        # assistant is unavailable. The detail is in the log under error_id.
        return error_response(
            e, "An error occurred while processing your request", 500, context="chat"
        )


# ── Turning a question about someone's own case into the general question ──
#
# The Next.js policy refuses advice on a person's own matter. A bare refusal
# reads as a system that will not help (owner, 2026-10-19), so the caller asks
# here for the general question behind it — "my bike was damaged, what can I
# do?" becomes "Who is liable when a vehicle is damaged in an accident?" — and
# answers THAT, through the normal pipeline and every normal check.
#
# The rewrite carries no facts. The point is not tone: the answering model is
# then never shown the person's situation, so it cannot apply the law to it.
# This route only rewrites; it retrieves nothing and answers nothing, and the
# caller re-checks what comes back before using it.
GENERALISE_PROMPT = """You rewrite a person's question about their own legal situation into ONE general question about what Sri Lankan law says.

Rules:
- Remove every personal detail: no "I", "my", "me", "we", "our", "you", "your", no names, places, dates, amounts or relationships specific to them.
- Ask what the law says, in general terms, about the legal issue underneath. Use words like "a person", "an owner", "a tenant", "a driver".
- Do not ask what anyone should do, whether anyone will win, or for a lawyer.
- One sentence, ending with "?". At most 25 words.
- If there is no legal issue in it, reply with exactly: NONE

Reply with the question only."""


@chat_bp.route("/api/generalise", methods=["POST"])
def generalise():
    try:
        data = request.get_json(silent=True) or {}
        message = data.get("message")
        if not isinstance(message, str) or not message.strip():
            return jsonify({"error": "Missing 'message'"}), 400
        message = message.strip()
        if len(message) > config.MAX_MESSAGE_CHARS:
            return jsonify({"error": "Message too long"}), 413

        from langchain_core.messages import HumanMessage, SystemMessage
        from app.core.llm import get_llm, message_text

        reply = get_llm().invoke(
            [SystemMessage(content=GENERALISE_PROMPT), HumanMessage(content=message)]
        )
        text = message_text(reply).strip().strip('"').strip()
        # Only the first line; a model that explains itself has not followed the
        # format, and its explanation is not ours to show.
        text = text.splitlines()[0].strip() if text else ""
        if not text or text.upper().startswith("NONE"):
            return jsonify({"question": None}), 200
        # Length only. The caller decides whether the question is acceptable.
        return jsonify({"question": text[:300]}), 200
    except Exception as e:
        return error_response(e, "Could not rewrite the question", 500, context="generalise")
