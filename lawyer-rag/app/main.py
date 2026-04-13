"""
LawyerAI RAG System - Flask Application Entry Point

This is the main entry point for the Flask API server.
It registers all blueprints and configures CORS for the Next.js frontend.
"""

from flask import Flask
from flask_cors import CORS

from app.utils.helpers import setup_logging
from app.config import config

# Set up logging before anything else
setup_logging("INFO")


def create_app() -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)

    # Configure CORS to allow requests from the Next.js frontend
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3001",
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    })

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
