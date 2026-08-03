# Legal Guardrails

> Not legal advice. A good-faith engineering interpretation, written so the product is
> defensible by design. Every phase needs BASL-member counsel sign-off before production.

These are hard constraints. Code that violates one does not ship, regardless of how
much product value it adds.

---

## The framework

| Source | What it governs | Why we care |
| --- | --- | --- |
| **Supreme Court Rules 1988** (conduct & etiquette of Attorneys-at-Law), **Rules 39–49** | Fee-sharing, advertising, touting | The real regulator. Discipline runs through the Supreme Court under the **Judicature Act No. 2 of 1978**, not BASL. Touting expressly includes *"engaging the services of a person for a commission to solicit clientele"* |
| **Supreme Court Rules 1988, Rule 40** | What an attorney may *display* | Permitted display is limited to: name of attorney/firm, professional qualifications, academic qualifications, office hours. This is a short list, and it is the content spec for every profile page we render |
| **Intermeddlers with Suitors Ordinance No. 11 of 1894** | Touting as a criminal offence | ⚠️ **Reaches the platform operator, not only the attorney.** This is the instrument that turns a design mistake from a client's disciplinary problem into our own criminal exposure |
| **BASL cautionary note, June 2021** | Legal advice via online/social platforms | BASL's position is that providing legal advice through an online platform constitutes touting. Directly relevant to the AI chatbot (rule 6) |
| **Bar Association of Sri Lanka (BASL)** | Professional ethics guidance | Influential professional body, not the statutory disciplinary authority. Partnership target, not regulator |
| Client-account rules for attorneys | Client money segregation | We must never hold funds owed to a lawyer for legal work |
| **Payments and Settlements Systems Act No. 28 of 2005** | Payment services | Holding/settling customer funds needs CBSL authorisation |
| **Financial Transactions Reporting Act No. 6 of 2006** | AML / KYC | Triggered if we handle funds |
| **Evidence Ordinance s.126** | Legal professional privilege | A third party in privileged comms can waive privilege |
| **Personal Data Protection Act No. 9 of 2022** | Data protection | Matter descriptions are highly sensitive personal data. DPA established, phased in |
| **Electronic Transactions Act No. 19 of 2006** | E-contracts, e-signatures | *Helps us* — makes digital engagement letters valid |
| **Consumer Affairs Authority Act No. 9 of 2003** | Consumer terms, pricing | Applies to our own consumer-facing terms |
| **Inland Revenue Act No. 24 of 2017**, **VAT Act No. 14 of 2002**, SSCL | Our own tax position | Platform revenue, not lawyer fees |
| **Notaries Ordinance** | Notarial practice, protocol/deed register | Relevant to notary features (`LawyerProfile.isNotary` exists today) |

---

## The seven hard rules

### 1. Never take a share of a legal fee
No commission, no percentage, no "platform fee" computed from the lawyer's fee — in
**either** direction. Invoicing the lawyer later instead of charging the client does
**not** fix it; a percentage of a legal fee reaching a non-lawyer is fee-sharing
regardless of which way the invoice points.

> Price on **seats and features**. Never on matters, leads, or fee value. The moment
> pricing correlates with how much legal work flows through the platform, it is
> fee-sharing again under a different name.

### 2. Never hold client money
No escrow, no platform balance, no withdrawal requests, no admin verifying payment
receipts. Fees go from the client to the **firm's own account**. The platform records
that a payment is *expected* and that the *firm marked it received* — nothing more.

### 3. Never sell position, visibility, or leads to a lawyer
No paid ranking, no "featured lawyer", no pay-per-lead, no pay-per-booking. Directory
ordering uses neutral criteria only, and the criteria are disclosed. Selling ad space
to **non-legal** advertisers (banks, insurers, publishers, universities) is fine;
selling it to attorneys is not.

### 4. Never let the platform choose the lawyer
The client chooses. Search and AI suggestions must rank on neutral, disclosed,
client-relevant criteria — **never** on subscription tier, spend, or rating. Log the
client's selection so we can always show the choice was theirs.

