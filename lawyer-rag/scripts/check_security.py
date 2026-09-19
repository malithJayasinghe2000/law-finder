"""
Stage 0 security assertions, run against a LIVE service.

    ./venv/bin/python scripts/check_security.py

Why a live check and not unit tests. Every finding this asserts was reproduced
against the running service, and two of them (the bind address, and which routes
the before_request hook actually covers) cannot be observed any other way — they
are properties of the running process, not of a function. The main product
learned the same lesson over nine phases: a green build has never once proved a
rule holds.

Run it after any change to main.py, the api/ blueprints, or config.py.
"""

import json
import os
import socket
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import config  # noqa: E402

BASE = f"http://127.0.0.1:{config.FLASK_PORT}"
TOKEN = config.RAG_SERVICE_TOKEN
AUTH = {"X-Service-Token": TOKEN}

passed = 0
failed = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}" + (f"\n        {detail}" if detail else ""))


def lan_ip() -> str | None:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


print("\n[1] Authentication — every route, not a list of routes")
# The hook is before_request, so this is the whole surface. A route added
# tomorrow is covered without anybody remembering to cover it.
for method, path in [
    ("GET", "/"),
    ("POST", "/api/chat"),
    ("POST", "/api/ingest"),
    ("POST", "/api/ingest/upload"),
    ("POST", "/api/ingest/amendment"),
    ("POST", "/api/ingest/batch"),
    ("GET", "/api/documents"),
    ("GET", "/api/documents/categories"),
    ("DELETE", "/api/documents/Companies%20Act"),
]:
    r = requests.request(method, f"{BASE}{path}", timeout=20)
    check(f"{method} {path} without a token -> 401", r.status_code == 401,
          f"got {r.status_code}: {r.text[:120]}")

r = requests.get(f"{BASE}/api/health", timeout=20)
check("GET /api/health without a token -> not 401 (deploy checks need it)",
      r.status_code != 401, f"got {r.status_code}")

r = requests.get(f"{BASE}/", headers={"X-Service-Token": "wrong-token"}, timeout=20)
check("a WRONG token -> 401", r.status_code == 401, f"got {r.status_code}")

r = requests.get(f"{BASE}/", headers=AUTH, timeout=20)
check("the right token -> 200", r.status_code == 200, f"got {r.status_code}")


print("\n[2] Bind address — loopback only")
check("configured host is 127.0.0.1", config.FLASK_HOST == "127.0.0.1",
      f"FLASK_HOST={config.FLASK_HOST}")
ip = lan_ip()
if ip and ip != "127.0.0.1":
    try:
        requests.get(f"http://{ip}:{config.FLASK_PORT}/api/health", timeout=3)
        check(f"not reachable on the LAN address {ip}", False,
              "the service answered on a non-loopback interface")
    except requests.exceptions.RequestException:
        check(f"not reachable on the LAN address {ip}", True)
else:
    print("  SKIP  no LAN address to test against")


print("\n[3] Upload path traversal — the file must land inside data/uploads")
uploads = Path(config.UPLOADS_DIR).resolve()
# Snapshot BEFORE anything is posted, and clean up every file this run creates —
# including the ones section [5] writes. A check that leaves litter in the corpus
# directory is a check people stop running.
before = set(uploads.rglob("*"))
sentinels = [
    "../../PWNED.pdf",
    "../../../../tmp/pwned.pdf",
    "../../app/core/llm.py",
    "....//....//etc/passwd.pdf",
    "evil.pdf.py",
    "",
]
escaped = []
for name in sentinels:
    for path, extra in [
        ("/api/ingest/upload", {"title": "t", "category": "Acts & Ordinances"}),
        ("/api/ingest", {}),
        ("/api/ingest/amendment", {"principal_act_name": "Companies Act"}),
    ]:
        requests.post(
            f"{BASE}{path}",
            headers=AUTH,
            files={"file": (name, b"%PDF-1.4 sentinel")},
            data=extra,
            timeout=60,
        )

