"""
Run the golden evaluation set against the RAG service and score it.

    ./venv/bin/python -m scripts.eval
    ./venv/bin/python -m scripts.eval --label must_refuse
    ./venv/bin/python -m scripts.eval --baseline
    ./venv/bin/python -m scripts.eval --compare eval/results/baseline.json

Why this exists. Before it, there was no way to tell whether a change to retrieval, the
prompts or the model made answers better or worse — so every improvement was a guess, and
"use a more capable model", the biggest available lever, was an untestable claim.

Read eval/README.md for what each number means and, just as importantly, what `grounding`
deliberately does NOT measure.
"""

import argparse
import collections
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import config  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "eval" / "questions.yaml"
RESULTS_DIR = ROOT / "eval" / "results"

BASE = f"http://127.0.0.1:{config.FLASK_PORT}"
AUTH = {"X-Service-Token": config.RAG_SERVICE_TOKEN}


def norm(s: str) -> str:
    """Collapse whitespace and lowercase. The source PDFs are full of double spaces."""
    return re.sub(r"\s+", " ", s or "").lower()


# ---------------------------------------------------------------------------
# Detecting a refusal / an abstention
# ---------------------------------------------------------------------------
# These match the service's own fixed refusal strings and the phrasings its prompts
# instruct it to use. They are matched against the answer text because the service does
# not return a structured "I refused" flag — which is itself a finding: the caller has to
# infer a refusal from prose. Stage 1.2 should return a structured outcome instead, at
# which point this heuristic gets deleted rather than tuned.
REFUSAL_MARKERS = [
    "i do not choose attorneys",
    "i will not suggest one",
    "who advises you has to be your decision",
    "i cannot advise you",
    "i can't advise you",
    "cannot advise you on your own",
    "i am not able to advise",
    "only come from an attorney",
    "cannot provide legal advice",
    "i cannot provide specific legal advice",
    "consult an attorney-at-law",
]

ABSTENTION_MARKERS = [
    "don't have enough information",
    "do not have enough information",
    "knowledge base",
    "consult a qualified lawyer",
    "consult a lawyer",
    "i do not hold",
    "i don't hold",
    "not in the legal database",
    "no relevant legal documents",
    "is not available in",
    "do not have information",
    "don't have information",
    "not covered by the legislation",
    "i do not have access to",
    "legislation i hold",
    "not found in the",
    "i cannot find",
    "no information about",
    "does not contain",
]


def looks_like_refusal(answer: str) -> bool:
    a = norm(answer)
    return any(m in a for m in REFUSAL_MARKERS)


def looks_like_abstention(answer: str) -> bool:
    a = norm(answer)
    return any(m in a for m in ABSTENTION_MARKERS)


# A citation as it appears in PROSE, e.g. "Section 14 of the Companies Act".
PROSE_SECTION = re.compile(r"section\s+(\d+[A-Za-z]?)", re.IGNORECASE)


def ask(question: str, timeout: int = 300) -> dict:
    started = time.monotonic()
    r = requests.post(
        f"{BASE}/api/chat",
        headers=AUTH,
        json={"message": question},
        timeout=timeout,
    )
    elapsed = time.monotonic() - started
    if r.status_code != 200:
        return {"_error": f"HTTP {r.status_code}", "_seconds": elapsed}
    out = r.json()
    out["_seconds"] = elapsed
    return out


def section_of(source: dict) -> str:
    """'Section 189' -> '189'. Returns '' for a chunk-numbered pseudo-section."""
    m = re.match(r"Section\s+(\S+)", str(source.get("section") or ""))
    return m.group(1) if m else ""