### 5. Protect privilege and confidentiality
The client's account of their legal problem is privileged. Platform staff — including
`ADMIN` — must not be able to read matter descriptions or lawyer-client messages.
Access is need-based, logged, and minimal. Our relationship to a firm is
**data processor**, formalised in writing (PDPA requires this anyway).

### 6. Never present the platform as giving legal advice
The RAG chatbot, the legal library, and every AI surface carry a clear, visible
notice: informational only, not legal advice, no attorney-client relationship formed.
AI answers cite sources. AI never tells a user what they should do in their own matter.

> **The line:** the assistant may explain the law; it may never advise anyone about
> their own case. Answering *about the law* is fine; answering *about your case* is not.
> Enforced in [`src/lib/ai/policy.ts`](../../src/lib/ai/policy.ts) — see
> [the AI rules](#ai-what-may-be-answered-what-must-be-refused) below.

### 7. The firm is the service provider; we are software
Every client-facing artefact — engagement letter, fee note, confirmation — must make
clear the **firm** provides the legal service and the platform is only the software
it runs on. We are never a party to the retainer.

---

## Advertising — who may buy, and where

Added 2026-08-03, Phase 4.

**No attorney, law firm, or seller of legal services may buy visibility on this
platform.** Selling an attorney a promoted slot makes us the mechanism of their
breach of Rules 39–49, and touting reaches the *intermediary* criminally under
the Intermeddlers with Suitors Ordinance No. 11 of 1894.

This is enforced structurally, not procedurally: `AdCampaign` belongs to an
`Advertiser` and has **no relation to `LawyerProfile` or `LawFirm` at all**. A
lawyer cannot buy an advert because the schema gives them nowhere to be.

### Who may advertise

| ✅ Permitted | ⛔ Refused, by category |
| --- | --- |
| Banks and finance companies | Attorneys, law firms, chambers |
| Insurers (general, life, motor) | Legal consultants and consultancies |
| Universities and education providers | Claims-management and accident-claims companies |
| Publishers and media | Document-drafting and deed-writing services |
| Technology and software vendors | Legal-expenses insurance |
| Healthcare, real estate, retail | Litigation funders |
| Government and NGOs | Debt-recovery agencies |
| Non-legal professional services (accountancy, translation, surveying) | Anything else selling legal advice or representation |

"Not an attorney" is not sufficient. The refused column contains businesses that
either practise law without a licence or channel work toward those who do — and
we would be the channel. They are refused **by category**, because judging them
one at a time is where mistakes happen.

**The gate is a person, not a flag.** `Advertiser.nonLegalConfirmed` records that
a named `ADMIN` positively confirmed this organisation is none of the above, with
the date. No campaign runs without it — checked at review, at campaign creation,
and again at serve time.

### Where advertising may appear

Editorial surfaces only — pages a person reads for information:

✅ Homepage banner · blog · blog post · legal library · AI chat sidebar

⛔ **Never** the attorney directory, the firm directory, any profile page, the
engagement flow, or any dashboard. The `DIRECTORY_TOP` and `DIRECTORY_INLINE`
placements were deleted from the `AdPlacement` enum in Phase 4 rather than merely
deactivated, so restoring them takes a migration and a conversation instead of a
toggle in an admin screen.

An advert inside a list of practitioners teaches a client that position in that
list is purchasable, and blurs an advertisement into a listing. That is true
whoever bought it.

### How adverts must look and behave

- Labelled **"Advertisement"** — not "Sponsored", which reads as editorial
  endorsement. The label is visible without hovering.
- Never shaped like a listing or profile card. The unit Phase 4 removed was an
  attorney's profile card with a star on it; that shape is the anti-pattern.
- Always links **outward** to the advertiser's own site, with `rel="sponsored"`.
  An advert never navigates a person deeper into this platform, because the only
  thing it could point at here is a lawyer.
- **Never targeted on matter data.** Targeting may use the *page*; it may never
  use anything derived from what a client wrote about their legal problem. That
  is privileged material, and selling adverts against it would breach rule 5 and
  the PDPA at once.

Enforced in [`src/lib/ads/eligibility.ts`](../../src/lib/ads/eligibility.ts).

---

## AI — what may be answered, what must be refused

Added 2026-08-03, Phase 5.

**The assistant explains what the law says. It never advises anyone about their own
case.** Giving legal advice without being an admitted Attorney-at-Law is unauthorised
practice, and BASL's cautionary note of June 2021 treats legal advice delivered
through an online platform as **touting** — which lands in the Intermeddlers with
Suitors Ordinance No. 11 of 1894, where the offence is criminal and reaches the
intermediary.

Every other guardrail here is enforced by structure: there is no commission column,
an `AdCampaign` has nowhere to attach a lawyer, directory ad placements are not
expressible in the enum. **The AI is the one surface where a violation is produced at
runtime, per answer, by a generative model.** Schema cannot prevent it, and neither
can a prompt — an instruction a model ignores fails silently. So the rule runs as
code, on the server, after generation and before the user sees a character.

### Where it is enforced

| Layer | What it does | Trust |
| --- | --- | --- |
| [`src/lib/ai/policy.ts`](../../src/lib/ai/policy.ts) | The rule. Classifies the request, evaluates the answer, resolves citations | **This is the guardrail** |
| [`/api/ai/ask`](../../src/app/api/ai/ask/route.ts) | The only route that produces an AI answer. Applies the policy | The only path |
| `lawyer-rag` prompts | Asks the model to behave | Defence in depth only |
| `npm run check:ai` | Asserts the rules against 49 cases | Run after any policy change |

The browser must never call a model service directly. Until Phase 5 the chat page
fetched the RAG service on a `NEXT_PUBLIC_` URL, which made every rule below
unenforceable and every stored transcript a claim the client made about itself.

### Refused before the model is called

So that the user's account of their own problem is never transmitted at all:

| Category | Example |
| --- | --- |
| `OWN_MATTER_ADVICE` | "My landlord kept my deposit, what should I do?" · "Do I have a case?" |
| `OUTCOME_PREDICTION` | "Will I win?" · "What are my chances?" |
| `DOCUMENT_DECISION` | "Should I sign this?" · "Is this contract fair?" |
| `REPRESENTATION_REQUEST` | "Recommend a lawyer" · "Which attorney should I hire?" |

### Withheld after the model has answered

The answer is withheld **whole**, never edited — rewriting a model's legal prose to
make it compliant means authoring legal content by hand, which is the thing rule 6
exists to stop.

| Category | What trips it |
| --- | --- |
| `ADVICE_IN_ANSWER` | "In your case…" · "you have been unfairly dismissed" · a numbered plan of action |
| `PRACTITIONER_STEERING` | "I'd recommend consulting **a Property Lawyer**" · "lawyers on our platform" |
| `UNSUPPORTED_CITATION` | Naming an Act in the prose that retrieval never returned |
| `NO_CITABLE_SOURCE` | A legal answer with nothing behind it |

**Nothing streams.** A streamed answer has been read by the time it can be checked,
which makes the check theatre.

### Citations

- A citation comes from **retrieval metadata, never the model**, so the model cannot
  invent an entry in the list. What it *can* invent is a mention in the prose, which
  is why the prose is checked against what was actually retrieved.
- A citation that resolves to a `LegalDocument` links to it. One that does not is
  shown as text and **not given a link that goes nowhere** — a citation the reader
  cannot open manufactures authority.
- A chunk index (`Chunk_1`) is not a section reference and is never displayed as one.
- **Web search results are not legal authority** and are no longer requested. An
  answer grounded in a search result cannot be cited to legislation, so it would be
  withheld regardless.

### The AI never surfaces a practitioner

Not by name, not by category, not by inference from what the user described. The
`suggest-lawyers` route is deleted, the `lawyerSuggestions` column is dropped, and
the RAG service's practice-area detection and lawyer-recommendation tools are gone.

This is the conservative answer to **counsel question 6**, taken rather than deferred:
if suggesting a *category* of practitioner turns out to be permissible, restoring it
is a feature; if it is not, we never did it. The replacement is a standing link to the
alphabetical directory that is identical for every user and unaffected by anything
they typed — the user navigating, not the platform channelling.

### Confidentiality

Nothing from a matter — no `Booking.description`, subject, conflict-check note, quote,
or engagement letter — reaches the model. There is deliberately **no parameter through
which it could**: `buildModelContext()` takes a question and this chat's own history,
and nothing else. Matter-scoped AI is a Phase 7 item and needs its own design
(firm-scoped context, processor agreement, counsel question 4) before a single field
crosses that line.

Guest questions are never stored. Signed-in conversations are kept for 180 days from
last use and purged by `npm run ai:purge`.

---

## The directory question — our largest unresolved risk

Added 2026-08-01, Phase 2. **Read this before adding any public-facing surface that
lists attorneys or firms.**

The seven rules above assume a **neutral, disclosed directory is permissible** — that
what the advertising rules forbid is *paid* prominence, not listing as such. That
assumption has never been tested, and there is a serious argument the other way:

- Under the **Intermeddlers with Suitors Ordinance No. 11 of 1894**, touting is a
  criminal offence and is **not limited to attorneys** — it reaches the intermediary.
  A platform that channels clients toward practitioners is squarely within the
  intermediary role the Ordinance describes.
- India's Bar Council Rule 36 is closely comparable to Rule 39. Indian courts have
  held that *any structure designed to channel clients toward particular lawyers —
  even algorithmically — is a form of indirect solicitation*, **expressly including
  search-based filtering across lawyers**. The BCI issued cease-and-desist notices to
  consumer lawyer platforms on this basis.
- Sri Lanka did **not** adopt India's 2008 relaxation permitting informational lawyer
  websites. On the face of the instruments, **Sri Lanka is stricter than India.**

We are not resolving this by reasoning. It goes to counsel as questions 16–18 in
[QUESTIONS-FOR-COUNSEL.md](./QUESTIONS-FOR-COUNSEL.md).
Until it is answered, the directory is built to the most conservative reading that
still leaves the product working:

### The Rule 40 content limit — binding on every profile surface

Any page, API payload, RSC payload, or ad unit that describes an attorney or a firm
may carry **only**:

| ✅ Permitted | Basis |
| --- | --- |
| Name of the attorney or firm | Rule 40 |
| Professional qualifications (Attorney-at-Law, BASL number, notary status) | Rule 40 |
| Academic qualifications | Rule 40 |
| Office hours | Rule 40 |
| Contact details and office address | Necessary to contact a practitioner |
| Practice areas, courts, languages, district | Factual, client-relevant, neutral — needed for the client to make their own choice |
| Years admitted | Factual and verifiable |

| ⛔ Forbidden | Why |
| --- | --- |
| Fee ranges, price indications, "from LKR X" | Not in Rule 40; reads as advertising |
| Star ratings, review counts, scores, grades, tiers | Rule 3 and 4; unfair attraction under Rule 39 |
| "Top", "featured", "recommended", "best match", "popular" | Touting |
| Marketing or promotional free text | Beyond Rule 40's list |
| Badges other than a neutral factual verification state | Implied platform endorsement |
| Any ordering derived from subscription, spend, rating, or platform judgement | Rule 3 and 4 |

> **The design test.** Before shipping any directory, profile, or assignment screen:
> *"Does this screen make the client more likely to choose one particular attorney
> for a reason that came from us rather than from them?"* If yes — or if you are
> unsure — it does not ship.

### The red-flag phrases

If any of these appear in a ticket, component name, string file, or design, stop and
escalate rather than implementing:

```
recommended lawyer  ·  suggested counsel  ·  best match   ·  top rated
featured lawyer     ·  promoted firm      ·  boosted      ·  sponsored listing
referral fee        ·  per lead           ·  commission   ·  finder's fee
```

### The safer business, for the record

The research in `PROJECT-PLAN.md` at the repository root describes the same market
approached from the other end: a **B2B system of record** where companies manage law
firms they have *already* retained. No directory, no consumer users, no introduction
— and therefore no touting question at all. Provakil (India) and LawVu (New Zealand)
built real businesses on exactly that shape with no regulatory friction.

That is a different product with a different buyer, not a refactor of this one. But
if counsel comes back badly on questions 16–18, it is the escape route, and Phase 2's
firm entity is the bridge to it: once a `LawFirm` exists and matters route through
it, the consumer directory becomes a removable front end rather than the foundation.

---

## Revenue model

### Prohibited
- Commission on consultation or legal fees
- Pay-per-lead / pay-per-booking / pay-per-introduction
- Paid ranking, featured placement, or visibility sold to attorneys
- Escrow, platform-held balances, withdrawals
- Client-side "platform fee" charged on top of the lawyer's fee

### Permitted
| Stream | Model | Why it is clean |
| --- | --- | --- |
| **Firm SaaS** (anchor) | Per-seat/month, flat tiers | Software licence, decoupled from legal fees. The subscription belongs to the `LawFirm`, and a seat is a person who can sign in — see [seats and fee notes](#seats-and-fee-notes) |
| **Practice add-ons** | Per-module | Doc automation, e-sign, time recording, court diary |
| **Corporate panel management** | Enterprise annual | Companies managing outside counsel. Highest ARPU, no ethics issue |
| **Consumer subscription** | B2C monthly | Legal library, templates, AI research. Selling information, not legal services |
| **Third-party advertising** | CPM / flat | **Non-lawyer advertisers only.** Implemented in Phase 4 — see [the advertising rules](#advertising--who-may-buy-and-where) |
| **Data & analytics** | Licence | Anonymised aggregate court/outcome trends |
| **CPD & events** | Per-seat / sponsorship | Natural BASL partnership surface |

---

## Seats and fee notes

Added 2026-08-03, Phase 3.

### The licence belongs to the firm, and a seat is a person

`Subscription` hangs off `LawFirm`, not `LawyerProfile`. An attorney does not buy
a licence to get work; the practice buys software and its members' access follows
from membership of it. Resolution lives in
[`src/lib/firms/billing.ts`](../../src/lib/firms/billing.ts) — do not query
`prisma.subscription` by hand in a route.

**A seat is an `ACTIVE` `FirmMember`: a person who can sign in.** Counting only
attorneys would let a firm add unlimited paralegals free, and they use the
software just as much.

> **The test, whenever you are asked to meter something new: does the number
> count software, or clients?** Seats, storage and templates are software.
> Enquiries, messages, matters, introductions and conversations are clients, and
> none of them may ever be metered. Revenue that moves with the volume of legal
> work is fee-sharing whichever way the invoice points.

Phase 2.5 deleted `inquiries_per_month` and `chat_messages_per_month` from the
tiers for this reason. Phase 3 found the same defect still live in a second
place: an attorney without a plan saw only their five oldest client conversations
and the rest read *"Locked Conversation — Please upgrade to view this
conversation."* That withheld a client's own message from their own lawyer over
an unpaid software bill. Removed.

A seat limit refuses a **person**, never a matter. A firm on one seat may run a
thousand matters; it just does so with one login.

### Fee notes — the firm's invoice, our document

`FeeNote` is the firm billing **its own client** for legal work. Do not confuse
it with `Invoice`, which is us billing a firm for software.

The firm supplies the legal service, so the firm is the taxable person: it bills
under its own TIN and VAT registration and the client pays the firm's own bank
account directly. **We render a document; we are not in the transaction.** Both
halves matter — holding or settling other people's money needs CBSL
authorisation under the Payments and Settlements Systems Act No. 28 of 2005, and
taking a cut of a legal fee is fee-sharing under Rules 39–49.

- **There is no platform-fee column and no commission column on `FeeNote`.** Not
  a nullable one, not one defaulting to zero. If you are asked to add one, that
  is the restructure being undone.
- The rendered note is **snapshotted at issue**, like the engagement letter. A
  fee note is a tax document; if the firm later renames itself, an issued note
  must still say what it said that day.
- Numbers are sequential per firm per year (`FN-2026-0001`). A cancelled note
  **keeps its number** — a gap in the series is a question the firm would have to
  answer to a tax officer.
- **"Record as paid" records; it does not verify.** The firm asserts the money
  arrived. There is no admin approval anywhere in the flow, because we did not
  see the payment and cannot honestly attest to it.
- Platform staff cannot read a fee note. It names the client and narrates the
  work done, which is privileged under Evidence Ordinance s.126 — and what a firm
  charges its clients is not our business when our revenue is a flat licence fee.

Asserted by `npm run check:billing` (17 cases, against a real database).

---

## Open questions for counsel

Track answers here as they come in. Do not build on an unanswered question.

| # | Question | Blocks | Status |
| --- | --- | --- | --- |
| 1 | Is a **flat, uniform** directory listing fee (every verified attorney appears, neutral ranking) permissible, or does any payment-for-listing offend the advertising rule? | Phase 3 pricing | Open — *our recommendation: list free, don't take the risk* |
| 2 | How far does the advertising rule extend to a **firm's own profile page** on a third-party platform? Content limits? | Phase 2, Phase 4 | Open |
| 3 | Can a lawyer-facing **e-signature / engagement letter** generated by our software satisfy retainer formalities under ETA 2006? | Phase 1 | Open |
| 4 | Does a **data-processor agreement** adequately preserve privilege where we host matter data? Any Sri Lanka-specific requirement beyond PDPA? | Phase 6 | Open |
| 5 | Is a platform-hosted **client-account ledger** (record-keeping only, firm's own bank) acceptable, or does it imply control of client funds? | Phase 3 | Open |
| 6 | May the AI suggest *categories* of practitioner (e.g. "you need a labour lawyer") without that being a referral? | Phase 5 | Open — **we took the conservative answer: it does not.** The AI surfaces no practitioner by name or category. Answer only affects whether we could relax this |
| 7 | Confirm current **VAT / SSCL** treatment of SaaS revenue and any digital-services levy | Phase 3 | Open |
| 8 | Does a **public directory of attorneys**, listing every verified practitioner on neutral disclosed criteria with no payment for position, constitute advertising or touting under Rules 39–49? | The whole consumer product | Open — **highest priority.** See [the directory question](#the-directory-question--our-largest-unresolved-risk) |
| 9 | Does the **Intermeddlers with Suitors Ordinance No. 11 of 1894** create criminal exposure for the *platform operator* on the current design? | The whole consumer product | Open — **highest priority** |
| 10 | Is **client-driven search and filtering across attorneys** (practice area, district, language) indirect solicitation, as Indian courts have held of the comparable BCI rule? | Directory, AI suggestions | Open — **highest priority** |
| 11 | Within a firm, may **non-attorney staff** (paralegals, firm administrators) read matter descriptions and conflict-check records? | Phase 2 privilege scope | Open — *our default: no, attorneys and firm owners/admins only* |

---

## Review checklist

Before merging anything that touches booking, payments, advertising, ranking, or AI:

- [ ] No percentage of a legal fee flows to the platform, in any direction
- [ ] No client money touches a platform-controlled account or balance
- [ ] Nothing sells position, visibility, or leads to an attorney
- [ ] Every advert belongs to a `nonLegalConfirmed` advertiser, sits on an editorial surface, is labelled, and links outward
- [ ] Ranking is neutral, disclosed, and independent of what a lawyer pays
- [ ] Every attorney/firm-describing payload obeys the [Rule 40 content limit](#the-rule-40-content-limit--binding-on-every-profile-surface) — no fees, no ratings, no marketing copy
- [ ] No red-flag phrase appears in code, strings, or UI
- [ ] Matter descriptions and lawyer-client messages are unreadable to platform staff
- [ ] AI surfaces carry the not-legal-advice notice and cite sources
- [ ] Every AI answer passes `src/lib/ai/policy.ts` server-side; no browser calls a model
- [ ] No AI surface names or suggests a practitioner
- [ ] `npm run check:ai` passes
- [ ] Nothing meters clients, matters, enquiries, messages or conversations
- [ ] No fee note carries a platform fee, commission, or any share to us
- [ ] `npm run check:billing` passes
- [ ] Client-facing artefacts name the **firm** as the service provider
- [ ] `npm run build` passes
