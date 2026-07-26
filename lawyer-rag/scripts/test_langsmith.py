import os
import sys
from dotenv import load_dotenv

# Load env variables to ensure LangSmith vars are picked up
load_dotenv()

# Add the parent directory to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.rag_chain import query_rag

def main():
    print("======================================================")
    print("Testing Lawyer RAG with LangSmith Tracing Enabled")
    print("======================================================")
    print(f"LANGCHAIN_TRACING_V2: {os.environ.get('LANGCHAIN_TRACING_V2')}")
    print(f"LANGCHAIN_PROJECT: {os.environ.get('LANGCHAIN_PROJECT')}")
    print("======================================================")
    
    question = "someone cut the tree of my own property without asking anything from me. what kind of legal action can get for this situation"
    print(f"\nQuerying: '{question}'")
    
    try:
        result = query_rag(question)
        
        print("\n--- RESPONSE ---")
        print(result.get("answer", "No answer returned."))
        
        print("\n--- SOURCES ---")
        sources = result.get("sources", [])
        if sources:
            for i, s in enumerate(sources):
                print(f"[{i+1}] {s.get('document_name')} - Section {s.get('section')}")
        else:
            print("No sources found.")
            
        print("\n======================================================")
        print("Success! Check your LangSmith dashboard to view the trace:")
        print(f"https://smith.langchain.com/o/-/projects/p?project={os.environ.get('LANGCHAIN_PROJECT', 'lawyer-rag')}")
        print("======================================================")
        
    except Exception as e:
        print(f"\nError occurred during query: {e}")

if __name__ == "__main__":
    main()
