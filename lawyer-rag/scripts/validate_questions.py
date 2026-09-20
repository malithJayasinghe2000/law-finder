"""
Assert that every answer key in eval/questions.yaml is REAL.

    ./venv/bin/python -m scripts.validate_questions

WHY THIS EXISTS. eval/README.md says every expected section must be read in the
vector store before its question is written, because a key derived from what the
retriever returns scores 100% by construction and measures nothing. That was a
rule enforced by hand, and a rule enforced by hand is a rule that is eventually
skipped — so this enforces it.

It checks three things, none of which needs a model:

  1. every `expect_document` + `expect_sections` pair resolves to at least one
     chunk actually in the store;
  2. every `expect_terms` string appears in that chunk's text;
  3. every not_in_corpus and must_refuse question carries a `why`, and no
     non-answerable question carries expected sections.

WHAT IT DELIBERATELY DOES NOT CHECK: whether retrieval FINDS the section. That
is the thing being measured, and a validator that required it would quietly
turn the answer key into a copy of the retriever's output.

RUN IT AFTER EVERY INGEST. A label reading "not in the corpus" is a claim about
the corpus and it expires the moment the corpus changes — on 2026-09-20 loading
nine Acts silently made four not_in_corpus questions answerable, and one of
those (nic-011) scored below the relevance floor, so it still LOOKED like a
correct abstention. Only re-checking coverage finds that class of rot.
"""

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.vectorstore import get_vectorstore  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "eval" / "questions.yaml"


def main() -> int:
    data = yaml.safe_load(QUESTIONS.read_text())
    questions = data["questions"]
    collection = get_vectorstore()._collection

    failures: list[str] = []

    ids = [q["id"] for q in questions]
    for dupe in {i for i in ids if ids.count(i) > 1}:
        failures.append(f"{dupe}: duplicate id")

    answerable = 0
    for q in questions:
        qid = q["id"]
        if q["label"] != "answerable":
            if not q.get("why"):
                failures.append(f"{qid}: {q['label']} with no `why` — a future reader "
                                "cannot tell a deliberate refusal from a limitation")
            if "expect_sections" in q:
                failures.append(f"{qid}: expect_sections on a {q['label']} question")
            continue

        answerable += 1
        doc = q.get("expect_document")
        sections = q.get("expect_sections") or []
        if not doc or not sections:
            failures.append(f"{qid}: answerable with no expect_document/expect_sections")
            continue

        text = ""
        for sec in sections:
            got = collection.get(
                where={"$and": [{"document_name": doc}, {"section_number": f"Section {sec}"}]},
                include=["documents"],
            )
            if got["ids"]:
                text += " ".join(" ".join((t or "").split()) for t in got["documents"])

        if not text:
            failures.append(
                f"{qid}: no chunk in the store for {doc!r} sections {sections} — "
                "the key names a section the corpus does not hold"
            )
            continue

        missing = [t for t in q.get("expect_terms", []) if t.lower() not in text.lower()]
        if missing:
            failures.append(f"{qid}: terms absent from {doc} {sections}: {missing}")

    print(f"\n{len(questions)} questions ({answerable} answerable) checked against the store")
    if failures:
        print(f"\n{len(failures)} PROBLEM(S):")
        for f in failures:
            print(f"  ✗ {f}")
        print()
        return 1
    print("every answer key resolves to a chunk that contains its expected terms\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
