"""
Sweep RETRIEVAL_MIN_SCORE against the golden set — retrieval only, no model.

    ./venv/bin/python -m scripts.sweep_retrieval

WHY THIS EXISTS. `config.py` says to re-tune the relevance floor after any
change to the embedding model, the chunker or the corpus — and hybrid search is
a change of the same kind, because it changes what the "best result" is drawn
from. 0.62 was chosen against the best of TOP_K_RESULTS dense hits. With BM25
proposing candidates, the best result comes from a pool of HYBRID_FETCH_K, and
the number that separated signal from noise before may not be the one that does
now.

WHY IT RUNS NO MODEL. The floor is a property of RETRIEVAL. Measuring it through
`scripts.eval` costs a full generation per question — half an hour and real money
on a hosted provider — to learn something no model is involved in. This asks the
retriever directly, so a sweep is seconds and free, and can be run as often as
anybody likes.

WHAT IT MEASURES, and the trade-off it exists to show:

    answerable     the expected section is among the chunks KEPT at this
                   threshold. Falls as the floor rises.
    not_in_corpus  nothing clears the floor, so the pipeline can say it does not
                   hold the material. Rises as the floor rises.

Those two move in opposite directions and the floor is where you choose between
them. The standing judgement, from Stage 1.2 and unchanged: **for a legal
assistant, stating law it does not hold is worse than declining a question it
could have answered.** The first is invisible to the reader; the second is
obvious to them. So `not_in_corpus` is bought first and `answerable` second.

This does NOT measure answer quality, faithfulness or refusal behaviour. Those
need the model and live in `scripts.eval`. A threshold chosen here should be
confirmed there before it is believed.
"""

import sys
from collections import Counter
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import config  # noqa: E402
from app.core.vectorstore import hybrid_search  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "eval" / "questions.yaml"

THRESHOLDS = [0.50, 0.52, 0.54, 0.56, 0.58, 0.59, 0.60, 0.61, 0.62, 0.64, 0.66]


def section_of(meta: dict) -> str:
    raw = str(meta.get("section_number") or "")
    return raw.split()[-1] if raw and not raw.startswith("Chunk_") else ""


def main() -> int:
    data = yaml.safe_load(QUESTIONS.read_text())
    questions = [q for q in data["questions"] if not q.get("follow_up_to")]

    print(f"\nhybrid={config.ENABLE_HYBRID_SEARCH}  fetch_k={config.HYBRID_FETCH_K}  "
          f"top_k={config.TOP_K_RESULTS}  chunk_floor={config.RETRIEVAL_CHUNK_FLOOR}")
    print(f"{len(questions)} questions (single-turn only — a follow-up needs a conversation)\n")

    # Retrieve ONCE per question with the floor off, then evaluate every
    # threshold against the same scored results. Re-retrieving per threshold
    # would embed the same question eleven times and measure nothing extra.
    rows = []
    for i, q in enumerate(questions, 1):
        hits = hybrid_search(query=q["question"], top_k=config.TOP_K_RESULTS, apply_floor=False)
        rows.append((q, hits))
        print(f"\r  retrieving {i}/{len(questions)}", end="", flush=True)
    print("\r" + " " * 40 + "\r", end="")

    print(f"  {'floor':>6} │ {'answerable':>12} │ {'not_in_corpus':>14} │ {'must_refuse*':>12}")
    print(f"  {'─'*6}─┼─{'─'*12}─┼─{'─'*14}─┼─{'─'*12}")

    best_line = None
    for t in THRESHOLDS:
        tally = Counter()
        totals = Counter()
        for q, hits in rows:
            label = q["label"]
            totals[label] += 1
            best = max((s for _, s in hits), default=0.0)
            cleared = best >= t
            kept = [(d, s) for d, s in hits if s >= config.RETRIEVAL_CHUNK_FLOOR] if cleared else []

            if label == "answerable":
                want_doc, want_secs = q["expect_document"], set(q["expect_sections"])
                got = {
                    (str(d.metadata.get("document_name") or ""), section_of(d.metadata))
                    for d, _ in kept
                }
                if any((want_doc, s) in got for s in want_secs):
                    tally[label] += 1
            else:
                # not_in_corpus and must_refuse are both "retrieval should find
                # nothing" from the floor's point of view. must_refuse is marked
                # with * because refusing it is the APPLICATION's job, not the
                # floor's — several of those questions are about held law and
                # SHOULD retrieve. It is reported only to show what moves.
                if not cleared:
                    tally[label] += 1

        def pct(l):
            return f"{100*tally[l]/totals[l]:5.1f}% ({tally[l]}/{totals[l]})" if totals[l] else "—"

        mark = "  <- current" if abs(t - config.RETRIEVAL_MIN_SCORE) < 1e-9 else ""
        print(f"  {t:>6.2f} │ {pct('answerable'):>12} │ {pct('not_in_corpus'):>14} │ "
              f"{pct('must_refuse'):>12}{mark}")

    print(
        "\n  * must_refuse is not a retrieval decision. Those questions are refused by\n"
        "    src/lib/ai/policy.ts before the model is called; several of them are about\n"
        "    legislation that IS held and should retrieve. Ignore the column when choosing.\n"
    )
    print("  Confirm any change with scripts.eval before believing it.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
