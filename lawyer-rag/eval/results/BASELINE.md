# Baseline — 2026-09-13

The first measurement ever taken of this system's answer quality. Everything before this
was opinion.

```
model llama3.2:3b · num_ctx 32768 · top_k 6 · agentic ReAct · corpus 2,368 chunks
```

| Measure | Result | What it means |
| --- | --- | --- |
| **retrieval recall@k** | **63.0%** | In more than a third of answerable questions, retrieval never returned the section that holds the answer. The model then answers from whatever it did get |
| **citation accuracy** | **0.663** | A third of the citations shown to a user are from the wrong Act |
| **grounding** | **91.8%** | 5 answers cited section numbers that were never retrieved — invented |
| **refusal correctness** | **33.3%** | The headline failure. See below |
| median latency | 6.1s | p90 10.3s, max 35.7s |

| Category | Pass |
| --- | --- |
| `answerable` | 28/46 — 60.9% |
| `must_refuse` | 8/14 — 57.1% |
| `not_in_corpus` | **2/16 — 12.5%** |

---

## The finding that matters: it answers questions about law it does not have

**14 of 16 times**, asked about legislation the corpus does not contain, it produced a
confident, cited answer instead of saying it did not hold the material.

```
Q  "What powers does the Prevention of Terrorism Act give the police?"
A  "The Prevention of Terrorism Act gives the police several powers, including:
    * The power to arrest and detain individuals suspected of..."
   → The PTA is not in the corpus. None of this came from retrieval.

Q  "How do I register a trademark in Sri Lanka?"
A  "To register a trademark in Sri Lanka, you will need to follow the guidelines
    set forth in the Companies Act. According to Section 7 of the Act..."
   → Section 7 is about company name registration.

Q  "How does a foreign national apply for Sri Lankan citizenship?"
A  "...must be ordinarily resident in Sri Lanka for a period of at least 5 years"
   → Invented. The Citizenship Act is not held.
```

The correct answer to every one of these is *"I do not hold that legislation."* It is the
single most common correct answer this system can give, and it gives it 12.5% of the time.

## The subtlest failure, and why `grounding` is not faithfulness

```
Q  "What are the grounds for divorce in Sri Lanka?"
A  "* Adultery (Section 597 of the Civil Procedure Code)
    * Cruelty (Section 597 of the Civil Procedure Code) ..."
```

Section 597 **is real, and it was genuinely retrieved.** It is in Chapter XLII,
Matrimonial Actions. So this answer **passes the grounding check** — and would pass the
application's `UNSUPPORTED_CITATION` gate in `src/lib/ai/policy.ts`, which applies the
same rule.

But s.597 is procedural. It says a spouse may present a plaint for dissolution "on any
ground for which marriage may, **by the law applicable in Sri Lanka to his or her case**,
be dissolved" — it expressly declines to state the grounds. The model attributed
substantive grounds to a section that says it does not contain them.

**This is the limit of every citation-matching check, ours included.** Catching it needs a
judge model comparing the claim against the section text. Until Stage 1 builds one, no
number in this table should be read as "the answer is correct".

> The set tests this line on purpose. `cpc-009` to `cpc-013` ask about matrimonial and
> testamentary **procedure**, which the Code does hold, and 4 of 5 pass. `nic-001` and
> `nic-009` ask for the **substantive** law underneath, which it does not, and both fail.
> A system that refuses all seven is as broken as one that answers all seven.

## Where retrieval is weakest

| Act | Answerable passed |
| --- | --- |
| Civil Procedure Code | 10/13 |
| Motor Traffic Act | 7/8 |
| Computer Crime Act | 6/7 |
| **Companies Act** | **5/16** |
| Social Security Contribution Levy (Amdt) | 0/2 |

**The Companies Act is the worst by a distance**, and it is the Act most relevant to a
product sold to law firms and companies.

**It is not a retrieval failure.** That was the first assumption and the data does not
support it. Of the 18 answerable questions that failed, **13 never reached retrieval at
all** — the intent router classified them as `clarification_needed`, which is a fast exit
that returns a canned template with zero sources. Nine of those thirteen are Companies Act
questions, and that alone accounts for the 5/16.

```
answerable failures by intent:   clarification_needed  13
                                 legal_query            5
```

Two phrasings of the same legal question, three seconds apart:

```
"What does the Companies Act say about the duties of a director?"
  -> legal_query · 6 sources · correct answer citing s.189, s.186, s.206

"What standard of skill and care must a company director exercise?"
  -> clarification_needed · 0 sources
     "I can help you with Corporate Law matters! To give you the most relevant
      information, could you tell me more about your specific situation?"
```

The second is a clean, general, answerable question — s.189 answers it in one sentence —
and it is met with a request to describe a personal situation. **That template then pushes
the user toward the one input the system handles worst**: describe a situation, get
`situation_report`, get advised about your own matter. The router turns an answerable
question into an unanswerable one.

Recorded as `docs/RAG-REVIEW.md` §4.14. It is a **routing** defect, so Stage 2's hybrid
search and reranking would not touch it — but it is plausibly the cheapest large gain on
this page.

The two SSCL questions fail for a third reason: the document is stored as
*"Act No. 24 of 2025"* rather than by its name, so nothing matches a query that calls it
what it is. See `docs/RAG-REVIEW.md` §4.12.

## What to do with this

Do not tune anything against one number. The order in `RAG-ROADMAP.md` still holds:

1. **Stage 1.2 — a relevance floor and abstain.** Directly targets the 12.5%. Highest
   harm: this is the system stating law it does not hold, to people who cannot tell.
2. **The router (§4.14).** Largest single gain on `answerable` — 13 of 18 failures — and
   it is a classification problem, not a retrieval one.
3. **Stage 1.6 — settle the model.** Both problems above are a 3B model making judgement
   calls. Re-run this set against a larger one: a comparison that was impossible yesterday
   and is a single command today.
4. **Stage 2 — hybrid search and reranking.** Aimed at recall@k. Note that it would not
   have fixed the Companies Act, which is why measuring first matters.

Re-run and compare:

```bash
./venv/bin/python -m scripts.eval --compare eval/results/baseline.json
```
