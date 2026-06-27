import json
import os
from datetime import datetime
from pathlib import Path
from app.config import config

class ChatLogger:
    """
    Handles logging of chat conversations to a JSONL (JSON Lines) file.
    This is best practice for file-based data collection as it allows appending
    without loading the whole file into memory, and is easy to parse later.
    """
    
    def __init__(self):
        self.log_dir = Path(config.CHAT_LOG_DIR)
        
    def _get_log_file_path(self) -> Path:
        """Returns the log file path for the current day."""
        # Creating a new file per day to prevent a single file from getting too large
        today = datetime.now().strftime("%Y-%m-%d")
        return self.log_dir / f"chat_log_{today}.jsonl"

    def log_interaction(self, user_message: str, response: dict, conversation_history: list = None):
        """
        Logs a single chat interaction.
        
        Args:
            user_message (str): The question from the user.
            response (dict): The result from the RAG system (contains 'answer', 'sources', etc.).
            conversation_history (list, optional): Previous messages in the conversation.
        """
        try:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "user_message": user_message,
                "bot_response": response.get("answer", ""),
                "sources_retrieved": response.get("sources", []),
                "chunks_retrieved_count": response.get("chunks_retrieved", 0),
                "conversation_history": conversation_history or []
            }
            
            # Append to the JSONL file
            log_file = self._get_log_file_path()
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
                
        except Exception as e:
            # We don't want logging failures to break the main chat flow
            import logging
            logging.getLogger(__name__).error(f"Failed to log chat interaction: {e}")

# Global instance
chat_logger = ChatLogger()
