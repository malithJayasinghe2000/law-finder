# Legal Guardrails

> Not legal advice. A good-faith engineering interpretation, written so the product is
> defensible by design. Every phase needs BASL-member counsel sign-off before production.

These are hard constraints. Code that violates one does not ship, regardless of how
much product value it adds.

---

## The framework

| Source | What it governs | Why we care |
| --- | --- | --- |
| **Supreme Court Rules 1988** (conduct & etiquette of Attorneys-at-Law) | Fee-sharing, advertising, touting | The real regulator. Discipline runs through the Supreme Court under the **Judicature Act No. 2 of 1978**, not BASL |
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

---

## Review checklist

Before merging anything that touches booking, payments, advertising, ranking, or AI:

- [ ] No percentage of a legal fee flows to the platform, in any direction
- [ ] No client money touches a platform-controlled account or balance
- [ ] Nothing sells position, visibility, or leads to an attorney
- [ ] Ranking is neutral, disclosed, and independent of what a lawyer pays
- [ ] Matter descriptions and lawyer-client messages are unreadable to platform staff
- [ ] AI surfaces carry the not-legal-advice notice and cite sources
- [ ] Client-facing artefacts name the **firm** as the service provider
- [ ] `npm run build` passes