# Nothing may exist outside the uploads directory.
repo = Path(__file__).resolve().parent.parent
for probe in [repo / "PWNED.pdf", repo / "app" / "core" / "llm.py",
              Path("/tmp/pwned.pdf")]:
    if probe.name == "llm.py":
        # It legitimately exists — assert it was not OVERWRITTEN.
        content = probe.read_text()
        check("app/core/llm.py was not overwritten",
              "sentinel" not in content and "ChatOllama" in content)
    else:
        check(f"nothing written to {probe}", not probe.exists(),
              "a traversal escaped the uploads directory")

for p in sorted(uploads.rglob("*")):
    if p in before:
        continue
    check(f"new file {p.name} is inside data/uploads",
          p.resolve().is_relative_to(uploads))

r = requests.post(
    f"{BASE}/api/ingest/upload",
    headers=AUTH,
    files={"file": ("notes.txt", b"not a pdf")},
    data={"title": "t", "category": "Acts & Ordinances"},
    timeout=60,
)
check("a non-PDF extension is rejected", r.status_code == 400,
      f"got {r.status_code}: {r.text[:120]}")

r = requests.post(
    f"{BASE}/api/ingest/upload",
    headers=AUTH,
    files={"file": ("evil.pdf.py", b"x")},
    data={"title": "t", "category": "Acts & Ordinances"},
    timeout=60,
)
check("'evil.pdf.py' is rejected (extension checked on the sanitised name)",
      r.status_code == 400, f"got {r.status_code}")


print("\n[4] Request limits")
r = requests.post(
    f"{BASE}/api/chat",
    headers=AUTH,
    json={"message": "a" * (config.MAX_MESSAGE_CHARS + 1)},
    timeout=60,
)
check(f"a message over {config.MAX_MESSAGE_CHARS} chars -> 413",
      r.status_code == 413, f"got {r.status_code}: {r.text[:120]}")

r = requests.post(f"{BASE}/api/chat", headers=AUTH,
                  json={"message": "hi", "conversation_history": "not a list"},
                  timeout=60)
check("a non-list conversation_history -> 400", r.status_code == 400,
      f"got {r.status_code}")

r = requests.post(f"{BASE}/api/chat", headers=AUTH, json={"message": 12345},
                  timeout=60)
check("a non-string message -> 400", r.status_code == 400, f"got {r.status_code}")

over = config.MAX_CONTENT_LENGTH + 1024
try:
    r = requests.post(
        f"{BASE}/api/ingest/upload",
        headers=AUTH,
        files={"file": ("big.pdf", b"0" * over)},
        data={"title": "t", "category": "Acts & Ordinances"},
        timeout=120,
    )
    check(f"a body over {config.MAX_CONTENT_LENGTH // 1024 // 1024}MB -> 413",
          r.status_code == 413, f"got {r.status_code}")
except requests.exceptions.RequestException:
    # The server may close the connection rather than read the whole body.
    check(f"a body over {config.MAX_CONTENT_LENGTH // 1024 // 1024}MB is refused", True)


print("\n[5] Error responses carry a reference, not the server's internals")
r = requests.post(
    f"{BASE}/api/ingest/upload",
    headers=AUTH,
    files={"file": ("corrupt.pdf", b"not actually a pdf at all")},
    data={"title": "t", "category": "Acts & Ordinances"},
    timeout=120,
)
body = r.text
check("an error body has no absolute filesystem path",
      "/Users/" not in body and str(Path.cwd()) not in body,
      f"body: {body[:200]}")
check("an error body has no traceback", "Traceback" not in body)
if r.status_code >= 500:
    try:
        check("a 500 carries an error_id to quote", "error_id" in r.json())
    except json.JSONDecodeError:
        check("a 500 carries an error_id to quote", False, "body was not JSON")
else:
    print(f"  SKIP  error_id (this input returned {r.status_code}, not 5xx)")

r = requests.get(f"{BASE}/api/health", timeout=30)
h = r.json()
check("/api/health does not enumerate installed models",
      "available_models" not in json.dumps(h))
