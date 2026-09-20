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


def is_substantive(answer: str, resp: dict | None) -> bool:
    """
    Did the answer actually deliver legal content from the corpus?

    True when retrieval returned sources AND the prose names at least one
    section that was genuinely among them. That is a deliberately high bar: it
    means the answer made a specific, checkable legal claim traceable to the
    material the system holds. Nothing that does that is an abstention,
    whatever sentence it happens to end on.
    """
    if not resp:
        return False
    sources = resp.get("sources") or []
    if not sources:
        return False
    retrieved = {section_of(s) for s in sources} - {""}
    return bool(set(PROSE_SECTION.findall(answer or "")) & retrieved)


def looks_like_abstention(answer: str, resp: dict | None = None) -> bool:
    """
    Did it decline to answer for want of material?

    Prefers the STRUCTURED signal. Since the relevance floor landed, the service
    returns `no_context: true` when nothing cleared it, which is a fact rather
    than an inference. The phrase markers are kept as a secondary check because
    the model can still abstain in its own words from inside the agent loop,
    where no flag is set.

    ── Why the substantive-answer escape hatch exists ─────────────────────────
    A marker phrase is evidence, not proof, and one of them was producing false
    failures on correct answers. Measured on co-013 ("How may a company alter
    its articles of association?"), one run in four returns a complete, six-
    source, correctly-cited answer that closes with "It is recommended that you
    consult a qualified lawyer for specific advice" — a sentence every answer
    here arguably SHOULD carry. The old rule read that closing as an abstention
    and scored the question failed.

    That is not a cosmetic scoring nit. It biases a model comparison in exactly
    the wrong direction: a more capable, more safety-tuned model is MORE likely
    to append a disclaimer, so it would be penalised for behaving better — and
    Stage 1.6 exists to compare models. An instrument that rewards the answer
    you do not want is worse than no instrument.

    So: the structured flag is authoritative, and a phrase marker counts only
    when the answer did not also deliver grounded legal content. A 900-character
    answer citing six retrieved sections did not decline to answer.
    """
    if resp is not None and (
        resp.get("no_context") is True or resp.get("declined_advice") is True
    ):
        return True
    a = norm(answer)
    if not any(m in a for m in ABSTENTION_MARKERS):
        return False
    return not is_substantive(answer, resp)


# A citation as it appears in PROSE, e.g. "Section 14 of the Companies Act".
PROSE_SECTION = re.compile(r"section\s+(\d+[A-Za-z]?)", re.IGNORECASE)


