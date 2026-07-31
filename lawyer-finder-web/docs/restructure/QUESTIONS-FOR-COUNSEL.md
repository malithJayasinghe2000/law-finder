# Questions for Counsel

**Purpose.** A single list to put in front of a BASL-member attorney once the
restructure is complete. Each item says what we built, why we believe it is
permissible, and exactly what we need confirmed.

**How to use this.** Take the whole document to counsel in one sitting. Record
their answer in the *Answer* column, date it, and update
[LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md) if anything they say changes a rule.

> Nothing in this repository is legal advice. It is an engineering interpretation
> of Sri Lankan professional-conduct rules, written to be defensible by design and
> explicitly built to be checked.

---

## Priority 1 — Blocks going live

These must be answered before any real client uses the platform.

### Q1. Is our revenue model free of fee-sharing?

**What we built.** The platform takes **no** percentage of any legal fee, in either
direction. The client pays the firm's quoted fee in full, directly to the firm's own
account. The platform never receives, holds, or routes that money. All commission
fields have been deleted from the database, not merely disabled.

Our revenue is intended to come from: flat per-seat software subscriptions billed to
firms, advertising sold to **non-legal** advertisers, consumer subscriptions for
legal information, and enterprise/corporate panel management.

**Why we believe this is permissible.** A flat software licence is not a share of a
legal fee, and is not contingent on whether or how much legal work is done.

**Confirm:**
- (a) Is a flat, per-seat software subscription billed to an attorney or firm free
  of the fee-sharing prohibition?
- (b) Does it matter that the subscription unlocks features which help the attorney
  obtain work?
- (c) Is there any pricing structure we should avoid even though it is flat — for
  example tiering by number of matters, or by firm revenue?

---

### Q2. Are we clear of the prohibition on advertising and touting?

**What we built.** Attorneys appear in a directory. Ranking is alphabetical and
filtered only on practice area and location. Nothing about position, visibility, or
prominence can be bought. The AI assistant returns attorneys on the same neutral
basis and does not receive or return subscription tier at all. Every listing carries
a visible notice that ordering is not influenced by payment and is not a
recommendation.

**Confirm:**
- (a) Is a neutral, non-purchasable directory listing of attorneys permissible?
- (b) May an attorney maintain a **profile page** (photo, practice areas, years of
  experience, languages, bio) on a third-party platform? What content limits apply?
- (c) Does the platform describing an attorney as "verified" (meaning we checked
  their BASL registration) create a problem?
- (d) `LawyerProfile.baseFeeRange` currently publishes an attorney's own stated fee
  range publicly. **Should we remove this?** We have flagged it internally as
  doubtful and are inclined to delete it.
- (e) We still hold a `Review` model with client star ratings. It is disabled but
  present. **Can attorney reviews/ratings ever be displayed publicly in Sri Lanka?**
  We assume not and plan to delete it — please confirm.

---

### Q3. Is our engagement letter adequate?

**What we built.** When a client accepts a fee quote, the system generates a letter
of engagement (`src/lib/consultations/engagementLetter.ts`). It records the parties,
the scope of work and exclusions, the fee basis and amount, payment terms, and
states explicitly that the **firm** provides the legal service while the platform is
only software. It covers confidentiality and privilege, data protection,
termination, and governing law. It is delivered electronically and downloadable.

**This wording was drafted by the engineering team, not by a lawyer.** It is the
single most important document in the system and a real client will rely on it.

**Confirm:**
- (a) **Please review and correct the wording in full.** We expect changes.
- (b) Does an electronically generated and accepted letter satisfy retainer
  formalities, relying on the Electronic Transactions Act No. 19 of 2006?
- (c) Is click-acceptance sufficient, or do we need a signature (typed, drawn, or
  certificate-based)?
- (d) Must the letter be issued *before* any advice is given, or is issuing it at
  the point terms are agreed sufficient?
- (e) Are there mandatory disclosures we have omitted — costs, complaints procedure,
  professional indemnity insurance, right to seek independent advice?
- (f) Should the letter be issued in Sinhala/Tamil where the client's chosen
  language is not English?

---

### Q4. Does our architecture preserve legal professional privilege?

**What we built.** The client describes their legal problem in an intake form. That
description, the lawyer's notes, the conflict-check record, and the engagement letter
are stored on infrastructure the platform operates. Platform staff (`ADMIN`) are
blocked in code from reading the matter description, lawyer's notes, conflict-check
contents, quotes, and engagement letters.

**Our concern.** Privilege under section 126 of the Evidence Ordinance protects
communications between client and attorney. We are a third party holding those
communications.

**Confirm:**
- (a) Does hosting privileged material as the firm's service provider risk waiving
  privilege?
- (b) Is a written data-processor agreement between the platform and each firm
  sufficient protection? Is there Sri Lanka-specific wording it must contain?
- (c) Are technical controls (access blocks, audit logging, encryption at rest)
  legally relevant, or is the contractual position what matters?
- (d) Does it change anything that the client writes their problem **before** any
  attorney has accepted them — i.e. before a retainer exists?
- (e) Are we obliged to be able to produce, or to be unable to produce, this material
  if served with a court order?

---

### Q5. Are we exposed on unauthorised practice through the AI assistant?

**What we built.** A retrieval-based chatbot answers general questions about Sri
Lankan law over a corpus of Acts, ordinances, and reported cases. Every AI surface
carries a visible notice that it is information only, not legal advice, and creates
no attorney-client relationship. It cites its sources.