check("/api/health does not disclose the Ollama base URL",
      config.OLLAMA_BASE_URL not in json.dumps(h))


print("\n[6] Privacy — tracing is off")
check("config.TRACING_ENABLED is False", config.TRACING_ENABLED is False)
check("LANGCHAIN_TRACING_V2 is false in the environment",
      os.environ.get("LANGCHAIN_TRACING_V2", "false").lower() != "true")
check("no LangSmith API key in the environment",
      not os.environ.get("LANGCHAIN_API_KEY") and not os.environ.get("LANGSMITH_API_KEY"))
try:
    from langsmith import utils as ls_utils
    check("langsmith itself reports tracing disabled",
          not ls_utils.tracing_is_enabled())
except ImportError:
    print("  SKIP  langsmith not installed")
check("/api/health reports tracing_enabled=false", h.get("tracing_enabled") is False)


print(f"\n[7] Generation bounds (provider={config.LLM_PROVIDER})")
# The bounds are asserted on the LIVE client, not on config, because config
# saying 32768 proves nothing about what the client was built with. Which
# bounds exist depends on the provider, so the branch is on purpose: asserting
# num_ctx against a hosted client would fail for a reason that is not a defect,
# and deleting the assertion to avoid that would give up the check entirely.
check("num_predict is capped", 0 < config.LLM_NUM_PREDICT <= 8192,
      f"got {config.LLM_NUM_PREDICT}")
from app.core.llm import get_llm  # noqa: E402
llm = get_llm()

if config.LLM_PROVIDER == "ollama":
    # Ollama truncates SILENTLY when the context overflows, and what may be
    # dropped includes the system prompt carrying "you never advise a person
    # about their own case". A safety instruction that disappears without a log
    # line is not a control — hence a floor on num_ctx, and hence checking that
    # the client actually carries it.
    check("num_ctx is at least 32768", config.LLM_NUM_CTX >= 32768,
          f"got {config.LLM_NUM_CTX}")
    check("the live client carries num_ctx", llm.num_ctx == config.LLM_NUM_CTX)
    check("the live client carries num_predict",
          llm.num_predict == config.LLM_NUM_PREDICT)
else:
    # A hosted API has a fixed context window and ERRORS on overflow rather than
    # truncating, so there is no silent-truncation guard to assert. max_tokens
    # is the counterpart of num_predict and must carry the same single number.
    # Field NAMES differ per provider and the aliases are not attributes:
    # ChatGoogleGenerativeAI stores max_output_tokens / timeout, where another
    # SDK might store max_tokens / default_request_timeout. Read through a
    # tuple of candidates rather than guessing — an earlier version of this
    # check asserted Anthropic's names against a Google client and died with
    # AttributeError, which is how this check earns its keep.
    def first_attr(obj, *names):
        for n in names:
            v = getattr(obj, n, None)
            if v is not None:
                return v
        return None

    cap = first_attr(llm, "max_output_tokens", "max_tokens")
    check("the live client carries the generation cap",
          cap == config.LLM_NUM_PREDICT, f"got {cap}")
    # Unbounded waiting and unbounded retries both spend a caller's deadline
    # and return nothing. The Next.js caller gives up at 60s.
    to = first_attr(llm, "timeout", "default_request_timeout")
    check("the live client has a request timeout", bool(to) and to > 0,
          f"got {to}")
    check("retries are bounded at 1", llm.max_retries <= 1,
          f"got {getattr(llm, 'max_retries', None)}")
    # Hosted inference is a cross-border transfer and a sub-processor. This does
    # not block it — the operator may have closed A4 — but it must never be the
    # thing nobody noticed, which is exactly how the LangSmith leak persisted.
    print("        NOTE  hosted inference is on: question text leaves Sri Lanka.")
    print("              OPEN-ITEMS A4 / counsel Q19 must be closed, and the")
    print("              provider recorded in DATA-INVENTORY.md, before real users.")


print("\n[8] Retrieval never drops the Active status filter")
import app.core.vectorstore as vs_mod  # noqa: E402

seen_filters = []


