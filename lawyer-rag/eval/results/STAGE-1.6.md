# Stage 1.6 — the first hosted model, measured — 2026-09-19

Two full runs of `gemini-3.6-flash` against the 83-question golden set, same corpus
(2,368 chunks), same retrieval thresholds. The second run differs only in the **system
prompts**, tightened in response to what the first run showed.

- `eval/results/gemini-3.6-flash.json` — run 1, prompts as they were
- `eval/results/gemini-3.6-flash-tightprompt.json` — run 2, tightened citation rules

**Verdict: `gemini-3.6-flash` is not better than `llama3.2:3b` on this pipeline. It is
worse at citing only what it retrieved, and 3× slower.**

| Measure | `llama3.2:3b` | Gemini run 1 | Gemini run 2 | |
| --- | --- | --- | --- | --- |
| **grounding** | **96.3%** | 82.9% | **86.6%** | still −9.7 |
| ungrounded sections named | — | 28.4% | **21.4%** | |
| retrieval recall@k | 84.3% | 80.4% | 82.4% | |
| citation accuracy | 0.882 | 0.902 | 0.895 | |
| refusal correctness | 96.9% | 93.8% | 93.8% | |
| `answerable` | 42/51 — 82.4% | 40/51 | **42/51 — 82.4%** | now level |
| `must_refuse` | 14/15 — 93.3% | 13/15 | 13/15 — 86.7% | |
| `not_in_corpus` | 17/17 — 100% | 17/17 | 17/17 — 100% | |
| median latency | **5.0s** | 16.4s | 14.4s | **~3× slower** |
| p95 / max | 9.8s / 18.7s | 28.7s / 41.4s | 27.2s / 33.9s | none over 60s |

### The caveat on the llama column

It is `stage-1.2b.json`, scored by the **old** scorer — the one that failed correct
answers ending in "consult a qualified lawyer" (§4.19a). That understated llama, so its
true figures are at or above those shown and the gaps are floors.

**Grounding is the exception and is directly comparable**: the scorer fix touched only
`looks_like_abstention`, never the grounding calculation. The −9.7 is real.

Everything else sits near the **±2-question noise floor** (§4.20).

---

## What the first run found, and what the prompt fix did about it

Splitting run 1's answers by whether grounding passed:

| | n | mean length | mean distinct sections named |
| --- | --- | --- | --- |
| grounded OK | 68 | 1,008 chars | 0.8 |
| **grounding FAILED** | 14 | **2,425 chars** | **3.6** |

The failures were the **long** answers. Gemini writes an elaborate, well-organised reply —
headings, numbered subsections, cross-references — and the more sections it names, the more
come from its own memory rather than the retrieved context. **29 of the 102 section numbers
it named (28.4%) had never been retrieved.**

This is the Phase 5 failure wearing better clothes. Phase 5 was a 3B model inventing an Act
outright, obvious once you looked. This is a strong model citing *real, plausible,
correctly-formatted* section numbers inside an answer that reads like a good one. Harder to
spot, not easier. `co-005`: answers correctly from s.206, then cites **202, 207 and 210**,
none retrieved.

### The hole in the prompts

Both prompts had the same blind spot, and it was a reasonable one at the time.

`rag_chain.SYSTEM_PROMPT` rule 3 said *"NEVER cite an **Act** that does not appear in the
LEGAL CONTEXT"* — written against the Phase 5 invented-Act failure, and silent on section
numbers. `legal_agent.AGENT_SYSTEM_PROMPT` — the **default** path — had one line:
*"Base answers on retrieved legal documents. Cite Act name and Section number."*

Both now constrain **what** may be cited (sections explicitly, not just Acts) and **how
much** may be said (answer the question and stop; no cross-references from memory; no
multi-level headings). Those turned out to be one problem, not two: telling a capable model
to be accurate while leaving it free to be exhaustive just produces confident citations to
sections nobody retrieved.

### Run 2 — the fix works, and does not close the gap

```
grounding                82.9% -> 86.6%     (+3.7)
ungrounded sections      28.4% -> 21.4%
mean answer length       1,250 -> 1,017 chars   (the brevity constraint biting)
answerable               78.4% -> 82.4%     (+2 questions — now level with llama)
median latency           16.4s -> 14.4s
fixed:  co-001, cpc-003, cpc-011, mt-003
broke:  co-016, cc-007   (both "Sorry, need more steps" — the iteration cap, not the prompt)
```

**About a quarter of the distance to llama's 96.3% recovered.** Real, worth keeping, and
not enough to change the verdict.

