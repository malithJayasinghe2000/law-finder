"""LawyerAI RAG System - Configuration Management"""

import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# ---------------------------------------------------------------------------
# Tracing — off, and held off
# ---------------------------------------------------------------------------
# Until Stage 0 this service ran with LANGCHAIN_TRACING_V2=true and a live
# LangSmith API key in .env. @traceable decorates query_rag(question=...),
# search_documents(query=...) and both pipeline functions, and LangSmith traces
# function inputs and outputs — so the full text of every question a person
# asked a legal assistant, the legislation retrieved for it, and the generated
# answer were transmitted to a US cloud service.
#
# That is sensitive personal data with no documented lawful basis, an
# undocumented cross-border transfer (counsel question 19, happening in
# production rather than in theory), and a sub-processor that no firm was told
# about and no processor agreement covers.
#
# app/utils/chat_logger.py had already reasoned this through and stopped writing
# question text to a LOCAL file, on the grounds that a second unmanaged copy of
# someone's legal problem is a liability with no matching benefit. The same
# content was leaving the country by environment variable at the same time.
#
# Why this is not simply a .env edit. Everything downstream — langchain,
# langsmith, the @traceable decorator — reads os.environ directly and never
# consults this Config object, and load_dotenv() has already pushed whatever
# .env says into os.environ by the line above. So config resolves the intent
# once and then writes the answer back into the environment, which is the thing
# the libraries actually obey.
#
# Turning this back on is a decision with a legal precondition, not a config
# tweak: self-host the collector (Langfuse), or mask inputs and outputs, and
# record the sub-processor in DATA-INVENTORY.md first.
_TRACING_ENABLED: bool = os.getenv("RAG_TRACING_ENABLED", "false").lower() == "true"

if not _TRACING_ENABLED:
    for _var in ("LANGCHAIN_TRACING_V2", "LANGSMITH_TRACING", "LANGCHAIN_TRACING"):
        os.environ[_var] = "false"
    # Belt and braces: with no API key in the environment there is no credential
    # to transmit under, even if some future import flips a tracing flag back on.
    for _var in ("LANGCHAIN_API_KEY", "LANGSMITH_API_KEY"):
        os.environ.pop(_var, None)

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
VECTORDB_DIR = DATA_DIR / "vectordb"
GRAPH_DIR = DATA_DIR / "graph"
UPLOADS_DIR = DATA_DIR / "uploads"
CHAT_LOG_DIR = DATA_DIR / "chat_logs"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
VECTORDB_DIR.mkdir(parents=True, exist_ok=True)
GRAPH_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
CHAT_LOG_DIR.mkdir(parents=True, exist_ok=True)