def ask(question: str, history: list | None = None, timeout: int = 300) -> dict:
    started = time.monotonic()
    r = requests.post(
        f"{BASE}/api/chat",
        headers=AUTH,
        json={"message": question, "conversation_history": history or []},
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
        "abstained": looks_like_abstention(answer, resp),
        "no_context_flag": bool(resp.get("no_context")),
        "declined_advice_flag": bool(resp.get("declined_advice")),
        "substantive": is_substantive(answer, resp),
        "answer_preview": re.sub(r"\s+", " ", answer)[:180],
        # The FULL answer, not just the preview. Two reasons, both learned the
        # hard way this stage. First, a scoring rule that turns out to be wrong
        # can then be re-applied to results already on disk instead of costing
        # another 40-minute run — which is what the abstention-marker defect
        # above would otherwise have cost. Second, a 180-character preview hides
        # the end of the answer, and the end of the answer is exactly where the
        # disclaimers that confused the scorer live. These are 83 authored test
        # questions and their answers; no real person's data is stored here.
        "answer": answer,
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
    p.add_argument("--follow-ups", action="store_true",
                   help="run only the multi-turn questions")
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
    if args.follow_ups:
        questions = [q for q in questions if q.get("follow_up_to")]
    if args.id:
        questions = [q for q in questions if q["id"] == args.id]
    if not questions:
        print("no questions matched")
        return 1

    # ── Pre-flight: healthy, not merely answering ─────────────────────────
    #
    # This used to check only that /api/health responded at all. It does respond
    # when the model host is down — with "degraded" — and the run then went ahead
    # against a service that could not retrieve anything.
    #
    # Measured 2026-09-14: Ollama was stopped part-way through a run (a laptop
    # getting hot, not a crash), and because embeddings come from Ollama too,
    # every remaining question returned "I do not hold that legislation". The
    # scorer read those as correct abstentions and reported REFUSAL CORRECTNESS
    # 100%, not_in_corpus 17/17, must_refuse 15/15 — the best refusal numbers
    # ever recorded by this harness, produced by a service that was answering
    # nothing at all. It wrote that to a results file as a measurement.
    #
    # An outage must never be able to look like a good result.
    try:
        health = requests.get(f"{BASE}/api/health", timeout=10).json()
    except requests.exceptions.RequestException:
        print(f"The RAG service is not answering on {BASE}.")
        print("Start it with: gunicorn -c gunicorn.conf.py wsgi:app")
        return 2

    if health.get("status") != "healthy":
        services = health.get("services", {})
        print(f"REFUSING TO RUN: /api/health reports {health.get('status')!r}.")
        for name, s in services.items():
            state = s.get("status") if isinstance(s, dict) else s
            print(f"    {name:<16} {state}")
        print("\n  A degraded service still answers every question — it just answers")
        print("  them all with 'I do not hold that legislation', which this harness")
        print("  would score as a perfect refusal rate. Fix the service, then run.")
        return 2

    print(f"\n{corpus_note()}\n")
    print(f"running {len(questions)} questions against {BASE}\n")

    # A follow-up question needs a real conversation in front of it. Rather than
    # canning an assistant reply, ask the parent question for real and use what
    # the service actually said — a fixture answer would test the scorer, not
    # the system.
    by_id = {q["id"]: q for q in data["questions"]}

    def history_for(q: dict) -> list:
        parent_id = q.get("follow_up_to")
        if not parent_id:
            return []
        parent = by_id.get(parent_id)
        if parent is None:
            raise SystemExit(f"{q['id']}: follow_up_to names a question that does not exist: {parent_id}")
        parent_resp = ask(parent["question"])
        return [
            {"role": "user", "content": parent["question"]},
            {"role": "assistant", "content": parent_resp.get("answer", "")},
        ]

    rows = []
    for i, q in enumerate(questions, 1):
        resp = ask(q["question"], history_for(q))

        # ── Abort on an infrastructure failure; never score through one ────
        #
        # The pre-flight above catches a service that is already down. This
        # catches the case that actually happened: healthy at the start, the
        # model host stopped part-way, and every remaining question answered
        # from a service that could no longer retrieve anything.
        #
        # A partial run is not a measurement, and the danger is that it does not
        # look like one — the numbers come out plausible, and for the refusal
        # categories they come out BETTER than a working service. So stop here
        # and write nothing, rather than leave a results file that a later
        # session would compare against in good faith.
        if resp.get("_error"):
            print(f"\n  ABORTED at question {i}/{len(questions)} ({q['id']}): "
                  f"{resp['_error']}")
            print("  The service failed mid-run. No results file has been written.")
            print("  A half-finished run scores an outage as a refusal and reads")
            print("  like a good one — check /api/health, then start again.")
            return 3

        row = score_one(q, resp)
        rows.append(row)
        mark = "PASS" if row["pass"] else "FAIL"
        turn = "↳ " if q.get("follow_up_to") else "  "
        print(f"  [{i:>3}/{len(questions)}] {mark}  {row['id']:<8} "
              f"{row['label']:<13} {row['seconds']:>5.1f}s {turn}{q['question'][:58]}")
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
        "provider": config.LLM_PROVIDER,
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
        out = out if out.is_absolute() else (Path.cwd() / out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2))
        # relative_to() raises for a path outside ROOT, and a relative --out is
        # resolved against the CWD, which need not be ROOT. Display only.
        try:
            shown = out.relative_to(ROOT)
        except ValueError:
            shown = out
        print(f"  written to {shown}\n")

    if args.compare:
        prev = json.loads(Path(args.compare).read_text())
        print(f"  vs {args.compare}  ({prev.get('model', '?')} -> {payload['model']})")
        for k in ("recall_at_k", "citation_accuracy", "grounding", "refusal_correctness"):
            a, b = prev["summary"].get(k), summary.get(k)
            if a is None or b is None:
                continue
            delta = round(b - a, 3)
            arrow = "same" if delta == 0 else ("better" if delta > 0 else "WORSE")
            print(f"    {k:<20} {a} -> {b}   ({delta:+}) {arrow}")

        # Latency is a quality measure here, not a footnote. The Next.js caller
        # gives up at RAG_TIMEOUT_MS (60s), so an answer that arrives at 70s is
        # not a slow answer, it is a failed one — and a median hides that
        # entirely. Report the tail and count what the real caller would lose.
        a_med, b_med = prev["summary"].get("median_seconds"), summary.get("median_seconds")
        if a_med is not None and b_med is not None:
            print(f"    {'median_seconds':<20} {a_med} -> {b_med}   "
                  f"({round(b_med - a_med, 1):+}) {'WORSE' if b_med > a_med else 'better'}")
        prev_rows = {r["id"]: r for r in prev["rows"]}
        for tag, rows_ in (("was", prev["rows"]), ("now", rows)):
            secs = sorted(r["seconds"] for r in rows_)
            if not secs:
                continue
            p95 = secs[min(len(secs) - 1, int(len(secs) * 0.95))]
            over = sum(1 for s in secs if s > 60)
            print(f"    {tag} p95 {p95:>6.1f}s   slowest {secs[-1]:>6.1f}s   "
                  f"over the caller's 60s timeout: {over}/{len(secs)}")

        # Per-label, because an average can hold still while the two halves of
        # it move in opposite directions — a model that answers more and
        # refuses less scores about the same and is much worse.
        print()
        for label in sorted(set(summary["by_label"]) | set(prev["summary"]["by_label"])):
            a_l = prev["summary"]["by_label"].get(label, {})
            b_l = summary["by_label"].get(label, {})
            print(f"    {label:<14} {a_l.get('pass_rate')}% -> {b_l.get('pass_rate')}%   "
                  f"({a_l.get('passed')}/{a_l.get('n')} -> {b_l.get('passed')}/{b_l.get('n')})")

        # Which questions actually flipped. "Nothing regressed" is the claim a
        # model change has to survive, and it is not visible in an average: a
        # run that fixes six questions and breaks five looks like +1.
        gained = [r["id"] for r in rows
                  if r["pass"] and r["id"] in prev_rows and not prev_rows[r["id"]]["pass"]]
        lost = [r["id"] for r in rows
                if not r["pass"] and r["id"] in prev_rows and prev_rows[r["id"]]["pass"]]
        print(f"\n    fixed   ({len(gained)}): {', '.join(gained) or '—'}")
        print(f"    broke   ({len(lost)}): {', '.join(lost) or '—'}")
        if lost:
            print("\n    regressions in detail:")
            for r in rows:
                if r["id"] in lost:
                    print(f"      {r['id']:<8} {r['label']:<13} {r['question'][:60]}")
                    print(f"               {r['answer_preview'][:110]}")
        print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
