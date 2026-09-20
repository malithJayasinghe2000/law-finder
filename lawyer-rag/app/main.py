"""
LawyerAI RAG System - Flask Application Entry Point

This is the main entry point for the Flask API server.
It registers all blueprints. Called only by the Next.js server, never a browser.

Run it in production under gunicorn, via wsgi.py — not through this file.
See docs/RUNNING.md.
"""

import hmac
import logging
import os

from flask import Flask, jsonify, request

from app.utils.helpers import setup_logging
from app.utils.errors import error_response
from app.config import config

# Set up logging before anything else
setup_logging("INFO")

logger = logging.getLogger(__name__)

# Routes that answer without the service token.
#
# Only the health check. A deploy, a load balancer or a container orchestrator
# has to be able to ask "are you up?" before it has any credential, and the
# answer has been reduced to liveness — no model list, no base URL, no
# exception text (see documents.py).
UNAUTHENTICATED_PATHS = frozenset({"/api/health"})


def require_service_token():
    """
    Reject anything that does not present the shared secret.

    Registered as a before_request hook, so it covers every route on every
    blueprint — including routes added later, which is the point. A decorator
    applied route by route is one forgotten decorator away from an open
    endpoint, and this service had five of them.

    What was open before Stage 0, to anyone who could reach the port:

        POST   /api/chat              unlimited inference on your hardware
        POST   /api/ingest{,/upload,/amendment,/batch}
                                      write files; inject fabricated law
        DELETE /api/documents/<name>  delete an Act from the corpus

    Corpus injection is the one that matters most, because it defeats the
    downstream guardrail rather than merely bypassing it. The application's
    UNSUPPORTED_CITATION check in src/lib/ai/policy.ts compares the model's
    prose against what retrieval returned — so an Act that does not exist but
    IS in the vector store passes that check, and the assistant cites invented
    Sri Lankan legislation with a section number and a relevance score.

    hmac.compare_digest rather than == so the comparison does not leak the
    token's prefix through response timing.
    """
    if request.path in UNAUTHENTICATED_PATHS:
        return None

    presented = request.headers.get("X-Service-Token", "")
    if not hmac.compare_digest(presented, config.RAG_SERVICE_TOKEN):
        logger.warning(
            "Rejected unauthenticated %s %s from %s",
            request.method,
            request.path,
            request.remote_addr,
        )
        return jsonify({"error": "Unauthorized"}), 401

    return None


def create_app() -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Fail at startup, not at request time.
    #
    # A service that starts happily and then accepts everyone because a variable
    # was missing is the failure mode this whole change exists to remove. If the
    # token is not configured there is no safe way to serve, so do not serve.
    if not config.RAG_SERVICE_TOKEN:
        raise RuntimeError(
            "RAG_SERVICE_TOKEN is not set. This service has no other "
            "authentication, so it will not start without it. Generate one with "
            "`python -c \"import secrets; print(secrets.token_urlsafe(48))\"` and "
            "set it in lawyer-rag/.env AND lawyer-finder-web/.env — the two must "
            "match."
        )

    # Cap the request body. Without this an upload is bounded only by disk.
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH

    # Authentication, before every request, for every blueprint.
    app.before_request(require_service_token)

    # No CORS. Nothing in a browser calls this service any more.
    #
    # Until Phase 5 the chat page fetched /api/chat directly from the user's
    # machine, which is why browser origins were allowed here. Every caller is
    # now a Next.js server route — /api/ai/ask for questions, the admin
    # legal-document routes for ingestion — so cross-origin access has no
    # legitimate use, and allowing it would leave a way around the AI policy
    # that the application enforces on every answer.
    #
    # This service should not be reachable from the public internet at all.
    # It now binds to FLASK_HOST, which defaults to 127.0.0.1 — see the bottom
    # of this file. Until Stage 0 this comment sat directly above a hardcoded
    # 0.0.0.0 bind, which is worse than no comment: a reviewer reads the comment
    # and moves on.

    # Register API blueprints
    from app.api.chat import chat_bp
    from app.api.ingest import ingest_bp
    from app.api.documents import documents_bp

    app.register_blueprint(chat_bp)
    app.register_blueprint(ingest_bp)
    app.register_blueprint(documents_bp)

    # Root endpoint
    @app.route("/")
    def index():
        return {
            "service": "LawyerAI RAG System",
            "version": "1.0.0",
            "endpoints": {
                "chat": "POST /api/chat",
                "ingest": "POST /api/ingest",
                "ingest_amendment": "POST /api/ingest/amendment",
                "ingest_batch": "POST /api/ingest/batch",
                "documents": "GET /api/documents",
                "delete_document": "DELETE /api/documents/<name>",
                "health": "GET /api/health",
            },
        }

    @app.errorhandler(413)
    def _too_large(_e):
        mb = config.MAX_CONTENT_LENGTH // (1024 * 1024)
        return jsonify({"error": f"Request body too large. The limit is {mb} MB."}), 413

    @app.errorhandler(Exception)
    def _unhandled(e):
        """
        Catch anything a route did not.

        Without this, an unhandled exception returns Flask's own error page —
        and with the debugger on, the Werkzeug console. Debug now defaults to
        false, but a route that forgets its try/except should still not describe
        the server to its caller.
        """
        from werkzeug.exceptions import HTTPException

        if isinstance(e, HTTPException):
            return e
        return error_response(e, "Internal server error", 500, context="unhandled")

    logger.info(
        "RAG service configured: tracing=%s, debug=%s, max_body=%dMB, "
        "max_message=%d chars, num_ctx=%d",
        config.TRACING_ENABLED,
        config.FLASK_DEBUG,
        config.MAX_CONTENT_LENGTH // (1024 * 1024),
        config.MAX_MESSAGE_CHARS,
        config.LLM_NUM_CTX,
    )

    return app


if __name__ == "__main__":
    # Development only. app.run() is Flask's development server: single
    # threaded, no production hardening, and it should never serve traffic.
    # Production runs `gunicorn -c gunicorn.conf.py wsgi:app`.
    app = create_app()

    if config.FLASK_DEBUG:
        # The Werkzeug debugger opens an interactive Python console on any
        # unhandled exception. Anyone who can reach the port and make the app
        # throw gets a shell as the service user.
        logger.warning(
            "FLASK_DEBUG is on. The Werkzeug debugger is remote code execution "
            "for anyone who can reach this port. Never set this outside a "
            "local development machine."
        )

    app.run(
        host=config.FLASK_HOST,
        port=config.FLASK_PORT,
        debug=config.FLASK_DEBUG,
    )
