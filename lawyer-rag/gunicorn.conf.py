"""
gunicorn configuration for the RAG service.

Read the worker note before raising `workers`.
"""

import os

# Imported under a private alias deliberately. gunicorn reads every module-level
# name in this file as a setting, and `config` is one of its own (the -c flag),
# so `from app.config import config` makes it exit with "Not a string".
from app.config import config as _app

# Loopback by default. This service must not be reachable from the public
# internet: the one legitimate caller is the Next.js server, which reaches it
# over localhost or a private network.
bind = f"{_app.FLASK_HOST}:{_app.FLASK_PORT}"

# ---------------------------------------------------------------------------
# Workers — deliberately ONE, and do not raise it without reading this
# ---------------------------------------------------------------------------
# app/core/llm.py, app/core/vectorstore.py and app/core/graph_store.py each
# hold a module-level singleton (_llm_instance, _vectorstore_instance, and the
# knowledge graph), and the knowledge graph is mutated during ingestion and
# saved to a single JSON file. None of that has been checked for thread or
# process safety.
#
# With gunicorn's default sync worker, `workers = N` forks N processes, so each
# gets its own copy of those singletons and its own ChromaDB client against the
# same directory — and two processes writing knowledge_graph.json will lose
# writes. Concurrency is a Stage 3 item; until it is done, one worker is the
# honest setting.
#
# Requests are long (a question can take tens of seconds of inference), so the
# useful lever today is `timeout`, not `workers`.
workers = int(os.getenv("GUNICORN_WORKERS", "1"))
threads = int(os.getenv("GUNICORN_THREADS", "1"))

# Inference is slow. The Next.js caller gives up at 60s (RAG_TIMEOUT_MS), and a
# worker timeout below that would kill work the caller is still waiting for.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = 30
keepalive = 5

# Log to stdout/stderr so the process manager owns the log files.
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOGLEVEL", "info")

# Never log the query string: a question to a legal assistant can carry the
# facts of someone's legal problem, and app/utils/chat_logger.py already
# decided that text does not get written to disk. The default access log format
# includes the full path with its query string, so this narrows it.
access_log_format = '%(h)s "%(m)s %(U)s" %(s)s %(b)s %(M)sms'

# preload_app stays OFF, and this is not a default left unexamined.
#
# Setting it True SEGFAULTS the worker on the first request. Verified: gunicorn
# logged "Listening at http://127.0.0.1:5001", then
#
#   [WARNING] Worker (pid:99807) was sent SIGSEGV!
#
# on every request, in a crash loop. Preloading imports chromadb and its native
# stack in the master and then fork()s; the child inherits state those libraries
# cannot survive a fork with. The service looks healthy — the port is open and
# the startup log is clean — and answers nothing. Do not turn this on.
#
# What preloading would have bought was a loud master-level failure when
# RAG_SERVICE_TOKEN is unset, instead of workers crash-looping behind an open
# port. The assertion below buys that without the fork: gunicorn imports this
# config file in the master before it binds, and app.config is cheap to import
# (no chromadb, no langchain).
preload_app = False

if not _app.RAG_SERVICE_TOKEN:
    raise RuntimeError(
        "RAG_SERVICE_TOKEN is not set. This service has no other "
        "authentication, so it will not start without it. Generate one with "
        '`python -c "import secrets; print(secrets.token_urlsafe(48))"` and set '
        "it in lawyer-rag/.env AND lawyer-finder-web/.env — the two must match."
    )

proc_name = "lawyer-rag"
