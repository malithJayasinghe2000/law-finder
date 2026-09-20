"""
Quick test of the chat API endpoint, over HTTP.

Every route except /api/health now requires the service token, so this reads it
from config rather than hardcoding anything. BASE_URL used to be port 5000 while
the service has run on 5001 since the collision with macOS AirPlay Receiver, so
these tests had been failing to connect rather than passing.
"""
import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import config

BASE_URL = f"http://127.0.0.1:{config.FLASK_PORT}"
AUTH = {"X-Service-Token": config.RAG_SERVICE_TOKEN}

# Test 1: Health check
print("=" * 60)
print("TEST 1: Health Check")
print("=" * 60)
r = requests.get(f"{BASE_URL}/api/health", timeout=30)
print(json.dumps(r.json(), indent=2))

# Test 2: List documents
print("\n" + "=" * 60)
print("TEST 2: List Documents")
print("=" * 60)
r = requests.get(f"{BASE_URL}/api/documents", headers=AUTH, timeout=60)
data = r.json()
for doc in data["documents"]:
    print(f"  - {doc['document_name']} ({doc['document_type']}) "
          f"[{doc['active_chunks']} active chunks]")
print(f"  Total chunks: {data['collection_stats']['total_chunks']}")

# Test 3: Chat - Motor Traffic
print("\n" + "=" * 60)
print("TEST 3: Chat - Motor Traffic Question")
print("=" * 60)
r = requests.post(f"{BASE_URL}/api/chat", headers=AUTH, timeout=300, json={
    "message": "What are the penalties for drunk driving under the Motor Traffic Act?"
})
data = r.json()
print(f"Answer:\n{data['answer'][:800]}")
print(f"\nSources ({data['chunks_retrieved']} chunks):")
for src in data["sources"][:3]:
    print(f"  - {src['document_name']} / {src['section']} (score: {src['relevance_score']})")

# Test 4: Chat - Companies Act
print("\n" + "=" * 60)
print("TEST 4: Chat - Companies Act Question")
print("=" * 60)
r = requests.post(f"{BASE_URL}/api/chat", headers=AUTH, timeout=300, json={
    "message": "What are the requirements to register a company in Sri Lanka?"
})
data = r.json()
print(f"Answer:\n{data['answer'][:800]}")
print(f"\nSources ({data['chunks_retrieved']} chunks):")
for src in data["sources"][:3]:
    print(f"  - {src['document_name']} / {src['section']} (score: {src['relevance_score']})")

print("\n" + "=" * 60)
print("ALL TESTS COMPLETE!")
print("=" * 60)
