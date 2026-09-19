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

**Refusal detection is not purely phrase-matching, and must not become it.** The
structured flags (`no_context`, `declined_advice`) are authoritative. The phrase markers
are a secondary check for the model abstaining in its own words inside the agent loop —
and a marker now counts **only when the answer did not also deliver grounded legal
content** (sources returned, and the prose names a section that was genuinely among them).

That escape hatch exists because of a measured defect. `co-013` returns, about one run in
four, a complete six-source correctly-cited answer ending *"It is recommended that you
consult a qualified lawyer for specific advice"* — and `"consult a qualified lawyer"` is a
marker, so the scorer failed a correct answer. **That biases a model comparison in exactly
the wrong direction:** a more capable, more safety-tuned model appends disclaimers more
often, so it would be punished for behaving better. See `RAG-REVIEW.md` §4.19.

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

## What the harness refuses to do

**It will not run against a degraded service, and it will not score through an outage.**

Both were live defects. Ollama was stopped part-way through a run (a laptop overheating,
not a crash) and — because embeddings come from Ollama too — every remaining question
returned "I do not hold that legislation". The scorer read those as correct abstentions
and reported:

```
refusal correctness  100.0%        ← from a service answering nothing at all
not_in_corpus        17/17  100%
must_refuse          15/15  100%
```

the best refusal numbers this harness has ever produced, and it wrote them to a results
file. So now:

- **Pre-flight** requires `/api/health` to report `healthy`, not merely to respond. A
  degraded service responds.
- **Mid-run**, any HTTP error aborts immediately and **no results file is written**. A
  partial run is not a measurement, and the danger is that it does not look like one.

## Results files store the full answer

Not a 180-character preview. The disclaimer defect above was only diagnosable by reading
the *end* of answers, and correcting a scoring rule should mean re-scoring what is on disk
rather than re-running a 40-minute evaluation. These are authored test questions and their
answers; no real person's data is stored.

## The noise floor — read this before believing a comparison

The same model, same corpus and same code, run twice, does **not** give the same numbers.
Measured 2026-09-14:

| | run A | run B |
| --- | --- | --- |
| recall@k, citation accuracy, grounding, refusal correctness | identical | identical |
| `answerable` | 42/51 | **40/51** |
| questions the router classified differently | — | **4 of 83** |

Temperature is 0.1, not 0. **Any difference smaller than roughly ±2 questions on
`answerable` is not evidence of anything.** Use the per-question `fixed:` / `broke:` lists
that `--compare` prints — those are the evidence; the averages are the headline.

`--compare` also reports p95 latency, the slowest question, and how many answers would
land past the Next.js caller's 60s timeout — a median hides that cliff completely, and an
answer that arrives at 70s is not a slow answer, it is a failed one.

## Adding a question

Append to `eval/questions.yaml`. Keep the answer key honest:

- **Read the section before writing the question.** Every expected section in this file was
  read in the vector store first. An answer key derived from what the retriever *returns*
  measures nothing — it would score 100% by construction.
- Use `expect_sections` only for `answerable`.
- Give a `why` for every `must_refuse` and `not_in_corpus`. A future reader has to be able
  to tell a deliberate refusal from a limitation.
