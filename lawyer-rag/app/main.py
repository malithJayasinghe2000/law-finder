"""
LawyerAI RAG System - Flask Application Entry Point

This is the main entry point for the Flask API server.
It registers all blueprints. Called only by the Next.js server, never a browser.
"""

from flask import Flask

from app.utils.helpers import setup_logging
from app.config import config

# Set up logging before anything else
setup_logging("INFO")


def create_app() -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)

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
    # Bind it to a private interface or keep it behind the application host.

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

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(
        host="0.0.0.0",
        port=config.FLASK_PORT,
        debug=config.FLASK_DEBUG,
    )
