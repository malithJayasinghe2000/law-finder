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

### 7. The firm is the service provider; we are software
Every client-facing artefact — engagement letter, fee note, confirmation — must make
clear the **firm** provides the legal service and the platform is only the software
it runs on. We are never a party to the retainer.

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
| **Firm SaaS** (anchor) | Per-seat/month, flat tiers | Software licence, decoupled from legal fees |
| **Practice add-ons** | Per-module | Doc automation, e-sign, time recording, court diary |
| **Corporate panel management** | Enterprise annual | Companies managing outside counsel. Highest ARPU, no ethics issue |
| **Consumer subscription** | B2C monthly | Legal library, templates, AI research. Selling information, not legal services |
| **Third-party advertising** | CPM / flat | **Non-lawyer advertisers only** |
| **Data & analytics** | Licence | Anonymised aggregate court/outcome trends |
| **CPD & events** | Per-seat / sponsorship | Natural BASL partnership surface |

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
| 6 | May the AI suggest *categories* of practitioner (e.g. "you need a labour lawyer") without that being a referral? | Phase 5 | Open |
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
- [ ] Ranking is neutral, disclosed, and independent of what a lawyer pays
- [ ] Every attorney/firm-describing payload obeys the [Rule 40 content limit](#the-rule-40-content-limit--binding-on-every-profile-surface) — no fees, no ratings, no marketing copy
- [ ] No red-flag phrase appears in code, strings, or UI
- [ ] Matter descriptions and lawyer-client messages are unreadable to platform staff
- [ ] AI surfaces carry the not-legal-advice notice and cite sources
- [ ] Client-facing artefacts name the **firm** as the service provider
- [ ] `npm run build` passes