class Config:
    """Central configuration for the RAG system."""

    # ── The chat model ────────────────────────────────────────────────────
    #
    # Two settings decide which model answers a legal question, and nothing
    # else does. LLM_PROVIDER picks the client; LLM_MODEL names the model.
    # app/core/llm.py builds it. There is no third place, on purpose: there
    # were once five files naming four different models between them, and
    # nobody could say which one a user's question actually reached.
    #
    #   ollama      local inference; the question never leaves the machine
    #   google      hosted inference; the question leaves Sri Lanka — read the
    #               preconditions in app/core/llm.py._build_google first
    #
    # The default is deliberately the local one. A hosted provider is a
    # cross-border transfer of personal data and a sub-processor, and neither
    # is a thing that should switch on because a variable was left unset.
    # LLM_MODEL has NO default, deliberately, and the service refuses to start
    # without it — the same treatment as RAG_SERVICE_TOKEN.
    #
    # A default here is a second place a model is named, and a second place is
    # all it takes: this line used to say "qwen3.5:9b" while .env ran
    # "llama3.2:3b", so the file that claimed to settle the question was itself
    # one of four answers to it. A fallback that silently runs a different model
    # from the one .env names is worse than a startup error, because the error
    # is over in a second and the wrong model answers legal questions quietly.
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
    LLM_MODEL: str = os.getenv("LLM_MODEL", "").strip()

    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    # Read here rather than left to the SDK's own os.environ lookup, so that a
    # missing key is a clear startup error naming the file to put it in rather
    # than an authentication failure on the first question a user asks.
    #
    # This is a Generative Language API key. It is NOT the Google OAuth client
    # secret or the Maps key in lawyer-finder-web/.env — same vendor, different
    # credential, and a different lawful basis (see llm.py._build_google).
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

    # How long to wait on a hosted provider. The Next.js caller gives up at 60s
    # (RAG_TIMEOUT_MS) and the gunicorn worker at 120s; waiting longer than
    # either is waiting for a reply nobody is still listening for.
    LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "90"))

    # Embeddings are ALWAYS local, whichever chat provider is configured. The
    # corpus was embedded with this model and the query must be embedded with
    # the same one, so changing it invalidates data/vectordb and means a
    # re-ingest and a fresh threshold sweep — see RETRIEVAL_MIN_SCORE below.
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

    # ChromaDB
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", str(VECTORDB_DIR))
    CHROMA_COLLECTION_NAME: str = os.getenv("CHROMA_COLLECTION_NAME", "sri_lanka_legal_acts")

    # Flask
    #
    # FLASK_HOST defaults to loopback. main.py used to bind 0.0.0.0 directly
    # beneath a comment saying the service must not be reachable from the public
    # internet — the comment said one thing and the code did the opposite, which
    # is worse than no comment because a reviewer reads the comment and moves on.
    #
    # FLASK_DEBUG defaults to FALSE. It used to default to true, and .env set it
    # true as well. The Werkzeug debugger opens an interactive Python console on
    # any unhandled exception; on a 0.0.0.0 bind that is remote code execution as
    # the service user, reachable by anyone who can make the app throw.
    FLASK_HOST: str = os.getenv("FLASK_HOST", "127.0.0.1")
    FLASK_PORT: int = int(os.getenv("FLASK_PORT", "5000"))
    FLASK_DEBUG: bool = os.getenv("FLASK_DEBUG", "false").lower() == "true"

    # The shared secret every caller must present as X-Service-Token.
    #
    # There is exactly one legitimate caller — the Next.js server — so a shared
    # secret is the right weight of mechanism. It is read here rather than at
    # request time so that a missing token is a startup failure (see
    # require_service_token in main.py) instead of a service that silently
    # accepts everyone.
    RAG_SERVICE_TOKEN: str = os.getenv("RAG_SERVICE_TOKEN", "")

    # Request limits. Without these one caller can send a 10 MB question or a
    # 500-turn history and hold the model indefinitely.
    MAX_MESSAGE_CHARS: int = int(os.getenv("MAX_MESSAGE_CHARS", "4000"))
    MAX_HISTORY_TURNS: int = int(os.getenv("MAX_HISTORY_TURNS", "10"))
    MAX_CONTENT_LENGTH: int = int(os.getenv("MAX_CONTENT_LENGTH_MB", "50")) * 1024 * 1024

    # RAG
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1500"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "200"))
    TOP_K_RESULTS: int = int(os.getenv("TOP_K_RESULTS", "6"))

    # ── The relevance floor ───────────────────────────────────────────────
    #
    # Retrieval used to return the top k regardless of score, so the corpus
    # ALWAYS had "an answer". Ask about land law — which is not held — and six
    # unrelated Companies Act chunks came back under a heading telling the model
    # "LEGAL CONTEXT FROM SRI LANKAN LEGISLATION". Measured on the golden set,
    # the service then answered questions about legislation it does not hold
    # 14 times out of 16.
    #
    # Two thresholds, not one, because they answer different questions:
    #
    #   RETRIEVAL_MIN_SCORE   "is there ANY good match?" — applied to the BEST
    #                         result. Below it, the whole search is treated as a
    #                         miss and nothing is returned, so the pipeline can
    #                         say it does not hold the material.
    #
    #   RETRIEVAL_CHUNK_FLOOR "is this chunk worth putting in the context?" —
    #                         applied per chunk, once the search has cleared the
    #                         gate above. A strong hit may legitimately carry
    #                         weaker supporting sections with it.
    #
    # Tuned against eval/questions.yaml, not guessed. At 0.62/0.50 on the 76
    # questions:
    #
    #        abstain  answerable answered   recall kept   not_in_corpus abstained
    #   0.00        (no floor)      100%           96%                        0%
    #   0.58                         91%           87%                       75%
    #   0.60                         91%           87%                       88%
    #   0.62  <-                     89%           85%                      100%
    #   0.64                         83%           80%                      100%
    #
    # 0.62 is chosen over 0.60 deliberately. It costs one more answerable
    # question (cpc-002, top score 0.608) and buys the last two not_in_corpus
    # cases. For a legal assistant, stating law it does not hold is a worse
    # failure than declining a question it could have answered: the first is
    # invisible to the reader, the second is obvious to them.
    #
    # Re-tune with `python -m scripts.eval --compare eval/results/baseline.json`
    # after any change to the embedding model, the chunker or the corpus. These
    # numbers are properties of THIS corpus and THIS embedding model.
    # ⚠️ RE-TUNED 2026-09-21, from 0.62, after the corpus was re-chunked.
    #
    # This number is a property of the SCORE DISTRIBUTION, not of relevance, and
    # the distribution has now moved twice under it. Longer chunks cover more
    # ground and therefore score higher against everything, so after re-chunking
    # the old 0.62 let three more out-of-corpus questions through. Measured on
    # the 101 single-turn questions, after the re-chunk:
    #
    #      floor    answerable   not_in_corpus
    #      0.58       63/75          4/12
    #      0.60       62/75          6/12
    #      0.62       59/75          7/12    <- the old setting
    #      0.64       55/75          9/12    <- chosen
    #      0.66       41/75          9/12
    #
    # 0.64 is the lowest value that recovers 9/12. The pre-re-chunk baseline was
    # 54/75 and 10/12, so this is +1 answerable and −1 not_in_corpus.
    #
    # That one lost abstention was accepted deliberately, because the re-chunk
    # corrected a citation the service was actually publishing: the punishment
    # for theft was cited as Penal Code s.368, and it is s.367. It also removed
    # 15.7% of chunks that were citeable and empty. **Stating the wrong section
    # is a worse failure than declining one more question**, which is the same
    # judgement that chose 0.62 over 0.60 in the first place.
    # ⚠️ LEFT AT 0.62 after the re-chunk, not raised to 0.64.
    #
    # 0.64 is the value that best restores `not_in_corpus` on the golden set
    # (9/12 against 7/12), and it was set to 0.64 for exactly that reason — then
    # reverted after driving the actual service, which is the only test that has
    # ever found anything on this project:
    #
    #   "How may a director be removed from office?"   -> "I do not hold
    #                                                      legislation covering that"
    #
    # That is co-005, the canonical Companies Act question, whose section the
    # corpus plainly holds; its best chunk scores 0.640 and sat on the knife
    # edge. Refusing it is a worse product than admitting one more out-of-corpus
    # question, and the sweep could not see the difference because both are one
    # tick in a column.
    RETRIEVAL_MIN_SCORE: float = float(os.getenv("RETRIEVAL_MIN_SCORE", "0.62"))

    # ── A margin gate: built, measured, and OFF because it does not separate ──
    #
    # The idea: an absolute threshold answers "is this similar enough?" but not
    # "is this about the question?". For a question the corpus answers, one chunk
    # should stand clear of the rest; for one it does not, everything should be
    # equally mediocre. Margin is also scale-free against a uniform shift in
    # scores, which is precisely what invalidated the floor twice.
    #
    # It does not work here, and the way it appeared to is worth recording.
    # Measured over a THIRTY-result pool it looked strong — 0.60 with a margin of
    # 0.04 gave 57/75 and 9/12, better than any absolute threshold. But the
    # service applies the floor to the SIX results it returns, and on that window
    # the two populations are not separable: mean margin 0.0818 for answerable
    # against 0.0656 for not_in_corpus. At every absolute level, raising the
    # margin only costs answerable questions and buys no abstentions:
    #
    #      floor  margin   answerable   not_in_corpus
    #      0.64    0.00      55/75          9/12
    #      0.64    0.03      53/75          9/12
    #      0.64    0.05      45/75          9/12
    #
    # The first measurement was of a code path the setting does not use. That is
    # the third time on this project that an instrument has been measured instead
    # of the system — see also the lexical gate, measured with apply_floor=False.
    #
    # Left switchable at 0 rather than deleted, so re-measuring costs nothing.
    RETRIEVAL_MIN_MARGIN: float = float(os.getenv("RETRIEVAL_MIN_MARGIN", "0"))
    RETRIEVAL_CHUNK_FLOOR: float = float(os.getenv("RETRIEVAL_CHUNK_FLOOR", "0.50"))

    # ── Hybrid retrieval: dense + BM25 keyword ────────────────────────────
    #
    # Embeddings match meaning and are weak at matching WORDS, and legal
    # questions are full of words that must match exactly. Three user reports in
    # one evening were the same failure — "company registration", "legal
    # actions", "resign from the company" each found nothing while the corpus
    # held the answer under different wording.
    #
    # **The thresholds above did NOT need re-tuning, and that is by design.**
    # BM25 only proposes CANDIDATES; every candidate is then scored by the same
    # dense metric and passed through the same floor. So RETRIEVAL_MIN_SCORE
    # still means what it always meant — a property of the embedding model and
    # the corpus, not of how a candidate was found. BM25 decides what is
    # findable; dense similarity still decides what is relevant.
    #
    # ── History: the first attempt did nothing, and why ──────────────────
    # Built 2026-09-20 and switched straight off. Measured over the golden set,
    # the numbers with it on and off were IDENTICAL at every threshold. The
    # reason was a design mistake worth stating so nobody rebuilds it: BM25
    # candidates were scored by DENSE similarity and then RANKED by dense
    # similarity, so a keyword hit could only win if dense already liked it —
    # and if dense already liked it, the chunk was in dense's own top
    # HYBRID_FETCH_K anyway. "BM25 proposes, dense disposes" sounded
    # principled and gave the lexical half no vote.
    #
    # ── ON since 2026-09-20, because now it is measured and it pays ───────
    # Two things changed together. Ranking is now Reciprocal Rank Fusion over
    # the two rankings, so a chunk BM25 puts first can rise even where dense
    # puts it 25th. And `_chunk_key` was fixed: it keyed on
    # (source_file, section_number, chunk_index), which 670 of 3,860 chunks
    # SHARE, so merging the two result sets was silently overwriting rows —
    # mt-002 lost Motor Traffic s.99 at 0.683 and reported 0.586 for a
    # different chunk wearing the same key.
    #
    # Measured on the gated path — the one the service actually takes — over
    # 101 single-turn questions including the lay-worded set added the same
    # day. Retrieval is deterministic here, so unlike scripts.eval there is no
    # noise floor to discount:
    #
    #                    dense only   hybrid + RRF
    #     answerable          50/75          53/75     co-001, co-013, prop-009
    #     not_in_corpus       10/12          10/12     unchanged
    #     must_refuse         13/14          13/14     unchanged
    #
    # Nothing regressed, and co-001 — "what is required to incorporate a
    # company", the flagship question of the weakest Act in the corpus — is
    # one of the three it fixes.
    ENABLE_HYBRID_SEARCH: bool = os.getenv("ENABLE_HYBRID_SEARCH", "true").lower() == "true"

    # How many candidates each half proposes before fusion and the floor. The
    # roadmap's shape is "retrieve 30, rerank, keep 6": this is the 30. Only
    # TOP_K_RESULTS survive into the model's context, so raising it costs
    # retrieval time, not tokens.
    HYBRID_FETCH_K: int = int(os.getenv("HYBRID_FETCH_K", "30"))

    # Reciprocal Rank Fusion: score = SUM over rankings of 1 / (k + rank).
    #
    # 60 is the value from the original RRF paper and the usual default. It is
    # a smoothing constant: small k makes the top rank dominate, large k
    # flattens the two rankings toward equal weight. It is not worth tuning
    # before reranking exists — the gain available here is much smaller than
    # the gain available from Stage 2.2.
    HYBRID_RRF_K: int = int(os.getenv("HYBRID_RRF_K", "60"))

    # ── The lexical path through the relevance gate — DEFAULT OFF ────────
    #
    # The roadmap asked for two changes together: rank by fusion (done, above)
    # and let a strong keyword match clear the gate at a lower dense score.
    # This is the second. It WORKS. It is off because of what it costs, not
    # because it fails.
    #
    # THE PROBLEM IT ADDRESSES. Several genuinely answerable questions fail
    # not because the right chunk is missing but because it lands just UNDER
    # 0.62 — the correct section is the top hit and the gate rejects it:
    #
    #     lay-008  "do you need insurance to drive a car"
    #                                    0.583, Motor Traffic s.99 — right
    #     lay-002  "can the shareholders sack a director"
    #                                    0.616, Companies Act s.206 — right
    #     prop-003 "within what time must an action for loss, injury or
    #               damage be brought"   0.614, Prescription s.9 — right
    #
    # MEASURED 2026-09-20 on the gated path, against hybrid+RRF with this off
    # (answerable 53/75, not_in_corpus 10/12, must_refuse 13/14):
    #
    #   rank<=3,  dense>=0.58    answerable 57/75  not_in_corpus  9/12  13/14
    #   rank<=10, dense>=0.56    answerable 61/75  not_in_corpus  7/12  13/14
    #   rank<=30, dense>=0.55    answerable 62/75  not_in_corpus  6/12  12/14
    #
    # It is a clean trade curve, and every rung of it is paid for in
    # not_in_corpus. At the tightest setting it buys four answerable questions
    # and loses nic-005 — "what is the personal income tax rate in Sri Lanka",
    # which the corpus cannot answer and would then answer anyway. At the
    # loosest it also breaks law-001, a touting refusal.
    #
    # WHY OFF. The standing judgement of this project, and the reason 0.62 was
    # chosen over 0.60 in the first place: stating law it does not hold is a
    # worse failure than declining a question it could have answered. The
    # first is invisible to the reader; the second is obvious to them. Nothing
    # about loading land law changes that, and a tax question answered out of
    # the Land (Restrictions on Alienation) Act is exactly the §4.10 failure.
    #
    # ⚠️ AND A WARNING ABOUT MEASURING IT. The first run of this reported "no
    # effect at any setting", because the probe called hybrid_search with
    # apply_floor=False — and the whole gate lives in the apply_floor branch.
    # It was measuring a code path the setting cannot reach. If you re-measure
    # this, drive the GATED path or you will conclude it is inert.
    #
    # The real fix for this class is a cross-encoder reranker (Stage 2.2),
    # which judges the query-chunk PAIR instead of asking one scalar threshold
    # to separate "the right section, oddly worded" from "a plausible section
    # about something else". Those populations overlap at 3,860 chunks.
    ENABLE_LEXICAL_GATE: bool = os.getenv("ENABLE_LEXICAL_GATE", "false").lower() == "true"

    # How strong a keyword match has to be to use that path: within the top N
    # of the BM25 ranking, and still above a reduced dense score. The reduced
    # score is NOT a free parameter — below about 0.58 the sweep shows
    # not_in_corpus collapsing whatever the lexical rule is.
    HYBRID_LEXICAL_RANK: int = int(os.getenv("HYBRID_LEXICAL_RANK", "3"))
    RETRIEVAL_LEXICAL_MIN_SCORE: float = float(
        os.getenv("RETRIEVAL_LEXICAL_MIN_SCORE", "0.58")
    )

    # Where the source PDFs live, and therefore the only route by which this
    # corpus can be rebuilt from scratch.
    #
    # This defaulted to `<repo>/Acts`, a directory that is NOT in the repository
    # and does not exist on any checkout — so `python -m scripts.ingest_all`,
    # the command docs/RUNNING.md gives for first-time setup, could not run. It
    # failed safely (the script returns before it clears anything) and silently,
    # and the consequence was that `data/vectordb` was the only artifact of the
    # corpus in existence: rebuildable from nothing, restorable only from git.
    #
    # Now `data/acts/`, which is tracked, so the corpus has a source again.
    ACTS_SOURCE_DIR: str = os.getenv("ACTS_SOURCE_DIR", str(BASE_DIR / "data" / "acts"))

    # LLM Parameters
    LLM_TEMPERATURE: float = 0.1  # Low temperature for factual legal responses
    LLM_TOP_P: float = 0.9

    # Context window.
    #
    # This was 8192, and the pipeline does not fit in 8192. One vector_search
    # returns TOP_K_RESULTS x CHUNK_SIZE = 6 x 1500 = ~9,000 characters, about
    # 2,300 tokens — and a ReAct agent re-sends the entire message list on every
    # step, so after three tool calls the conversation carries three full tool
    # results. Adding the agent system prompt, chat history and reasoning turns
    # put a typical question at ~9,400-10,300 tokens before the answer was even
    # generated.
    #
    # Ollama does not raise on overflow; it silently truncates. Nobody chooses
    # what survives, and what may be dropped includes the system prompt carrying
    # "you never advise a person about their own case" and the citation rules.
    # A safety instruction that disappears without a log line is not a control.
    LLM_NUM_CTX: int = int(os.getenv("LLM_NUM_CTX", "32768"))

    # Maximum tokens in a single generation. There was no cap at all, so a model
    # that started repeating itself ran until the caller's 60s timeout, having
    # consumed the whole window on the way. A legal answer with citations does
    # not need more than this; running past it means something has gone wrong.
    LLM_NUM_PREDICT: int = int(os.getenv("LLM_NUM_PREDICT", "1536"))

    # Graph RAG
    ENABLE_GRAPH_RAG: bool = os.getenv("ENABLE_GRAPH_RAG", "true").lower() == "true"
    GRAPH_PERSIST_PATH: str = os.getenv("GRAPH_PERSIST_PATH", str(GRAPH_DIR / "knowledge_graph.json"))
    GRAPH_TRAVERSAL_DEPTH: int = int(os.getenv("GRAPH_TRAVERSAL_DEPTH", "2"))
    GRAPH_EXPANSION_K: int = int(os.getenv("GRAPH_EXPANSION_K", "3"))

    # Agentic RAG (LangGraph ReAct Orchestrator)
    # Set ENABLE_AGENTIC_RAG=false to fall back to the linear pipeline
    ENABLE_AGENTIC_RAG: bool = os.getenv("ENABLE_AGENTIC_RAG", "true").lower() == "true"
    # Max LangGraph recursion steps — prevents infinite tool-call loops.
    # Each tool call + LLM response counts as 2 steps, plus the final answer.
    # Was 10 (~4 tool calls). gemini-3.8-flash routinely makes 4 (search,
    # section lookup, search, search) and then hit the limit on 2 of 7 real
    # questions (2026-10-19). 16 allows ~7 tool calls. Running out is handled:
    # legal_agent raises AgentStepLimitReached and query_rag falls back to the
    # linear pipeline, so the limit is a cost cap, not a failure mode.
    AGENT_MAX_ITERATIONS: int = int(os.getenv("AGENT_MAX_ITERATIONS", "16"))

    # Upload directory for admin-uploaded documents
    UPLOADS_DIR: str = os.getenv("UPLOADS_DIR", str(UPLOADS_DIR))

    # Chat Log Directory
    CHAT_LOG_DIR: str = os.getenv("CHAT_LOG_DIR", str(CHAT_LOG_DIR))

    # Tracing. Resolved at module import above, where the environment the
    # libraries actually read is set. Exposed here so /api/health can report it.
    TRACING_ENABLED: bool = _TRACING_ENABLED
    LANGCHAIN_PROJECT: str = os.getenv("LANGCHAIN_PROJECT", "lawyer-rag")

    # Legal Document Categories
    DOCUMENT_CATEGORIES = [
        "Sri Lanka Law Reports",
        "Acts & Ordinances",
        "Amendment Acts",
        "Gazette Notifications",
        "Supreme Court Decisions",
        "Court of Appeal Decisions",
    ]


