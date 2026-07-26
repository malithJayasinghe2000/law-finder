import sys
import shutil
import logging
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import config

def clear_all():
    print("=== Clearing Python RAG Databases & Uploads ===")
    
    # 1. Clear ChromaDB
    vectordb_path = Path(config.CHROMA_PERSIST_DIR)
    if vectordb_path.exists():
        print(f"Clearing Chroma Vector Database at: {vectordb_path}")
        try:
            shutil.rmtree(vectordb_path)
            vectordb_path.mkdir(parents=True, exist_ok=True)
            print("✔ Vector DB cleared successfully.")
        except Exception as e:
            print(f"❌ Failed to clear Vector DB: {e}")
    else:
        print("Vector DB directory not found. Nothing to clear.")
        
    # 2. Clear Knowledge Graph
    graph_path = Path(config.GRAPH_PERSIST_PATH)
    if graph_path.exists():
        print(f"Clearing Knowledge Graph file at: {graph_path}")
        try:
            graph_path.unlink()
            print("✔ Knowledge Graph cleared successfully.")
        except Exception as e:
            print(f"❌ Failed to delete Knowledge Graph: {e}")
    else:
        print("Knowledge Graph file not found. Nothing to clear.")
        
    # 3. Clear Uploaded Documents
    uploads_path = Path(config.UPLOADS_DIR)
    if uploads_path.exists():
        print(f"Clearing Admin Uploaded Documents folder: {uploads_path}")
        try:
            for file in uploads_path.iterdir():
                if file.is_file():
                    file.unlink()
            print("✔ Uploaded documents folder cleared successfully.")
        except Exception as e:
            print(f"❌ Failed to clear uploads folder: {e}")
    else:
        print("Uploads folder not found. Nothing to clear.")

    print("\n✔ Python RAG database reset complete!")

if __name__ == "__main__":
    clear_all()
