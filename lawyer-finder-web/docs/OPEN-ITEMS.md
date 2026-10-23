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

### D7. 🟠 Legal Library: the pre-1948 Ordinances have no official source yet

Parliament's Acts listing (parliament.lk/en/business-of-parliament/acts-listing) goes back
to about 1949 and has an official PDF for every Act, amendments included. It cannot hold
laws made before Parliament existed: the Penal Code (Ordinance No. 2 of 1883), the
Evidence Ordinance (1895), the Civil Procedure Code (1889) and others. For those it lists
only the amending Acts.

Private platforms (lankalaw.net, justice.lk) hold these texts, but their copies carry their
own branding and may carry their own copyright. **Do not copy from them.**

**Source found (2026-10-21):** CommonLII hosts LawNet's (Ministry of Justice) 1980 Revised
Legislative Enactments as PDFs, marked "Copyright © 2005 Sri Lanka Government":
http://www.commonlii.org/lk/legis/consol_act/ (the Penal Code is Chapter 25, `pc25130`). Each
text includes amendments up to 1980; later ones come from Parliament. The site refuses
scripts (403), so the PDFs are downloaded by hand.

> **DECISION: download the main Ordinances (about 30-50) from CommonLII, and upload each
> under Admin > Legal Documents > Missing original > "Upload original" (or a plain upload),
> source "Revised Legislative Enactments 1980", "Includes amendments up to" 1980.** Until
> then, the law's page lists its amendments and shows "Original text: being added". Do not
> market the library as "every law in Sri Lanka" until this is done.

### D9. 🟠 Legal Library: the AI's current main laws are unofficial consolidations

The 12 main laws the AI answers from (Penal Code, Civil Procedure Code, Companies Act,
Motor Traffic Act, ...) are PDFs named like `Penal-Code-Consolidated2024.pdf`, consolidated
to 2024. Their source was never recorded and the naming matches lankalaw.net, a private
platform. The library shows "Source not recorded" for each.

> **DECISION: replace each with an official text plus its official amending Acts, one law
> at a time, before launch.** Replace before removing: the AI answers from these today.
> Replacing a 2024 consolidation with the 1980 text alone would make the AI *worse* (it
> would lose 1980-2024 changes), so each law's post-1980 amending Acts must be approved
> from the Parliament queue at the same time. Two were mislabelled and are fixed: "Act No.
> 24 of 2007" is the Computer Crime Act; "Act No. 24 of 2025" is the Social Security
> Contribution Levy (Amendment) Act, whose file is missing from disk.
>
> **Checked 2026-10-21, cover by cover:** only the Companies Act PDF carries Lanka Law's
> cover and logo; it is ARCHIVED (hidden from the library, still used by the AI). The other
> 11 carry no one's name but their source is still unknown; on the owner's decision they are
> ARCHIVED too (hidden from the library, still used by the AI until replaced). While hidden,
> the chat greeting does not name them and the AI's citations of them carry no library link. Companies Act No. 7 of 2007 is on Parliament's site.

### D7b. 🟠 Legal Library: scanned Acts, and a wrong PDF on Parliament's site

