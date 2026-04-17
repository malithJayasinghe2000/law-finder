"""Quick test of the chat API endpoint."""
import requests
import json

BASE_URL = "http://localhost:5000"

# Test 1: Health check
print("=" * 60)
print("TEST 1: Health Check")
print("=" * 60)
r = requests.get(f"{BASE_URL}/api/health")
print(json.dumps(r.json(), indent=2))

# Test 2: List documents
print("\n" + "=" * 60)
print("TEST 2: List Documents")
print("=" * 60)
r = requests.get(f"{BASE_URL}/api/documents")
data = r.json()
for doc in data["documents"]:
    print(f"  - {doc['document_name']} ({doc['document_type']}) "
          f"[{doc['active_chunks']} active chunks]")
print(f"  Total chunks: {data['collection_stats']['total_chunks']}")

# Test 3: Chat - Motor Traffic
print("\n" + "=" * 60)
print("TEST 3: Chat - Motor Traffic Question")
print("=" * 60)
r = requests.post(f"{BASE_URL}/api/chat", json={
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
r = requests.post(f"{BASE_URL}/api/chat", json={
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