**Confirm:**
- (a) Does providing general legal information to the public constitute practising
  law, or is the information/advice distinction recognised in Sri Lanka?
- (b) Is our disclaimer wording sufficient? Please correct it if not.
- (c) May the assistant tell a user what **category** of practitioner they need
  ("this sounds like a labour law matter") without that being a referral?
- (d) May it summarise what the law says about a user's described situation, or must
  it stay strictly general?
- (e) Who bears liability if the assistant is wrong and a user relies on it?

---

## Priority 2 — Needed before scaling

### Q6. Can the platform hold *any* role in payment?

**What we built.** The firm states its own bank details in the quote. The client pays
the firm directly and then records that they have paid. The firm confirms receipt.
The platform stores these records but never touches funds. We removed a payment
gateway and a withdrawal/escrow system that previously held client money.

**Confirm:**
- (a) Is recording payment details and confirmations — without ever holding funds —
  free of the client-account rules?
- (b) Would a payment gateway that settles **directly into the firm's own merchant
  account**, with the platform as technical facilitator only, be acceptable? This
  would materially improve the client experience.
- (c) May the platform host a **client-account ledger** for a firm — bookkeeping
  only, against the firm's own bank account — or does that imply control of client
  funds?
- (d) Where a consultation is cancelled, the firm owes the refund and the platform
  only records it. Is that the right allocation?

### Q7. Is our conflict-check design correct?

**What we built.** Before quoting, the attorney records a conflict-of-interest
screening: the parties screened, an outcome (clear / conflict found / unresolved),
and internal notes. A non-clear outcome declines the request automatically and tells
the client **only** that the firm is unable to act — never the reason, since that
belongs to the other client.

**Confirm:**
- (a) Is the screening record we capture adequate, or is more required?
- (b) Is telling the client only "the firm is unable to act" the correct disclosure?
- (c) How long must conflict records be retained?
- (d) For a **single consultation** (as opposed to ongoing representation), is a
  formal conflict check required, or is this heavier than the profession expects?

### Q8. What does the law firm structure need to look like?

**What we plan.** A `LawFirm` entity with members and roles (owner, firm admin,
attorney, paralegal). Solo practitioners become a firm of one. Firms hold their own
client account details and issue their own fee notes.

**Confirm:**
- (a) What entity forms may an attorney practise through in Sri Lanka? We understand
  incorporation of legal practice is not permitted and that practice is as sole
  practitioner or partnership — please confirm.
- (b) May non-attorney staff (paralegals, firm administrators) see matter details and
  handle client intake within the firm's account?
- (c) Must every matter be attributable to a named responsible attorney?
- (d) Does a firm listing itself on our platform raise any advertising issue that an
  individual listing does not?

### Q9. Are we compliant with the Personal Data Protection Act No. 9 of 2022?

**What we hold.** Client identity and contact details, their description of their
legal problem, matter records, and lawyer-client messages.

**Confirm:**
- (a) Is the platform a controller, a processor, or both — and does the answer change
  between our own account data and firms' matter data?
- (b) Must we register with the Data Protection Authority, and must we designate a
  Data Protection Officer?
- (c) What is the lawful basis for processing a description of a legal problem, and
  is it special-category data?
- (d) What retention periods apply, and do they conflict with professional
  record-keeping duties?
- (e) How do data-subject erasure rights interact with a firm's obligation to retain
  matter files?

### Q10. Our own tax position

**Confirm:**
- (a) VAT treatment and the current registration threshold for SaaS subscription
  revenue.
- (b) Whether SSCL applies to our revenue, and at what threshold.
- (c) Any digital-services levy affecting subscription or advertising revenue.
- (d) Withholding tax obligations on payments we make.

---

## Priority 3 — Future features to sanity-check

### Q11. Advertising to non-legal advertisers
We plan to sell ad space to banks, insurers, universities, and publishers on pages
that also list attorneys. Does an advertisement adjacent to attorney listings create
any problem for the attorneys shown?

### Q12. Pro bono / Legal Aid module
We would like to route qualifying users to free legal aid. Does operating such a
referral raise touting issues, even with no money involved?

### Q13. Court cause-list integration
We plan to ingest published court cause lists and match them to firms' matters for
reminders. Any restriction on republishing cause-list data?

### Q14. Corporate panel management
Companies managing their outside counsel through our software. Any professional-
conduct issue with a third party's software mediating a corporate client's
relationship with its panel firms?

### Q15. BASL relationship
We would like to approach BASL for a formal view or a memorandum of understanding
rather than waiting to be told we have a problem. Is that advisable, and what is the
right way to approach it?

---

## Answer log

| # | Question | Answer | Date | Counsel |
| --- | --- | --- | --- | --- |
| 1 | Fee-sharing / revenue model | | | |
| 2 | Advertising and touting | | | |
| 3 | Engagement letter | | | |
| 4 | Privilege | | | |
| 5 | AI and unauthorised practice | | | |
| 6 | Payment role | | | |
| 7 | Conflict checks | | | |
| 8 | Firm structure | | | |
| 9 | PDPA | | | |
| 10 | Tax | | | |
| 11 | Third-party advertising | | | |
| 12 | Pro bono module | | | |
| 13 | Cause lists | | | |
| 14 | Corporate panels | | | |
| 15 | BASL relationship | | | |
