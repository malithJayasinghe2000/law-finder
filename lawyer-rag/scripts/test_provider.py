"""Test script for the active LLM provider configuration."""
import os
import sys

# Add the project directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import config
from app.core.llm import get_llm

print("=" * 60)
print("TEST: LLM Provider Initialization")
print("=" * 60)
print(f"LLM_PROVIDER:      {config.LLM_PROVIDER}")
print(f"LLM_MODEL:         {config.LLM_MODEL}")
print(f"OLLAMA_BASE_URL:   {config.OLLAMA_BASE_URL}")
print(f"HF_API_BASE:       {config.HF_API_BASE}")
print(f"OPENAI_API_BASE:   {config.OPENAI_API_BASE}")
print(f"OPENROUTER_API_BASE: {config.OPENROUTER_API_BASE}")
print("-" * 60)
print(f"HF_TOKEN set:       {'Yes' if config.HF_TOKEN else 'No'}")
print(f"OPENAI_API_KEY set: {'Yes' if config.OPENAI_API_KEY else 'No'}")
print(f"OPENROUTER_KEY set: {'Yes' if config.OPENROUTER_API_KEY else 'No'}")
print("-" * 60)

try:
    print("Initializing LLM...")
    llm = get_llm()
    print(f"LLM instance class: {llm.__class__.__name__}")
    
    print("\nInvoking test completion...")
    response = llm.invoke("Hello, respond with only the word 'success' if you receive this message.")
    print("-" * 60)
    print(f"Response: {response.content}")
    print("-" * 60)
    
except Exception as e:
    print(f"Error during test: {e}")
    import traceback
    traceback.print_exc()

print("=" * 60)
