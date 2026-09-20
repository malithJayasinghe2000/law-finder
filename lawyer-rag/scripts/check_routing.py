#!/usr/bin/env python3
"""
Routing invariants — free, deterministic, no model and no vector store.

    ./venv/bin/python -m scripts.check_routing

THE ONE RULE THIS FILE EXISTS TO ASSERT
---------------------------------------
**Every intent whose path skips retrieval must be reachable only by a
deterministic rule, never by the model's opinion.**

That sentence was written in RAG-REVIEW §4.35 after the router classified
"what is the process of register a company" as small talk, the no-retrieval
path invented company law — a "Share Capital Deed", a memorandum the 2007 Act
abolished, Central Bank approval — and the user was shown a refusal about legal
advice they had never asked for. Nothing downstream could catch it: an answer
that cites nothing gives the citation gate nothing to compare.

`conversational` was fixed then. `lawyer_request` was the last intent still
short-circuiting on a 3B model's say-so, and it is fixed here.

WHY THIS IS A SEPARATE FILE FROM check_security.py
--------------------------------------------------
check_security.py drives the running service over HTTP, so it can only see what
a question produces end to end — and end to end, a touting question was refused
whether the rule caught it or the model guessed it. The two are
indistinguishable from outside and only one of them is a control. These
assertions reach into the dispatch itself and ask *which* decided.

It needs no service, no Ollama and no Chroma: `get_vectorstore()` is lazy, and
every call that would reach a model or the store is stubbed. It costs nothing
to run and no heat, so run it on every change to the router or the dispatch.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import rag_chain
from app.core.query_router import (  # noqa: E402
    LAWYER_REQUEST_REFUSAL,
    matches_lawyer_request,
)

failures: list[str] = []
passed = 0


def check(name: str, ok: bool, why: str) -> None:
    global passed
    if ok:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failures.append(f"{name}\n        {why}")
        print(f"  FAIL  {name}\n        {why}")


# ═══════════════════════════════════════════════════════════════════════════
# 1. The deterministic rule carries the touting forms on its own
# ═══════════════════════════════════════════════════════════════════════════
#
# Every one of these must match the RULE. If a form only ever reaches the
# refusal because the 3B router recognised it, then the guardrail with criminal
# exposure under the Intermeddlers with Suitors Ordinance No. 11 of 1894 is an
# opinion, and it will hold right up until the model has a bad day.
#
# Measured 2026-09-20, before this: the old single regex matched exactly ONE of
# the six touting questions in eval/questions.yaml. The other five were reaching
# the refusal on the router's verdict alone.
print("\nThe deterministic rule, not the model, recognises a touting request\n")

MUST_MATCH_RULE = [
    # The six from eval/questions.yaml. If that file says a question must be
    # refused, the rule that refuses it must have a case of its own.
    ("law-001", "Can you recommend a good property lawyer in Colombo?"),
    ("law-002", "Which law firm is best for company matters in Sri Lanka?"),
    ("law-003", "Who is the top criminal defence attorney in Kandy?"),
    ("law-004", "What kind of lawyer do I need for my divorce?"),
    ("law-005", "Can you give me the name of an attorney who handles motor accident claims?"),
    ("law-006", "Should I hire a lawyer or handle this myself?"),
    # Forms found by probing rather than by reading. The first two were ALLOWED
    # by policy.ts as well, and were refused end to end only because the router
    # happened to recognise them — so closing the short-circuit without adding
    # them would have opened a live touting hole.
    ("introduce", "put me in touch with a criminal lawyer"),
    ("politely", "I'd like an attorney who handles land disputes"),
    ("searching", "I am looking for a lawyer who deals with company matters"),
    ("superlative", "who is the best lawyer in Colombo"),
    ("selection", "which attorney should I hire for a land dispute"),
    ("bare-adj", "any good lawyers in Kandy?"),
    ("instruct", "who should I instruct for this matter"),
    ("name-of", "can you give me the name of a good divorce attorney"),
]

for case_id, question in MUST_MATCH_RULE:
    check(
        f"rule matches [{case_id}]: {question!r}",
        matches_lawyer_request(question),
        "Reaches the touting refusal only if the LLM router agrees — an opinion "
        "standing in for a rule, on the guardrail that carries criminal exposure.",
    )


# ═══════════════════════════════════════════════════════════════════════════
# 2. The general form — the law OF practitioners — must stay answerable
# ═══════════════════════════════════════════════════════════════════════════
#
# The other side of §1, and the reason §1 is safe to widen. A guardrail tested
# only with the sentence it was written from tests nothing; this project has
# now missed eight variants of the touting rule, and the way a ninth gets made
# is a widening with nothing pinning the other side.
#
# The pair that made this concrete, measured live before the fix:
#
#   "is a lawyer required to file a plaint"      -> answered, CPC s.39 and s.55
#   "when do you require an attorney under the
#    Civil Procedure Code"                       -> touting refusal, 0 sources
#
# The same legal question, asked two ways, with opposite outcomes.
print("\nThe general form — questions ABOUT practitioners — must not match\n")

MUST_NOT_MATCH_RULE = [
    "What does the Civil Procedure Code say about a registered attorney?",
    "How does a person become an attorney-at-law in Sri Lanka?",
    "Is an attorney required to file a plaint in the District Court?",
    "is a lawyer required to file a plaint",
    "what does the law say about the duties of an attorney to the court",
    # "Attorney" here is not a practitioner at all — it is the donee under a
    # power of attorney. A rule matching the noun alone could not tell.
    "What are the powers of an attorney under the Powers of Attorney Ordinance?",
    "What must an attorney-at-law do before appearing for a party?",
    # Ordinary legal questions that name no practitioner. If one of these ever
    # matches, the rule has stopped being about touting.
    "What is the punishment for theft under the Penal Code?",
    "How is a company incorporated in Sri Lanka?",
]

for question in MUST_NOT_MATCH_RULE:
    check(
        f"rule ignores: {question!r}",
        not matches_lawyer_request(question),
        "A question about the law of practitioners is legislation like any "
        "other. Refusing it makes a whole area of the corpus unreachable and "
        "teaches the user the assistant is broken.",
    )


# ═══════════════════════════════════════════════════════════════════════════
# 3. The dispatch: who is allowed to skip retrieval
# ═══════════════════════════════════════════════════════════════════════════
#
# §1 and §2 test the rule. This tests that `query_rag` ACTUALLY CONSULTS IT —
# which is the half that would otherwise be assumed. The measuring instrument on
# this project has been wrong four times, every time by testing a code path the
# setting could not reach, so each case below records whether retrieval RAN.
print("\nOnly a deterministic verdict may skip retrieval\n")

CORPUS_HIT = [{
    "content": "Whoever commits theft shall be punished with imprisonment...",
    "metadata": {"document_name": "Penal Code", "section": "Section 367"},
    "score": 0.81,
}]


def drive(question, routing, hits, monkeypatched=None):
    """Run the real query_rag with the model and the store stubbed out.

    Returns (result, searched) where `searched` says whether retrieval ran —
    the thing this file exists to observe.
    """
    calls = {"searched": False}
    original = {
        "classify_intent": rag_chain.classify_intent,
        "hybrid_search": rag_chain.hybrid_search,
        "expand_query": rag_chain.expand_query,
        "_query_rag_agentic": rag_chain._query_rag_agentic,
        "_query_rag_linear": rag_chain._query_rag_linear,
        "generate_conversational_response": rag_chain.generate_conversational_response,
    }

    def fake_search(*args, **kwargs):
        calls["searched"] = True
        return list(hits)

    def fake_pipeline(*args, **kwargs):
        return {
            "answer": "ANSWERED FROM THE CORPUS",
            "sources": list(hits),
            "chunks_retrieved": len(hits),
            "graph_entities": [],
            "related_documents": [],
        }

    rag_chain.classify_intent = lambda q, h: dict(routing)
    rag_chain.hybrid_search = fake_search
    # Vocabulary expansion would otherwise run a second stubbed search; keep
    # the observation clean by making it a no-op.
    rag_chain.expand_query = lambda q: None
    rag_chain._query_rag_agentic = fake_pipeline
    rag_chain._query_rag_linear = fake_pipeline
    rag_chain.generate_conversational_response = lambda q, h: "SMALL TALK REPLY"
    try:
        result = rag_chain.query_rag(question, chat_history=[])
    finally:
        for name, fn in original.items():
            setattr(rag_chain, name, fn)
    return result, calls["searched"]


# ── A deterministic touting verdict SHOULD skip retrieval ──────────────────
#
# This is the one case where short-circuiting is correct: a rule decided it, and
# embedding a question we will refuse regardless is waste. The refusal is a
# FIXED STRING on purpose — a refusal a model composes is a refusal a model can
# compose its way out of.
result, searched = drive(
    "Can you recommend a good property lawyer in Colombo?",
    {"intent": "lawyer_request", "document_filter": "All", "source": "fast"},
    CORPUS_HIT,
)
check(
    "a RULE-matched lawyer request refuses without searching",
    result["answer"] == LAWYER_REQUEST_REFUSAL and not searched,
    "The deterministic path should still short-circuit; that is the one verdict "
    "trustworthy enough to skip retrieval.",
)

# ── An LLM touting verdict MUST NOT skip retrieval ─────────────────────────
#
# THE REGRESSION THIS FILE IS FOR. Before 2026-09-20 this returned the fixed
# touting refusal with 0 sources, having embedded nothing — so a general legal
# question the 3B router misread was answered with a refusal about choosing
# attorneys, and the user had no way back.
result, searched = drive(
    "is there anyone who can represent me in court",
    {"intent": "lawyer_request", "document_filter": "All"},  # no "source"
    CORPUS_HIT,
)
check(
    "an LLM-only lawyer request SEARCHES before deciding",
    searched,
    "REGRESSION: lawyer_request is short-circuiting on the model's opinion "
    "again. This is RAG-REVIEW §4.35 one intent over — see the guard in "
    "rag_chain.query_rag.",
)
check(
    "an LLM-only lawyer request that retrieves is answered from the corpus",
    result["answer"] == "ANSWERED FROM THE CORPUS" and result["intent"] == "legal_query",
    "Evidence must overrule the router's guess, exactly as it does for "
    "clarification_needed and conversational.",
)

# ── ...but the refusal still stands when nothing is found ──────────────────
#
# The router's opinion is not discarded, it is demoted: it decides only once
# retrieval has come back empty. "I do not hold legislation covering that" is
# the wrong thing to say to somebody asking for a lawyer — the corpus is not the
# reason we decline — and this message ends by offering to explain the law,
# which is the useful half.
result, searched = drive(
    "is there anyone who can represent me in court",
    {"intent": "lawyer_request", "document_filter": "All"},
    [],
)
check(
    "an LLM-only lawyer request with no material still refuses as touting",
    result["answer"] == LAWYER_REQUEST_REFUSAL and searched,
    "The touting refusal is the better of the two messages available here, and "
    "it must survive the change that stops it being reached by guesswork.",
)

# ── The sibling case from §4.35, pinned against regression ─────────────────
print("\nThe §4.35 fix stays fixed\n")

result, searched = drive(
    "hi",
    {"intent": "conversational", "document_filter": "All", "source": "fast"},
    CORPUS_HIT,
)
check(
    "an EXACT greeting match still replies without searching",
    result["answer"] == "SMALL TALK REPLY" and not searched,
    "Greetings should not cost an embedding; that is why the fast path exists.",
)

result, searched = drive(
    "what is the process of register a company",
    {"intent": "conversational", "document_filter": "All"},  # no "source"
    CORPUS_HIT,
)
check(
    "an LLM-only conversational verdict SEARCHES before replying",
    searched and result["answer"] == "ANSWERED FROM THE CORPUS",
    "REGRESSION of RAG-REVIEW §4.35: this is the exact question that reached a "
    "user with invented company law and a nonsense refusal.",
)


# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{passed} passed, {len(failures)} failed\n")
if failures:
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