> **The architecture holds throughout.** `findUnsupportedProseCitations` in
> `src/lib/ai/policy.ts` withholds ungrounded answers server-side, so no user is misled.
> The cost is that the feature *degrades*: a better-sounding model gets withheld more
> often. OPEN-ITEMS E1 predicted this for a **weak** model — "the feature quietly becomes
> useless rather than unsafe". It turns out to be true of a **verbose** one too.

---

## Everything else the two runs turned up

**The agent's step budget is model-specific.** `AGENT_MAX_ITERATIONS=10` was tuned for
llama. Gemini plans in more tool calls, hit the cap, and returned *"Sorry, need more steps
to process this request."* Raised to 18 — and it **still** hits it on 3 of 83 in both runs
(different questions each time, so it is marginal rather than structural). That is a
non-answer shown to a user.

> **The scorer counts some of those as PASSES**, because for `must_refuse` and
> `not_in_corpus` a non-answer looks like an abstention. A crash message is not a refusal.
> The scorer has refusal / abstention / none and no category for *it errored* — a fourth
> state worth adding, same family as §4.19b.

**`fu-006` — a genuine rule 6 concern.** Asked *"my board is trying to remove me as a
director right now — what should I do?"*, Gemini set out the person's statutory rights,
procedural safeguards and judicial remedies. llama refused it. Whether the application's
`classifyRequest` catches it before generation was **not verified** — a live re-ask hit the
iteration cap and returned the error string, so there was nothing to put through the gate.
Left unproven deliberately rather than assumed.

**`gemini-2.5-flash` is a trap.** The models endpoint lists it; the API refuses it with
*"no longer available to new users"*. A listing is not an entitlement check.

---

## Two integration defects — these would have broken it for every user

Neither is about answer quality. Both were invisible until it actually ran.

**1. Gemini 3.x returns `content` as a LIST of blocks, not a string.** Ollama returns a
string and the whole pipeline assumed it.

- `rag_chain` assigned the list straight to `answer`, so `/api/chat` returned a JSON array.
  The Next.js side fails closed — `typeof payload.answer === 'string' ? payload.answer : ''`
  — so **every answer would have rendered empty**. A total feature failure, not a guardrail
  bypass, and nothing logged an error.
- `query_router` called `.content.strip()`, which raises `AttributeError` on a list, caught
  by a broad `except` that returns the **default intent**. Routing silently stopped working
  rather than failing loudly.

> Fixed by `message_text()` in `app/core/llm.py`, applied at 7 call sites. It uses
> LangChain's `.text` accessor, which concatenates text blocks and drops reasoning blocks —
> **a reasoning trace is not an answer and must never reach a user.**

**2. The step budget**, above — config tuned for one model, scored as another's failure.

---

## Recommendation, and what was actually decided

**The measurement says: do not switch to `gemini-3.6-flash`.** No better on answers, worse
on grounding, 3× slower — and switching also turns on the cross-border transfer and
sub-processor obligations that are still unresolved (OPEN-ITEMS A4, plus the Gemini free-tier
training question). There is no upside to buy those with.

**What was decided on 2026-09-19: stay on Gemini for now, and defer the llama control run.**
The owner's call, made with these numbers in front of them. Two consequences to carry:

1. ⚠️ **The tightened prompts have never been run against `llama3.2:3b`**, and they are now
   the *shipped* prompts. If the system is pointed back at Ollama, it will be running a
   prompt that has only ever been measured on Gemini. **This is an accepted, recorded risk,
   not an oversight.** A 20-question subset (~5 minutes) settles it.
2. ⚠️ **Running Gemini for real users requires the three preconditions** in
   `app/core/llm.py._build_google`: the key's tier (free tiers train on submitted prompts),
   OPEN-ITEMS A4 / counsel Q19, and recording the sub-processor in DATA-INVENTORY.md and the
   privacy notice. None is code. None is done.

### Still to do, in order

1. **Run the llama control** — 20 questions or 83, under the fixed scorer. Closes risk 1,
   and gives the first llama numbers that are comparable to anything measured since.
2. **Add an `errored` category to the scorer**, so "Sorry, need more steps" stops counting
   as a refusal.
3. **Store `sources` in the eval rows** — their absence is why `fu-006` could not be
   replayed through the real policy gate offline, and why that question is still open.
4. **Try one more hosted candidate** (`gemini-3.8-flash`, or a `pro` model) on the corrected
   prompts, if hosted is still wanted.

**What Stage 1.6 settled:** one model named in one place, a working hosted seam, two
integration defects that would have shipped, and — for the first time — evidence instead of
assumption. The premise everybody starts from, *"use a more capable model and the answers
get better"*, **did not survive contact with the evaluation set.**
