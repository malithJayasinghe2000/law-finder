# Open Items — everything outstanding, with a decision on each

> Written 2026-09-12, after Phase 8. This is the complete register: legal, product,
> engineering and operational. Nothing here is hidden in a phase log.
>
> Each item says what it is, why it matters, and **what I recommend doing** — because a
> list without decisions is just anxiety. Sequencing is in [DIRECTION.md](./DIRECTION.md).

**Severity key:** 🔴 blocks going live · 🟠 blocks scaling · 🟡 quality/maintainability ·
⚪ nice to have

---

## A. Legal — unanswered, and some of it is existential

### A1. 🔴 Counsel questions 16–18: may the consumer directory exist at all?

Rule 40 lists what an attorney may display and reads like an exhaustive permission. The
1894 Ordinance makes touting criminal **for the intermediary**. Indian courts have held
that even search-based filtering across lawyers is indirect solicitation, and Sri Lanka
never adopted India's 2008 relaxation.

**Why it matters:** if the answer is unfavourable, the consumer directory is withdrawn, not
adjusted. Every hour spent on consumer features between now and that answer is an hour at
risk.

**This has been the top of "Next up" since Phase 2 — seven phases — and nobody has asked.**
[COUNSEL-MEETING-BRIEF.md](./restructure/COUNSEL-MEETING-BRIEF.md) has been ready the whole
time.

> **DECISION: book a Sri Lankan Attorney-at-Law experienced in professional conduct, this
> month.** Budget a few hours of their time. Nothing else on this page has a better ratio
> of cost to consequence. Build B2B-first until they answer (see [DIRECTION.md](./DIRECTION.md)).

### A2. 🔴 No data-processor agreement with any firm

We are the firm's **processor** for matter data. The PDPA requires a written contract, and
no firm will sign up to hold privileged client files on a platform that cannot produce one.

> **DECISION: this is a document, not code, and it blocks the first real customer.** Draft
> it with counsel in the same engagement as A1. Counsel question 4(b) asks for the Sri
> Lanka-specific wording.

### A3. 🔴 No Data Protection Officer designated

The published privacy notice says so out loud, which was the honest thing to do — but it
is a gap a regulator will ask about.

> **DECISION: designate someone before the first real client matter.** For a company this
> size it is a named person with an email address, not a department.

### A4. 🟠 Cross-border transfer is undocumented (Counsel Q19)

The PDPA restricts sending personal data outside Sri Lanka. Two flows could cross a border
and neither has a documented basis: **database hosting** (`.env` holds a commented-out Neon
`us-east-1` URL) and **the AI model**. The privacy notice admits this in §8.

> **DECISION: host the database in Sri Lanka, or in a jurisdiction counsel confirms, before
> any real client data exists.** This is far cheaper to decide now than to migrate later.

### A5. 🟠 Matter and conflict-check retention undecided (Counsel Q7(c))

Nothing firm-controlled expires automatically, because how long a firm must keep a file is
a professional duty we do not get to set. The purge refuses rather than guessing — correct,
but it means data accumulates indefinitely.

> **DECISION: leave as is.** Refusing to guess is right. Ask counsel; until then, unbounded
> retention of a file the firm controls is the safer error.

### A6. 🟡 Counsel questions 4(f)–(i), 8(e)–(g), 9(f)–(j)

Encryption's relevance to privilege, key custody, participants-only chat, attorneys moving
practice, notice versioning as consent evidence, DSAR response time, erasure-as-anonymisation.

> **DECISION: bundle into the same counsel engagement as A1.** One meeting, one fee.

---

## B. Operational — built but not provisioned

### B1. 🔴 `MATTER_ENCRYPTION_KEYS` has no custody arrangement

**Losing this key destroys every matter description, conflict check, quote scope,
engagement letter and client message in the database.** Phase 8 wrote the full procedure in
[encryption-key-custody.md](./encryption-key-custody.md) — secrets manager, second copy in
separate custody, tested restore, rotation order.

**None of it is provisioned.** The key lives in a `.env` file.