config = Config()


# ---------------------------------------------------------------------------
# Fail fast on a provider this service cannot build
# ---------------------------------------------------------------------------
# gunicorn.conf.py imports this module in the master process before it binds, so
# raising here is a clean startup failure with a readable message — the same
# mechanism that makes a missing RAG_SERVICE_TOKEN refuse to start rather than
# crash-loop workers behind an open port.
#
# Without this, LLM_PROVIDER=anthropi (one typo) is a service that starts,
# reports healthy, accepts the question, and only then fails — by which time the
# person's question has already been sent to the process that cannot answer it.
_VALID_LLM_PROVIDERS = ("ollama", "google")

if not config.LLM_MODEL:
    raise RuntimeError(
        "LLM_MODEL is not set. Which model answers a legal question is not a "
        "thing this service will guess at, so there is no default — set it in "
        "lawyer-rag/.env. See .env.example."
    )

if config.LLM_PROVIDER not in _VALID_LLM_PROVIDERS:
    raise RuntimeError(
        f"LLM_PROVIDER={config.LLM_PROVIDER!r} is not a provider this service "
        f"knows. Valid values: {', '.join(_VALID_LLM_PROVIDERS)}. Set it in "
        "lawyer-rag/.env."
    )

if config.LLM_PROVIDER == "google" and not config.GOOGLE_API_KEY:
    raise RuntimeError(
        "LLM_PROVIDER=google but GOOGLE_API_KEY is not set in lawyer-rag/.env. "
        "It is a Generative Language API key, not the OAuth or Maps credential. "
        "If you meant to run locally, set LLM_PROVIDER=ollama."
    )
