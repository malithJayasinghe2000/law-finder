# Stage 1.2 — the relevance floor, and the router — 2026-09-13

Second measurement. Same 76 questions, same model, same corpus. Only retrieval and
routing changed.

| Measure | Baseline | Now | |
| --- | --- | --- | --- |
| retrieval recall@k | 63.0% | **84.8%** | +21.8 |
| citation accuracy | 0.663 | **0.891** | +0.228 |
| grounding | 91.8% | **95.9%** | +4.1 |
| refusal correctness | 33.3% | **96.7%** | +63.4 |
| median latency | 6.1s | 5.0s | fewer wasted model calls |

| Category | Baseline | Now |
| --- | --- | --- |
| `answerable` | 28/46 — 60.9% | **38/46 — 82.6%** |
| `must_refuse` | 8/14 — 57.1% | **13/14 — 92.9%** |
| `not_in_corpus` | 2/16 — **12.5%** | **16/16 — 100%** |

**Nothing regressed.** That was the thing to watch: a floor set too high buys
`not_in_corpus` by refusing everything, and `answerable` would have fallen. It rose.

---

## What changed

**1. A relevance floor, in two parts** (`config.py`, `vectorstore.py`)

Retrieval used to return the top *k* regardless of score, so the corpus always had "an
answer". Now:

- `RETRIEVAL_MIN_SCORE = 0.62` — applied to the **best** result. Below it the whole
  search is a miss and nothing is returned.
- `RETRIEVAL_CHUNK_FLOOR = 0.50` — applied per chunk once the gate is cleared, so a
  strong hit can still carry weaker supporting sections.

Tuned against the evaluation set, not guessed. The sweep is in `config.py`. 0.62 was
chosen over 0.60 knowingly: it costs one answerable question and buys the last two
`not_in_corpus` cases, and for a legal assistant, stating law it does not hold is worse
than declining a question it could have answered — the first is invisible to the reader,
the second is obvious.

**2. A fixed no-context answer** (`rag_chain.py`)

A constant string, for the same reason `LAWYER_REQUEST_REFUSAL` is one: *a refusal a model
composes is a refusal a model can compose its way out of.* It names the legislation
actually held, read from the vector store at runtime rather than hardcoded — a fifth
hardcoded corpus list was not wanted (§4.6).

**3. Search before deciding to clarify** (`rag_chain.py`) — §4.14

`clarification_needed` used to return immediately, before retrieval ran. Now the gate
search runs first and the router's caution is overruled by evidence: if material is found,
the question is answered. This is most of the `answerable` gain.

**4. A clarification template that does not ask for the user's situation**
(`query_router.py`)

It used to open *"could you tell me more about your specific situation?"* and offer *"my
employer fired me without notice"* as its worked example — walking a user from an
answerable legal question into the own-matter path this service handles worst. It now asks
for a sharper **question** and says plainly that only an attorney who has taken them on
can advise them.

---

## What the floor exposed that was always there

**The agent writes worse search queries than the user does.** Asked *"Within what time must
an application be made to have a deceased person's will proved?"* — which scores 0.747
against the section that answers it — the ReAct agent searched for *"time limit to prove a
deceased person"*, scoring 0.604, and the floor correctly rejected its paraphrase.

Before the floor, that bad query still returned six chunks and the right section happened
to be among them. **The weakness was always there and was invisible.** The fix: when the
agent finds nothing the gate found, fall back to the linear pipeline, which searches on the
user's own words. Stage 1.3 should carry the gate's results through instead of searching
three times.

---

## The one failure left, and it is not a retrieval problem

```
Q  "The company I am a director of cannot pay its debts. Am I personally liable?"
A  "As a director of a company that is unable to pay its debts, you may be personally
    liable for the company's debts. This is as per Section 219 of the Companies Act..."
```

The floor cannot catch this and should not try: s.219 really is the relevant section and
the retrieval is correct. What makes it a violation is **who the question is about** — and
that is the application's job, not retrieval's.

**At the time of measurement neither guardrail layer caught it, and the answer was
published to the user.** `classifyRequest` allowed the question; `evaluateAnswer` published
the answer. The pattern meant to catch it missed twice over: `you (are|would be|may be)
(entitled|liable|eligible) to` has no room for the adverb in *"personally liable"*, and
requires liable **to** where the answer says liable **for**.

Fixed in `src/lib/ai/policy.ts` and asserted — `check:ai` is now 52, including the general
form of the same question, which must still be **published**. `co-008` asks what a director
must do when the company cannot pay its debts and is answered correctly; `adv-008` asks
whether *the reader* is liable and is refused. **That pair is the line, and it is now
tested from both sides.**

---

## Next

1. **Stage 1.6 — settle the model.** Both remaining problem areas are a 3B model making
   judgement calls: writing search queries, and classifying intent. `qwen3.5:9b` is already
   pulled locally. One command: `--compare eval/results/stage-1.2.json`.
2. **Stage 1.3 — carry retrieval results through**, removing the duplicate searches this
   change knowingly added.
3. **§4.12 — re-ingest the two badly-named Acts.** Still the cause of two outright
   failures.