> **DECISION: provision it before the first real matter. The document is not the control.**
> A day's work: a secrets manager, two custodians, one tested restore.

### B2. 🟠 Nothing runs on a timer

`npm run jobs:daily` exists and [scheduled-jobs.md](./scheduled-jobs.md) documents the
cadence. **Nothing is calling it.** A retention schedule nobody runs is a retention
*document*, and the PDPA asks about the policy.

> **DECISION: one cron entry. Thirty minutes of work.** Do it with the first deployment.

### B3. 🔴 Never deployed

No Dockerfile, no CI, no hosting, no TLS, no backups, no monitoring. The entire system runs
on `localhost`.

> **DECISION: see [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md).** This is the
> largest single body of work remaining and none of it is legal.

---

## C. Security and correctness

### C1. 🔴 No authenticated file-serving route for identity documents

`/api/upload` falls back to `public/uploads` when object storage is unconfigured, which
would serve **a practising certificate and a photograph of someone's face on a guessable
URL**. Phase 7 made an `identity` upload *refuse* the fallback, which closes the hole but
does not build the right thing: tier-3 documents need a route that checks who is asking.

> **DECISION: build it.** This is the largest remaining *code* gap, and it is squarely a
> security issue. Signed, expiring URLs from object storage, or an authenticated streaming
> route.

### C2. 🟠 Rate limiting is in-memory and covers four routes

`checkRateLimit` is on login, register, upload and the AI route. It is **not** on the
message routes, intake, or the privacy endpoints — and being in-memory it resets on deploy
and does not work across instances.

> **DECISION: move to Redis and extend to every write route that an unauthenticated or
> cheap-to-obtain account can reach.** Do it as part of deployment, since the fix depends
> on having somewhere to put Redis.

### C3. 🟡 `notFound()` returns HTTP 200

`/en/privacy/<unknown>`, `/en/firms/<unknown>` and `/en/lawyers/<unknown>` all render the
not-found page with a **200** status. The body is right; the status lies to search
indexers, uptime monitors and link checkers. Pre-existing and app-wide.

> **DECISION: fix once, centrally**, when touching the locale layout. Not urgent, but it is
> the kind of thing that quietly damages SEO on the exact pages meant to be found.

### C4. 🟡 No tests beyond the five policy checks

193 assertions cover **policy** superbly. Nothing covers **flow**. There is no test that a
client can complete an engagement end to end — and every single phase has found a real
break by driving the flow by hand.

> **DECISION: add Playwright, and write one test: the full firm-first engagement.** That
> one test would have caught defects in at least four phases. Expand from there.

---

## D. Product and code quality

### D1. 🟠 The subscription "permissions" system is mostly imaginary

Five models, eight admin screens and ~480 lines implement a per-feature permission and
metering system. **`canUseFeature` is called by exactly one route, which nothing in the UI
calls.** The real licensing rule lives in `firms/billing.ts` and is 176 lines.

This is not merely untidy: **it is where guardrail violations hide.** Three "inquiries"
permissions sat in the seed until Phase 7, one selling *"receive client inquiries"* as a
tier feature — pay-per-lead, in a table nobody looked at.

> **DECISION: delete it.** `Permission`, `SubscriptionRolePermission`, `SubscriptionRole`,
> `subscription.ts`, `subscription-middleware.ts` and the five admin screens. Keep
> `FeatureLimitConfig`/`FeatureUsage` for seats, storage and templates only. Everything
> resolves through `firms/billing.ts`, which the checks already cover.

### D2. 🟡 One concept, four names

The model is `Booking`, the language is "request" and "engagement", the client sees
"matter", and the URL says `consultations`.

> **DECISION: rename `Booking` → `Matter` and `/api/consultations/bookings` →
> `/api/matters`, in one migration.** Large diff, small risk, and it removes the single
> most common source of confusion for anyone new. Do it *before* the codebase grows, not
> after.

### D3. 🟡 Two subscription resolvers, two matter-listing routes

