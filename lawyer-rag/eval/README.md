# The golden evaluation set

**What this is:** an exam paper with an answer key, for the AI.

Before this existed there was no way to tell whether a change to the retrieval, the
prompts or the model made answers better or worse. Every improvement was a guess, and
the biggest available lever — *"use a more capable model"* — was an untestable claim.

```bash
# from lawyer-rag/, with the service running
./venv/bin/python -m scripts.eval                 # run everything
./venv/bin/python -m scripts.eval --label must_refuse   # just one category
./venv/bin/python -m scripts.eval --baseline      # write results/baseline.json
```

---

## The three kinds of question

| Label | What the assistant should do | Why it is in here |
| --- | --- | --- |
| `answerable` | Answer, citing the expected section | The corpus holds the answer |
| `not_in_corpus` | Say it does not hold that legislation | **Half the value of this set.** The most common *correct* answer this system can give is "I do not have that law", and nothing tested that it says so |
| `must_refuse` | Refuse | Advice on the asker's own matter, or naming a practitioner |

`not_in_corpus` deserves the emphasis. The corpus is five documents. A real user asks
about land, labour, family, tax and crime within minutes, and for every one of those the
honest answer is a refusal to answer. A system that instead produces six confident
citations to the wrong Act is worse than one that says nothing — and that is exactly what
it did before this set existed (see `docs/RAG-REVIEW.md` §4.10).

## What is measured

| Number | Question it answers | Applies to |
| --- | --- | --- |
| **recall@k** | Did retrieval return a chunk from the section that actually holds the answer? | `answerable` |
| **citation accuracy** | Of the citations shown to the user, how many name the right document and section? | `answerable` |
| **grounding** | Does every Act-and-section named *in the prose* correspond to something retrieval actually returned? | all |
| **refusal correctness** | Did it refuse exactly when it should have — and not when it should not? | all |

**Grounding is not full faithfulness.** It applies the same rule as the application's
`findUnsupportedProseCitations` in `src/lib/ai/policy.ts`: a citation in the text must
match a retrieved chunk. It catches an invented Act — the Phase 5 failure — but it does
**not** check whether a retrieved section actually *supports* the claim made about it.
That needs a judge model, and it is deliberately not faked here. A number that sounds like
faithfulness but is not would be worse than no number.

## What this set cannot test yet

**Repealed law.** The roadmap asks for a question whose answer lies in a repealed section,
which must never be cited as current. **The corpus contains no repealed content at all** —
all 2,368 chunks are `status: Active` — so the case cannot be written honestly. `eval.py`
reports this at the top of every run and the case becomes writable as soon as an amendment
is processed. The protection itself is covered meanwhile by `scripts/check_security.py`,
which asserts that retrieval never drops the `Active` filter.

## Adding a question

Append to `eval/questions.yaml`. Keep the answer key honest:

- **Read the section before writing the question.** Every expected section in this file was
  read in the vector store first. An answer key derived from what the retriever *returns*
  measures nothing — it would score 100% by construction.
- Use `expect_sections` only for `answerable`.
- Give a `why` for every `must_refuse` and `not_in_corpus`. A future reader has to be able
  to tell a deliberate refusal from a limitation.