Older Acts on Parliament's site are scanned page images with no text: Penal Code
(Amendment) No. 22 of 1995 and No. 29 of 1998 are in the library as FAILED ("Could not
extract text from PDF"). **Fixed 2026-10-21:** ingestion now OCRs a PDF with no text
(`ocrmypdf`, installed on the Mac; on the server `apt install ocrmypdf`, see lawyer-rag
README), and a FAILED document has a Retry. Both are ACTIVE (47 and 10 sections). OCR text
can misread a word; the PDF readers open is still the original scan.

Parliament's entry for **Penal Code (Amendment) No. 32 of 1991 links the Telecommunications
Act No. 25 of 1991** (`3507.pdf`, 95 MB scan). Dismiss it; the real text must come from
another official source. Since 2026-10-21 an approval sends the Act's number and the AI
service refuses a PDF whose text does not mention it (`expect_text`, lawyer-rag ingest).
A scan cannot be checked this way until it is OCR'd.

### D7c. 🟡 The AI cannot answer basic Prescription questions (the 0.62 floor)

"How many years must a person possess land to claim it by prescription?" (s.3, ten years)
and "time limit on a written contract" (s.6) are refused as not found: the right sections
score 0.59-0.61, under `RETRIEVAL_MIN_SCORE` 0.62. Measured 2026-10-23 with the official
1980 text AND with the old consolidation: identical, so this predates the library work (the
config already notes prop-003, Prescription s.9, at 0.614). The old copy was removed again.

> **DECISION: re-run the golden evaluation set (E0) now that six laws have new texts, then
> decide the floor (or the hybrid keyword gate, config.py) on its numbers, not on one law.**

### D8. 🟠 Legal Library: no merged "current version" of each law

A reader who wants to know what the law says today has to open the original and apply
every amending Act in order. A merged text (original with every amendment applied) is
what people want, and private platforms offer it. The government publishes none for most
laws.

**Measured 2026-10-21, and why this is no longer "nice to have":** with an official base text
plus its amending Acts, the AI found a later rule when the amendment *substitutes* a whole
section (Penal Code s.364, 1995; Civil Procedure Code summons by e-mail, 2024). For the Motor
Traffic Act (1951 original + 19 amending Acts, no official consolidation; the main Act is
missing from CommonLII) it could not: asked for the drink-driving or no-licence penalty, it said
the penalty was not in what it holds, because the penalty sections were renumbered and rewritten
across many Acts. The unofficial consolidation was put back in the AI (archived, hidden from the
library) and answers correctly again. A law with many piecemeal amendments needs a merged text
for the AI to be reliable.

> **DECISION: launch with the original + amendments, all official PDFs. Add merged texts
> later, one law at a time, checked by someone qualified, and labelled "prepared by
> TheLawyr, not an official text".** One wrong merge shows a wrong law as current.

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

### E0. ✅ The golden evaluation set — **built 2026-09-13**, and it has already paid

76 questions in `lawyer-rag/eval/`, `python -m scripts.eval`. Two baselines recorded.
Stage 1.2 then used it to take `not_in_corpus` from **12.5% to 100%** and recall@k from
63.0% to 84.8%, with nothing regressing.

**It also found a live rule 6 violation in this product.** *"The company I am a director
of cannot pay its debts. Am I personally liable?"* was answered *"you may be personally
liable for the company's debts"* — and **neither** layer of `src/lib/ai/policy.ts` caught
it, so it reached the user. Fixed; `check:ai` is now 52, testing both sides of the line.

**E1 is now actionable**, which was the point: "use a more capable model" can finally be
tested rather than argued. `qwen3.5:9b` is pulled locally and the comparison is one
command.

### E0 (original entry). 🟠 No golden evaluation set — and it blocks E1

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
> *(Done 2026-09-13. The two paragraphs above record what it found.)*

### E0b. 🟠 A signed-out guest cannot hold a conversation — decide what to do

`/api/ai/ask` reads chat history from the database for a signed-in user only, so a guest's
every question is a first turn and `conversationId` comes back `null`. That is deliberate:
history read from the database cannot be fabricated by a client to steer the model.

The cost is that the guest chat is not a conversation. Ask a question, then ask "tell me
more about that", and the second question has nothing behind it. A user hit exactly this on
2026-09-13 and was told *"I could not find this in the legislation I hold"* — which was
false, and read as the assistant having lost the legislation it had just quoted.

The false message is fixed (`FOLLOW_UP_WITHOUT_CONTEXT` now says the true thing and invites
them to sign in). The underlying limitation is not.

> **DECIDED 2026-09-14 — (a), leave it.** The owner made the call: the guest chat stays a
> single-shot lookup and the honest `FOLLOW_UP_WITHOUT_CONTEXT` message does the work.
>
> The two roads not taken, recorded so the decision does not have to be re-argued:
> **(b)** store guest conversations server-side against a cookie id — a real conversation,
> but it needs a schema change, a retention rule and a privacy-notice line, because an
> anonymous chat about a legal problem is still personal data under the PDPA;
> **(c)** accept client-supplied history for guests — **never do this.** It reopens the
> exact steering risk the current design exists to close: a client that can fabricate
> history can walk the model past its own refusals.
>
> **Revisit at (b) if there is ever evidence guests want a conversation.** There is none
> today — one user hit the limitation once, and what they actually hit was the false
> message, which is fixed.

### E1. 🟠 Settle the AI model — **half done 2026-09-14**

The old version of this item said three files named three different models and nobody could
say which one answered a legal question. **That half is fixed.**

`LLM_PROVIDER` and `LLM_MODEL` in `lawyer-rag/.env` are now the only place either is named.
`config.py` reads them, `app/core/llm.py` builds the client, and an unknown provider or a
missing key is a **startup** failure in the gunicorn master rather than a failure on the
first question a user asks. `README.md` and `RUNNING.md` now read the name out of `.env`
rather than repeating it, so they cannot drift again.

**The other half — measuring — has not happened.** No candidate has been run against the
golden evaluation set. `qwen3.5:9b` was deferred (30–50 minutes of sustained local
inference, on a machine that was overheating), and the hosted provider has never answered
a single question, because there was no API key. `_build_google` is marked UNTESTED in its
own docstring. **Building the seam is not measuring the candidate**, and this project has
been bitten twice by work that existed with no caller.

The hosted provider is **Google Gemini**. Three preconditions before any real user reaches
it, none of which is code — they are set out in full in
`lawyer-rag/app/core/llm.py._build_google`:

1. **Check which Gemini tier the key is on.** Google's free API tier is documented as using
   submitted prompts to improve its products. That would make the text of real Sri Lankan
   legal questions into training data — a worse outcome than the LangSmith leak Stage 0
   closed, because that was *retention* by a vendor and this would be *absorption* into a
   model.
2. **A4 / counsel Q19** — the cross-border transfer basis is still unresolved.
3. **Record the sub-processor** in [DATA-INVENTORY.md](./restructure/DATA-INVENTORY.md) and
   disclose it in the privacy notice. Google is already a sub-processor here for OAuth and
   Maps, and that does **not** carry over: an email address for a login and the facts of
   someone's legal problem are different data for a different purpose.

> **DECISION: finish the measurement before choosing.** Commands are in
> [RAG-ROADMAP.md](../../lawyer-rag/docs/RAG-ROADMAP.md) §1.6. Running the 83-question set
> through a hosted candidate is fine today and needs none of the three preconditions above
> — they are authored test questions with no real person's data in them. **Measuring a
> candidate is not deploying it.**
>
> Read `RAG-REVIEW.md` §4.19 and §4.20 before trusting any comparison: the evaluation
> harness had two defects that would have corrupted this exact measurement, and it has a
> noise floor of about ±2 questions that had never been quantified.

### E1b. 🔴 Running on Gemini, against the measurement — two risks accepted 2026-09-19

Stage 1.6 measured `gemini-3.6-flash` twice against the 83-question golden set. It came out
**worse** than the `llama3.2:3b` it would replace: grounding 86.6% against 96.3%, 21.4% of
the section numbers it cites were never retrieved, and it is ~3× slower (14.4s vs 5.0s
median). Full numbers: [STAGE-1.6.md](../../lawyer-rag/eval/results/STAGE-1.6.md).

**The decision was nonetheless to stay on Gemini for now and defer the llama control run.**
That is the owner's call, made with the numbers in front of them, and it is recorded here
rather than argued again. Two consequences follow, and neither is resolved:

**(a) 🟠 The shipped system prompts have never been run against `llama3.2:3b`.**
The citation rules in `legal_agent.AGENT_SYSTEM_PROMPT` and `rag_chain.SYSTEM_PROMPT` were
tightened *because of* the Gemini result and measured only on Gemini. They are now the
prompts the product ships. Point `LLM_PROVIDER` back at `ollama` and the live system runs a
prompt nobody has measured on it. **A 20-question subset settles this in about five
minutes.**

**(b) 🔴 Gemini must not reach real users until three things are true**, none of which is
code. They are set out in full in `lawyer-rag/app/core/llm.py._build_google`:

1. **The key's tier is confirmed.** Google's free API tier is documented as using submitted
   prompts to improve its products — which would turn the text of real Sri Lankan legal
   questions into training data. Worse than the LangSmith leak Stage 0 closed: that was
   *retention* by a vendor, this would be *absorption* into a model.
2. **A4 / counsel Q19** — the cross-border transfer basis is unresolved.
3. **The sub-processor is recorded** in [DATA-INVENTORY.md](./restructure/DATA-INVENTORY.md)
   and disclosed in the privacy notice. Google is already a sub-processor here for OAuth and
   Maps; that does **not** carry over. An email address for a login and the facts of
   someone's legal problem are different data for a different purpose.

> **DECISION: acceptable while this runs on localhost with authored test questions. Not
> acceptable the day a real person asks it a real question.** Whichever way the model
> question finally lands, (b) is the blocker — and (a) is thirty minutes of work that
> removes an unknown from the system that is actually running today.

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