`subscription.ts` resolves by attorney (the model the restructure exists to undo);
`firms/billing.ts` resolves by firm. `/api/consultations/bookings` and
`/api/admin/bookings` build their own `where` clauses — and Phase 0 shipped a redaction to
one and not the other.

> **DECISION: fold both.** The first disappears with D1. The second needs one shared query
> builder, because the next privilege change has to be made in both places.

### D4. 🟡 `DashboardSidebar.tsx` is dead — and Phase 7 "fixed" it

It is imported by nothing. Phase 7's sidebar repair — recorded as *"all 18 links now
resolve, and every one was opened"* — went into this unused file, including its
*"if you add a link here, open it"* comment. The rendered sidebar is `AppSidebar`.

> **DECISION: delete it, and move the comment to `AppSidebar.tsx`.** Five minutes. The
> lesson is worth more than the file: **check what is rendered, not what is named.**

### D5. 🟡 `ConsultationPricing` is a model named "Pricing" that holds no price

Its price columns were dropped in Phase 3 because a published consultation price is a
rule-1 problem. What remains is a terms/notes row, on a screen a lawyer would reasonably
expect to set fees on.

> **DECISION: fold the remaining fields onto `LawyerProfile` and delete the model and the
> page.** The name alone invites someone to put a price back.

### D6. ⚪ Six payment pages where there should be two

`invoices`, `payments/history`, `payments/invoice` (a redirect), `payments/invoices`,
`payments/invoice/[planId]`, `payments/offline/[planId]`.

> **DECISION: collapse to `invoices` (list) and `invoices/[id]` (view and pay).** Do it
> when wiring the payment gateway — same code, same visit.

---

## E. The AI

> **Stage 0 of the RAG roadmap was completed on 2026-09-13.** The security and privacy
> findings that used to head this section — an unauthenticated remote file write, a
> `0.0.0.0` bind with the Flask debugger on, and every legal question being traced to
> LangSmith's US cloud — are **fixed and asserted** by `lawyer-rag/scripts/check_security.py`
> (45 assertions, against a running service). The items below are what remains, and they
> are all about **answer quality**, not exposure.
>
> One thing from Stage 0 is **not** code and is still outstanding: **the old LangSmith API
> key has not been revoked.** It is preserved commented out in `lawyer-rag/.env` marked
> `REVOKE-ME`. Turning tracing off stops new data leaving; it does not un-send what was
> already sent, and a key that still works is a key that can be turned back on. A stale
> `GROQ_API_KEY` sits beside it. **Revoke both.** Five minutes, and it is the last live
> thread of a real data incident.

### E0. 🟠 No golden evaluation set — and it blocks E1

There is no way to tell whether a change to retrieval, the prompt or the model makes
answers better or worse. That is not a missing nicety: it means **E1 cannot be actioned
responsibly**, because "use a more capable model" is an untestable claim without it.

The shape is in [RAG-ROADMAP.md](../../lawyer-rag/docs/RAG-ROADMAP.md) Stage 1.1 — 60–100
questions labelled `answerable` / `not_in_corpus` / `must_refuse`, measuring retrieval
recall, citation accuracy, faithfulness and refusal correctness.

The first case is already written for you. Asked *"My employer fired me without notice last
week. What should I do about my case?"*, the service advised the person, citing a **Civil
Procedure Code section about default in appearance** — because the corpus holds no
employment legislation and there is no relevance floor, so retrieval returned the nearest
six chunks it had and the model treated them as an answer. The application refused it
twice, before and after generation, which is the architecture working. But the service
produced it. `RAG-REVIEW.md` §4.10 has the transcript.

> **DECISION: build it before changing the model, the prompts or the retrieval.** It is
> the difference between changing the system and improving it.

### E1. 🟠 Three different models are configured in three files

| File | Model |
| --- | --- |
| `app/config.py` default | `qwen3.5:9b` |
| `.env.example` | `gemma4:e2b` |
| `.env` (actual) | `llama3.2:3b`, with `USE_GROQ=false` |

