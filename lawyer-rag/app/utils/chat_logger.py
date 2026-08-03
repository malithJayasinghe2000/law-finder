"""
Chat interaction logging.

─────────────────────────────────────────────────────────────────────────────
This used to write the full text of every question and answer to a plaintext
JSONL file on disk, indefinitely, with no retention and no access control — and
one of those files was committed to the repository.
─────────────────────────────────────────────────────────────────────────────

What people type into a legal assistant is an account of their legal problems.
That is sensitive personal data under the Personal Data Protection Act No. 9 of
2022, and where a person is seeking legal help it can be the same material that
would be privileged in a lawyer's hands. Keeping a second, unmanaged copy of it
next to the vector store — outside the application, outside the database, and
outside anything Phase 6 will build for subject access and erasure — is a
liability with no matching benefit.

The application already stores the conversations of signed-in users properly, in
Postgres, scoped to the user, deletable by them, with a retention period. That is
the record. This is not.

So the content is gone and the shape is kept. What remains is enough to answer
"is the pipeline healthy" — how long it took, how much was retrieved, whether
anything came back — and not enough to reconstruct what anyone asked.

Set RAG_LOG_CONTENT=true to log message text as well. It exists for local
debugging against your own queries. Do not set it anywhere real.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path

from app.config import config

logger = logging.getLogger(__name__)

# Off unless explicitly switched on, and never on by accident: the value has to
# be the literal string "true".
LOG_CONTENT = os.getenv("RAG_LOG_CONTENT", "false").lower() == "true"


class ChatLogger:
    """Appends one metrics line per interaction. No message content by default."""

    def __init__(self):
        self.log_dir = Path(config.CHAT_LOG_DIR)

    def _get_log_file_path(self) -> Path:
        today = datetime.now().strftime("%Y-%m-%d")
        return self.log_dir / f"chat_metrics_{today}.jsonl"

    def log_interaction(
        self,
        user_message: str,
        response: dict,
        conversation_history: list = None,
        duration_ms: int = None,
    ):
        """
        Record that an interaction happened, and how it went.

        `user_message` is accepted so callers do not have to change, and is used
        only for its length unless RAG_LOG_CONTENT is on.
        """
        try:
            sources = response.get("sources", []) or []

            entry = {
                "timestamp": datetime.now().isoformat(),
                "intent": response.get("intent", "unknown"),
                "question_chars": len(user_message or ""),
                "answer_chars": len(response.get("answer", "") or ""),
                "sources_count": len(sources),
                # Which Acts were retrieved is a corpus-coverage signal and says
                # nothing about who asked or why.
                "documents_cited": sorted(
                    {s.get("document_name", "") for s in sources if s.get("document_name")}
                ),
                "chunks_retrieved": response.get("chunks_retrieved", 0),
                "history_turns": len(conversation_history or []),
            }

            if duration_ms is not None:
                entry["duration_ms"] = duration_ms

            if LOG_CONTENT:
                entry["_content"] = {
                    "user_message": user_message,
                    "answer": response.get("answer", ""),
                }

            with open(self._get_log_file_path(), "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        except Exception as e:
            # A logging failure must never break an answer.
            logger.error(f"Failed to log chat metrics: {e}")


chat_logger = ChatLogger()