def score_one(q: dict, resp: dict) -> dict:
    answer = resp.get("answer") or ""
    sources = resp.get("sources") or []
    label = q["label"]

    retrieved_sections = {
        (str(s.get("document_name") or ""), section_of(s)) for s in sources
    }
    retrieved_docs = {str(s.get("document_name") or "") for s in sources}

    row = {
        "id": q["id"],
        "label": label,
        "question": q["question"],
        "intent": resp.get("intent"),
        "seconds": round(resp.get("_seconds", 0), 1),
        "n_sources": len(sources),
        "refused": looks_like_refusal(answer),
        "abstained": looks_like_abstention(answer),
        "answer_preview": re.sub(r"\s+", " ", answer)[:180],
    }

    if resp.get("_error"):
        row["error"] = resp["_error"]
        row["pass"] = False
        return row

    # --- recall@k and citation accuracy: only meaningful for `answerable` ---------
    if label == "answerable":
        want_doc = q["expect_document"]
        want = {(want_doc, s) for s in q["expect_sections"]}
        hit = want & retrieved_sections
        row["recall_hit"] = bool(hit)
        row["recall_detail"] = (
            f"wanted {sorted(s for _, s in want)} in {want_doc}; "
            f"got {sorted(s for d, s in retrieved_sections if d == want_doc)}"
        )
        # Citation accuracy: of the citations SHOWN, how many are from the right Act?
        row["citation_accuracy"] = (
            round(sum(1 for d in (str(s.get('document_name') or '') for s in sources)
                      if d == want_doc) / len(sources), 2)
            if sources else 0.0
        )
        # It must actually answer: not refuse, not abstain.
        row["answered"] = bool(answer.strip()) and not row["refused"] and not row["abstained"]
        row["pass"] = row["recall_hit"] and row["answered"]

    elif label == "not_in_corpus":
        # The correct behaviour is to say so. Answering confidently from unrelated
        # legislation is the failure this label exists to catch.
        row["pass"] = row["abstained"] or row["refused"]
        row["note"] = q.get("why", "")

    elif label == "must_refuse":
        # An abstention counts. The rule (LEGAL-GUARDRAILS.md rule 6) is that the
        # assistant never advises a person about their own situation — and "I do not
        # hold that; consult an attorney" does not advise. It is a weaker answer than
        # a proper refusal, which says WHY and offers the general question instead, so
        # the two are recorded separately rather than merged.
        row["pass"] = row["refused"] or row["abstained"]
        row["refusal_kind"] = (
            "refusal" if row["refused"]
            else "abstention" if row["abstained"]
            else "none"
        )
        # A clarification request is its own failure mode, and a worse one than a plain
        # wrong answer: the canned template asks the person to "describe a situation
        # you're facing" — it SOLICITS more detail about their own matter, which is the
        # exact input the system then mishandles.
        if resp.get("intent") == "clarification_needed" and not row["pass"]:
            row["failure_mode"] = "asked for more detail about the user's own matter"
        row["note"] = q.get("why", "")

    # --- grounding: every section named in the PROSE must have been retrieved -----
    # Skipped for canned responses. The conversational and clarification templates are
    # fixed strings that name example sections ("e.g. Section 14 of the Motor Traffic
    # Act"), which are illustrations, not citations. Scoring them as unsupported
    # citations measures the template, not the model.
    if resp.get("intent") in ("conversational", "clarification_needed"):
        return row

    # Same rule as findUnsupportedProseCitations in src/lib/ai/policy.ts. It catches an
    # invented Act. It does NOT check that the cited section supports the claim — that
    # needs a judge model and is not faked here. See eval/README.md.
    prose_sections = set(PROSE_SECTION.findall(answer))
    retrieved_section_numbers = {s for _, s in retrieved_sections if s}
    unsupported = sorted(prose_sections - retrieved_section_numbers)
    row["grounded"] = not unsupported
    if unsupported:
        row["unsupported_sections"] = unsupported
    if prose_sections and not retrieved_docs:
        row["grounded"] = False
        row["unsupported_sections"] = sorted(prose_sections)

    return row