**Nobody can say which model answers a legal question**, and the one actually running is a
**3-billion-parameter local model**. This is the weakest link in the AI story: it is
precisely this class of model that produced the invented *"Employment (Amendment) Ordinance
No. 14 of 2017"* caught in Phase 5.

The policy layer does its job — it withholds uncited and advice-shaped answers server-side.
But a weak model means most answers get withheld, and the feature quietly becomes useless
rather than unsafe.

> **DECISION: settle on one model, configured in one place, and use a substantially more
> capable hosted one.** The policy gate already runs server-side and the browser never
> calls a model, so the provider is an implementation detail — but answer quality is not.
> Measure it: run the 49 `check:ai` cases plus a set of real Sri Lankan legal questions
> against candidates and compare withholding rates.

### E2. 🟠 Local Ollama inference will not deploy

The RAG service runs Ollama locally. It now runs under gunicorn (Stage 0), so the *serving*
half is done; the *inference* half is not. That needs a GPU-bearing host, and it is a second
service to operate, monitor and keep online.

> **DECISION: use a hosted inference API in production.** Cheaper than a GPU host at this
> volume, removes an operational burden, and makes E1 easy to act on. Keep local Ollama as
> the development path.

### E3. 🟡 Refusal patterns are English-only

The platform ships `si` and `ta`. A question asked in Sinhala or Tamil **bypasses the
pre-generation check entirely**, and the post-generation checks are English-only too.

> **DECISION: until the patterns are translated and reviewed, disable the assistant for
> `si` and `ta`.** An assistant that refuses to answer is a smaller failure than one that
> advises a Sinhala speaker about their own case. Counsel question 5(h).

### E4. 🟡 Three Acts are in the vector store with no library row

Civil Procedure Code, Companies Act, Motor Traffic Act — their citations render as "Not yet
in the library" instead of a link.

> **DECISION: upload the PDFs through `/dashboard/admin/legal-documents`.** A data task, an
> hour. **Do not hand-edit `ragDocumentName`** — guessing which Act a row refers to is how
> you cite the wrong statute.

---

## F. Documentation

### F1. 🟠 The root documents describe the old, illegal product

`project_scope_and_vision.md`, `mvp_project_plan.md`, `developer_project_plan.md` and
`architecture_manual.md` still promise sponsored listings, commission on fees, star
reviews, "Inquire Now" lead-gen and an AI that recommends "top property lawyers in
Colombo".

**This is the most likely way the restructure gets undone** — not by malice, but by someone
reading the top-level plan and building what it says.

> **DECISION: mark every one of them superseded, at the top, in bold**, pointing at
> [THE-PROJECT.md](./THE-PROJECT.md). Do not delete them; they are the record of where the
> project started. *(Done as part of this session.)*

### F2. ⚪ `LEGAL-GUARDRAILS.md` references a `PROJECT-PLAN.md` that does not exist

It points at a root `PROJECT-PLAN.md` for the B2B fallback shape. The actual files are
`project_scope_and_vision.md` and `mvp_project_plan.md` — which describe the *marketplace*,
not the B2B product.

> **DECISION: fix the reference** to point at [DIRECTION.md](./DIRECTION.md), which now
> describes the B2B shape properly.

---

## Summary — the five that actually matter

1. **A1 — Ask counsel.** Seven phases overdue. Everything consumer-facing is provisional
   until it is answered.
2. **B3 + B1 — Deploy it, and put the encryption key somewhere real.** The product cannot
   earn a rupee from `localhost`, and the key risk was taken on deliberately without the
   operational half.
3. **C1 — Build the authenticated file route.** Practising certificates and face
   photographs deserve better than a refusal to degrade.
4. **Revenue Decisions 1 and 2** — per-seat pricing and a gateway for subscriptions.
   See [REVENUE-MODEL.md](./REVENUE-MODEL.md).
5. **D1 — Delete the permissions system.** It is where violations hide, twice over.

> **One item closed since this page was written:** the RAG service's security and privacy
> defects (Stage 0, 2026-09-13). They were the most urgent thing in the repository and they
> are done — but **revoke the old LangSmith key**, which is the one part of that incident a
> code change could not close.