class _Boom:
    """A vector store whose first, filtered search always fails."""

    def __init__(self, fail_times: int):
        self.fail_times = fail_times

    def similarity_search_with_relevance_scores(self, query, k, filter=None):
        seen_filters.append(filter)
        if len(seen_filters) <= self.fail_times:
            raise RuntimeError("simulated Chroma filter error")
        return [("doc", 0.9)]


original = vs_mod.get_vectorstore
try:
    # One failure: the retry must still carry status=Active.
    seen_filters.clear()
    vs_mod.get_vectorstore = lambda: _Boom(fail_times=1)
    vs_mod.search_documents(query="q", top_k=3,
                            filter_metadata={"document_name": "Companies Act"})
    check("after a filter error, the retry still filters on Active",
          seen_filters[-1] == {"status": "Active"},
          f"retry filter was {seen_filters[-1]!r}")
    check("no retrieval call ran with filter=None",
          all(f is not None for f in seen_filters),
          f"filters seen: {seen_filters!r}")

    # Both fail: RAISE rather than searching unfiltered, and rather than
    # returning an empty list.
    #
    # This asserted `out == []` until 2026-09-14. The security property it was
    # written to protect — never fall back to an unfiltered search, because that
    # makes repealed law citable — is unchanged and still asserted below. What
    # changed is that an empty list is now reserved for its one honest meaning:
    # the corpus was searched and holds nothing. A search that could not run
    # says so, because reporting it as an empty corpus made the assistant tell a
    # user it held no legislation on a question it holds. See RetrievalUnavailable.
    seen_filters.clear()
    vs_mod.get_vectorstore = lambda: _Boom(fail_times=99)
    raised = None
    try:
        out = vs_mod.search_documents(query="q", top_k=3)
    except vs_mod.RetrievalUnavailable as exc:
        raised = exc
    check("when the status-filtered retry also fails, it raises rather than "
          "returning an empty corpus",
          raised is not None,
          "it returned instead of raising — an outage would be reported to the "
          "user as 'I do not hold that legislation'")
    check("it did NOT fall back to an unfiltered search",
          all(f is not None for f in seen_filters),
          f"filters seen: {seen_filters!r}")
finally:
    vs_mod.get_vectorstore = original

# The caller's dict must not be mutated.
caller_filter = {"document_name": "Companies Act"}


class _Ok:
    def similarity_search_with_relevance_scores(self, query, k, filter=None):
        return []


try:
    vs_mod.get_vectorstore = lambda: _Ok()
    vs_mod.search_documents(query="q", filter_metadata=caller_filter)
    check("the caller's filter dict is not mutated",
          caller_filter == {"document_name": "Companies Act"},
          f"caller's dict became {caller_filter!r}")
finally:
    vs_mod.get_vectorstore = original


# ---------------------------------------------------------------------------
# Clean up
# ---------------------------------------------------------------------------
# Every file this script posted is a throwaway that fails to parse as a PDF, so
# nothing reaches the vector store or the knowledge graph. Remove them anyway:
# the uploads directory is tracked in git, and a check that dirties the working
# tree gets run less often.
#
# NOTE for anyone extending this: do NOT make these uploads valid PDFs. A
# successful ingest followed by a delete does NOT restore the knowledge graph —
# entity ids like `act::ordinance` and `court::high_court` are global while
# `document_name` is a single attribute, so ingesting steals those nodes from
# whatever Act had them and deleting then removes them outright. Found the hard
# way: an ingest-and-delete probe during Stage 0 stripped nine nodes and five
# edges belonging to the Criminal Procedure Code, and they had to be restored
# from git.
removed = 0
for p in sorted(uploads.rglob("*")):
    if p not in before and p.is_file():
        p.unlink(missing_ok=True)
        removed += 1
if removed:
    print(f"\ncleaned up {removed} test upload(s) from {uploads}")

leftover = [p.name for p in uploads.rglob("*") if p not in before]
check("the check leaves the uploads directory as it found it", not leftover,
      f"left behind: {leftover}")

print(f"\n{passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