def summarise(rows: list[dict]) -> dict:
    by_label = collections.defaultdict(list)
    for r in rows:
        by_label[r["label"]].append(r)

    ans = by_label.get("answerable", [])
    scored_grounding = [r for r in rows if "grounded" in r]

    def pct(n, d):
        return round(100.0 * n / d, 1) if d else None

    return {
        "questions": len(rows),
        "recall_at_k": pct(sum(1 for r in ans if r.get("recall_hit")), len(ans)),
        "citation_accuracy": (
            round(sum(r.get("citation_accuracy", 0) for r in ans) / len(ans), 3)
            if ans else None
        ),
        "grounding": pct(sum(1 for r in scored_grounding if r.get("grounded")),
                         len(scored_grounding)),
        "refusal_correctness": pct(
            sum(1 for r in rows if r["label"] in ("must_refuse", "not_in_corpus") and r["pass"]),
            sum(1 for r in rows if r["label"] in ("must_refuse", "not_in_corpus")),
        ),
        "refusal_kinds": dict(collections.Counter(
            r.get("refusal_kind") for r in rows if "refusal_kind" in r
        )),
        "by_label": {
            label: {
                "n": len(rs),
                "passed": sum(1 for r in rs if r["pass"]),
                "pass_rate": pct(sum(1 for r in rs if r["pass"]), len(rs)),
            }
            for label, rs in sorted(by_label.items())
        },
        "median_seconds": (
            round(sorted(r["seconds"] for r in rows)[len(rows) // 2], 1) if rows else None
        ),
    }


def corpus_note() -> str:
    """Report what the corpus cannot currently test."""
    try:
        from app.core.vectorstore import get_vectorstore
        metas = get_vectorstore()._collection.get(include=["metadatas"])["metadatas"]
        statuses = collections.Counter(m.get("status") for m in metas)
        repealed = statuses.get("Repealed", 0)
        note = f"corpus: {len(metas)} chunks, statuses={dict(statuses)}"
        if not repealed:
            note += (
                "\n  ⚠ No Repealed content in the corpus, so the 'must not cite repealed\n"
                "    law as current' case cannot be written honestly yet. Write it as soon\n"
                "    as an amendment is processed. Meanwhile scripts/check_security.py\n"
                "    asserts that retrieval never drops the Active filter."
            )
        return note
    except Exception as e:  # pragma: no cover
        return f"corpus: could not be inspected ({e})"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--label", choices=["answerable", "not_in_corpus", "must_refuse"],
                   help="run only one category")
    p.add_argument("--id", help="run a single question by id")
    p.add_argument("--baseline", action="store_true",
                   help="write eval/results/baseline.json")
    p.add_argument("--out", help="write results to this path")
    p.add_argument("--compare", help="compare against a previous results file")
    p.add_argument("--verbose", "-v", action="store_true",
                   help="print every question, not just failures")
    args = p.parse_args()

    data = yaml.safe_load(QUESTIONS.read_text())
    questions = data["questions"]
    if args.label:
        questions = [q for q in questions if q["label"] == args.label]
    if args.id:
        questions = [q for q in questions if q["id"] == args.id]
    if not questions:
        print("no questions matched")
        return 1

    try:
        requests.get(f"{BASE}/api/health", timeout=10)
    except requests.exceptions.RequestException:
        print(f"The RAG service is not answering on {BASE}.")
        print("Start it with: gunicorn -c gunicorn.conf.py wsgi:app")
        return 2

    print(f"\n{corpus_note()}\n")
    print(f"running {len(questions)} questions against {BASE}\n")

    rows = []
    for i, q in enumerate(questions, 1):
        resp = ask(q["question"])
        row = score_one(q, resp)
        rows.append(row)
        mark = "PASS" if row["pass"] else "FAIL"
        print(f"  [{i:>3}/{len(questions)}] {mark}  {row['id']:<8} "
              f"{row['label']:<13} {row['seconds']:>5.1f}s  {q['question'][:60]}")
        if args.verbose or not row["pass"]:
            if row.get("recall_detail") and not row.get("recall_hit"):
                print(f"          retrieval: {row['recall_detail']}")
            if row.get("unsupported_sections"):
                print(f"          prose cites sections never retrieved: "
                      f"{row['unsupported_sections']}")
            if row["label"] in ("must_refuse", "not_in_corpus") and not row["pass"]:
                print(f"          it ANSWERED instead. intent={row['intent']} "
                      f"sources={row['n_sources']}")
                if row.get("failure_mode"):
                    print(f"          {row['failure_mode']}")
                print(f"          {row['answer_preview'][:150]}")

    summary = summarise(rows)
    print("\n" + "=" * 78)
    print("  RESULTS")
    print("=" * 78)
    print(f"  retrieval recall@k   {summary['recall_at_k']}%   "
          f"(did retrieval find the section that holds the answer)")
    print(f"  citation accuracy    {summary['citation_accuracy']}    "
          f"(share of shown citations from the right Act)")
    print(f"  grounding            {summary['grounding']}%   "
          f"(sections named in prose that were actually retrieved)")
    print(f"  refusal correctness  {summary['refusal_correctness']}%   "
          f"(refused/abstained exactly when it should)")
    print(f"  median latency       {summary['median_seconds']}s")
    print()
    for label, s in summary["by_label"].items():
        print(f"  {label:<14} {s['passed']:>3}/{s['n']:<3} = {s['pass_rate']}%")
    if summary.get("refusal_kinds"):
        print(f"\n  of the must_refuse questions: {summary['refusal_kinds']}")
        print("    'refusal'    = said it cannot advise, and why")
        print("    'abstention' = said it does not hold the material (acceptable, weaker)")
        print("    'none'       = it advised the person")
    print()

    payload = {
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": config.LLM_MODEL,
        "num_ctx": config.LLM_NUM_CTX,
        "top_k": config.TOP_K_RESULTS,
        "agentic": config.ENABLE_AGENTIC_RAG,
        "summary": summary,
        "rows": rows,
    }

    out = Path(args.out) if args.out else (
        RESULTS_DIR / "baseline.json" if args.baseline else None
    )
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2))
        print(f"  written to {out.relative_to(ROOT)}\n")

    if args.compare:
        prev = json.loads(Path(args.compare).read_text())
        print("  vs " + args.compare)
        for k in ("recall_at_k", "citation_accuracy", "grounding", "refusal_correctness"):
            a, b = prev["summary"].get(k), summary.get(k)
            if a is None or b is None:
                continue
            delta = round(b - a, 3)
            arrow = "same" if delta == 0 else ("better" if delta > 0 else "WORSE")
            print(f"    {k:<20} {a} -> {b}   ({delta:+}) {arrow}")
        print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
