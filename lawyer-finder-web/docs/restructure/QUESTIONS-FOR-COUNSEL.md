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

**Updated 2026-08-16, Phase 7 — we built the encryption without waiting on 4(c).**

Phase 6 deferred encryption at rest pending your answer to 4(c). We have now built it,
on the reasoning that the PDPA imposes a security duty on us as processor independently
of privilege — so 4(c) changes how much *credit* the work earns, not whether it was
worth doing. Where we were unsure we took the restrictive option:

- The client's account of their problem, the conflict-check record, the quoted scope,
  the engagement letter and every client↔attorney message are encrypted with AES-256-GCM,
  bound to their own row and column. Platform staff receive a withheld marker — never
  the ciphertext.
- **Fee notes are deliberately NOT encrypted.** A fee note is a tax document the firm
  can be compelled to produce over a statutory retention period, and making it depend on
  our key custody trades a confidentiality risk for a compliance failure the firm cannot
  argue its way out of. We would rather you told us we were wrong about that than
  discover it when a tax officer asks.
- Message threads are readable by their participants only — not by the firm's principal,
  who *can* read the matter file. See (g) below.

**Still to confirm, in addition to (a)–(e):**
- (f) **Does encryption at rest, with platform staff structurally unable to obtain
  plaintext, actually help the privilege analysis** — or is the contractual position
  (the processor agreement) doing all the work?
- (g) We made message threads readable by **participants only**, deliberately narrower
  than the matter file, which the firm's principal can read. Our reasoning was that a
  principal needs the file to reassign a matter but does not need to read a conversation
  that has already happened, and that every extra reader is another person an opponent
  can name to argue waiver. **Is that the right line, or does a principal's supervisory
  duty require access to their firm's client correspondence?** If it does, we have made
  supervision harder than the profession expects.
- (h) **We hold the decryption key.** If served with a court order we can produce this
  material. Should the architecture instead be one where we *cannot* — client-held keys,
  with the consequence that we could not restore a firm's file after a key loss? This
  is (e) asked as an engineering question, and the answer changes the design.
- (i) **Key loss destroys the data.** Is there a professional-conduct problem with a
  firm's matter file being unrecoverable if a software supplier mislays a key, and does
  that need to be disclosed in the processor agreement?

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

**Updated 2026-08-03, Phase 5 — what we have now done, pending your answer.**

We did not wait on (c) and (d). Where we were unsure we took the restrictive option,
because it is cheap to relax and expensive to have got wrong:

- **(c) — we assume the answer is no.** The assistant now suggests **no practitioner
  at all**: not a named attorney, not a firm, and not a category such as "you need a
  labour lawyer". It previously did all three, generating "I'd recommend consulting
  **a Property Lawyer**... I've found some matching lawyers on our platform below"
  from what the user had described about their own problem. If you tell us category
  suggestion is permissible, restoring it is a small change. If you tell us it is not,
  we never did it.
- **(d) — we assume it must stay strictly general.** The assistant answers about the
  law and refuses to apply it to the user's facts. Requests for advice on the user's
  own matter are declined *before* the question reaches any model; answers that stray
  into advising are withheld after generation rather than edited.

Enforced in code, server-side, and asserted by `npm run check:ai` (49 cases).

**Still to confirm, in addition to (a), (b) and (e):**
- (f) Our refusal line is: *the assistant may explain the law, but never advise on the
  user's own case.* Is that the right line, and is it drawn in the right place? A
  worked example either side of it would be more useful to us than a general
  statement.
- (g) When the assistant declines, it says the choice of attorney is the user's and
  points at the alphabetical directory. Is pointing at the directory *at that moment*
  — immediately after someone has described a legal problem — itself a channelling
  act, even though the link is identical for every user and unaffected by anything
  they said? If so the refusal must not mention the directory at all.
- (h) **The refusals are English-only.** The platform ships Sinhala and Tamil locales,
  and a question asked in either language bypasses the pre-generation check entirely;
  the post-generation checks are English-only too. We would rather fix this with
  translated rules reviewed by someone who knows the terminology than with more
  pattern-matching by us. Is an assistant that enforces its limits in only one of
  three offered languages defensible in the interim, or must the non-English locales
  be closed until it is fixed?
- (i) We keep a record of every refusal and its category. Is that record helpful
  evidence of compliance, or does it create a discoverable log of the moments people
  asked for advice and were turned away?

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

**Updated 2026-08-16, Phase 7 — we built firm registration.** Until now a multi-partner
firm had no way to join: one partner registered as an individual, a firm of one was
created and named after them, and they renamed it and added partners one at a time.
There is now a registration flow with invitations. The positions we took:

- **(a) — we assume sole practitioner or partnership only.** `FirmType` has no company
  option and the registration form says why.
- Only a **verified Attorney-at-Law** can register a practice or hold a partner or
  attorney role. A practice manager or paralegal need not be admitted.
- An attorney **holding open matters cannot move practice** until they are closed or
  reassigned, because the client engaged the firm and moving the file would change who
  they are retained by without telling them.
- Registration **converts the founder's existing firm** rather than creating a second
  one, so matters, licence and invoices stay attached.

**Still to confirm, in addition to (a)–(d):**
- (e) **Is our "cannot move practice while holding open matters" rule right, or heavier
  than the profession expects?** In practice an attorney changing firms surely does move
  live matters, with the client's consent. Should we build a client-consent step instead
  of a hard refusal? If so, what does the client have to be told?
- (f) When an attorney leaves a practice, **who owns the matter file** — the firm, the
  attorney, or the client? We have assumed the firm, which is why a departing attorney
  loses access to both the file and the conversation about it.
- (g) A registered practice is **not listed publicly until we have verified it**. What
  should verification of a *firm* actually consist of, as distinct from verifying an
  individual attorney's BASL registration?

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

**Updated 2026-08-03, Phase 6 — what we have now built, pending your answers.**

We wrote a full data inventory (`docs/restructure/DATA-INVENTORY.md`), a retention
schedule with an automated purge, subject-request endpoints, an access log over matter
data, and consent capture. Where the answer was unclear we took the restrictive option:

- **(a) — we assume BOTH.** We treat ourselves as **controller** for account, profile, AI
  and community data, and as **processor** for everything under `Booking`. The two roles
  are tagged in code and the purge structurally refuses to touch firm-controlled data.
- **(c) — we assume matter data is NOT consent-based.** It is processed to perform the
  retainer and meet your professional duties. Consent is used for three things only:
  marketing email, product analytics, and keeping AI chat history.
- **(e) — we assume a firm's retention duty outweighs an erasure request.** An erasure
  anonymises the account and deletes what we control, and reports itself as **partial**.
  The matter file is referred to the firm to decide.

**Still to confirm, in addition to (a)–(e):**
- (f) Is "controller for our own data, processor for matter data" the correct
  characterisation, or are we a joint controller for some of it?
- (g) **Must we register with the Data Protection Authority, and must we appoint a DPO?**
  We have appointed nobody. If it is required, we need to know now.
- (h) We keep an access log recording who read a matter description, with **no copy of the
  content**. Is that record helpful evidence of compliance, or does it create a
  discoverable log of who looked at what and when?
- (i) A subject-access request currently returns **nothing from the matter file**, and
  names the firm to ask instead. Is that the right allocation, or must we produce it?
- (j) We hold `LawyerProfile.nic` and images of identity and practising certificates. Is
  that special-category data, and is verification the right lawful basis?

---

### Q19. Cross-border transfer of personal data

**Added 2026-08-03, Phase 6.** The PDPA restricts sending personal data outside Sri Lanka,
and two flows in this system may do so without any documented basis:

1. **Database hosting.** Development runs on local Postgres, but `.env` carries a
   commented-out **Neon** URL in `us-east-1`. If production uses it, *everything* in the
   inventory — including privileged matter data — is stored outside Sri Lanka.
2. **The AI model.** Questions typed into the assistant are forwarded by our retrieval
   service to a model provider. No matter data travels this path by construction, but the
   user's own description of their situation does.

**Confirm:**
- (a) May personal data — and specifically **privileged** matter data — be stored on
  infrastructure outside Sri Lanka? On what basis, and with what documentation?
- (b) Does hosting privileged material abroad affect **privilege** as distinct from data
  protection? (Related to Q4.)
- (c) Do the answers differ for the AI questions, where no attorney-client relationship
  exists?
- (d) Must a firm using our software be told where its client data is stored, and must it
  consent?

---

### Q10. Our own tax position

**Confirm:**
- (a) VAT treatment and the current registration threshold for SaaS subscription
  revenue.
- (b) Whether SSCL applies to our revenue, and at what threshold.
- (c) Any digital-services levy affecting subscription or advertising revenue.
- (d) Withholding tax obligations on payments we make.

---

### Q9(f)–(j). The privacy notice, consent evidence, and who answers a request — added Phase 8

**What we built.** A versioned privacy notice: publishing writes a new version and
supersedes the old one, every version keeps a permanent public URL, and a published
version can never be edited or deleted. Each `ConsentRecord` stamps the version in force
at that moment, so the exact wording a person agreed to can always be produced. Consent
**fails closed** — if no notice is published we refuse to record a *grant*, though never a
withdrawal. A "your data" screen lets a person see what we hold, toggle the three
consents, export, correct, and request erasure. Where a request touches matter data we
refer it to each firm, and the firm records its own decision, which we relay to the person
verbatim.

**Confirm:**
- (f) Does a versioned notice, with the version stamped on each consent record and the
  document permanently retrievable, satisfy the PDPA's requirement that consent be
  **demonstrable**? Is anything else needed — a copy of the rendered document per consent,
  a signature, an IP/timestamp beyond what we hold?
- (g) Is **21 days** an appropriate service standard for answering a subject request? We
  set it deliberately below any statutory maximum so a slipping request is visible before
  it is late in law — but we would like the statutory figure confirmed.
- (h) Is our **referral model** the correct allocation? For matter data we tell the person
  which firm holds it, pass the request to that firm, and publish the firm's own answer to
  them. We do not decide, because we are the processor. Is anything more required of us —
  and is it acceptable that the platform relays the firm's words rather than the firm
  contacting the person directly?
- (i) Our erasure is **anonymisation**: the `User` row survives with identifying fields
  overwritten, because matters reference the client for years. Is that a lawful erasure
  under the PDPA, and is naming the retained models with the duty for each one a
  sufficient response?
- (j) The notice says plainly that we have **not yet designated a data protection
  officer** and that cross-border hosting is unsettled (§8). Is stating an unresolved
  position in a published notice the right course, or does either of those need to be
  resolved before the platform holds a real client's matter?

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

## Priority 0 — Existential. Ask these first.

> Added 2026-08-01 during Phase 2. Q2 above asks whether our directory is
> *permissible in its details*. Q16–Q18 ask the prior question: **whether a
> consumer-facing directory of attorneys may lawfully exist at all**, and whether
> operating one exposes the platform's directors to criminal liability rather than
> exposing listed attorneys to disciplinary action.
>
> We have designed to the most conservative reading we can while keeping the product
> working (see the Rule 40 content limit in LEGAL-GUARDRAILS.md), but this is not a
> question engineering can answer. **If the answer to Q16 or Q17 is unfavourable, the
> consumer product must be withdrawn, not adjusted.**

### Q16. May a public directory of attorneys lawfully exist?

**What we built.** A public, searchable directory of verified Attorneys-at-Law.
Listing is free and open to every verified attorney. Ordering is alphabetical.
Nothing about position, visibility or prominence can be purchased. Filtering is on
practice area, district and language — criteria supplied by the client, not by us.
Profiles are limited to the Rule 40 content list plus factual practice information.

**Why we believed this is permissible.** We read Rules 39–49 as prohibiting *paid*
prominence and self-promotion, not the existence of a neutral list.

**Why we are no longer confident.** Rule 40 specifies what an attorney may display in
narrow terms — name, professional qualifications, academic qualifications, office
hours — which reads as an exhaustive permission rather than a floor.

**Confirm:**
- (a) May a third-party platform publish a directory of attorneys at all?
- (b) If yes, is Rule 40's list exhaustive as to profile content, or may factual
  practice information (practice areas, courts, languages, years admitted) also
  appear?
- (c) Does it matter that listing is free, universal, and unpurchaseable?
- (d) Does the attorney's own consent to being listed change the analysis?

### Q17. Does the Intermeddlers with Suitors Ordinance No. 11 of 1894 apply to us?

**Why we are asking.** Our guardrails were written around attorney *discipline* — the
risk to the practitioners listed. We have since understood that touting under the
1894 Ordinance is a **criminal offence** and is not confined to attorneys; it can
reach an intermediary who channels work to practitioners.

**Confirm:**
- (a) Does the Ordinance apply to a software platform operator that publishes a
  directory and transmits client enquiries to attorneys?
- (b) Is the analysis changed by the fact that **no attorney pays us anything for
  visibility, position, or introductions**, and no fee is charged per enquiry?
- (c) Does taking any payment at all from an attorney — including a flat SaaS licence
  for practice-management software — affect the position?
- (d) What is the exposure of the platform's directors personally?

### Q18. Is client-driven search across attorneys "indirect solicitation"?

**Why we are asking.** India's Bar Council Rule 36 is closely comparable to Rule 39.
Indian courts have held that any structure channelling clients toward particular
lawyers — even algorithmically — is indirect solicitation, expressly including
search-based filtering across lawyers, and the BCI issued cease-and-desist notices to
consumer lawyer platforms. Sri Lanka did not adopt India's 2008 relaxation permitting
informational lawyer websites.

**Confirm:**
- (a) Is Indian authority on BCI Rule 36 of any persuasive value here?
- (b) Does a client typing their own filter criteria (practice area, district,
  language) and receiving an alphabetical list constitute solicitation by us?
- (c) Does our AI assistant naming attorneys practising in a relevant area — on the
  same neutral criteria, with no ranking — cross the line? (Related to Q6.)
- (d) Is there a form of the consumer product that is clearly safe — for example,
  the client contacts a firm they already know by name, with no browse or search?

---

## Answer log

| # | Question | Answer | Date | Counsel |
| --- | --- | --- | --- | --- |
| 1 | Fee-sharing / revenue model | | | |
| 2 | Advertising and touting | | | |
| 3 | Engagement letter | | | |
| 4 | Privilege | | | |
| 5 | AI and unauthorised practice (incl. 5(f)–(i), added Phase 5) | | | |
| 6 | Payment role | | | |
| 7 | Conflict checks | | | |
| 8 | Firm structure | | | |
| 9 | PDPA (incl. 9(f)–(j), added Phase 8) | | | |
| 10 | Tax (now load-bearing: fee notes compute VAT — see Phase 3) | | | |
| 11 | Third-party advertising | | | |
| 12 | Pro bono module | | | |
| 13 | Cause lists | | | |
| 14 | Corporate panels | | | |
| 15 | BASL relationship | | | |
| **16** | **May a public attorney directory exist at all** | | | |
| **17** | **Intermeddlers Ordinance 1894 — operator's criminal exposure** | | | |
| **18** | **Is client-driven search indirect solicitation** | | | |
| 19 | Cross-border transfer (Neon hosting, model provider) — added Phase 6 | | | |
| **4(f)–(i)** | **Encryption at rest, key custody, participants-only chat — added Phase 7** | | | |
| **8(e)–(g)** | **Attorneys moving practice, matter-file ownership, firm verification — added Phase 7** | | | |
| **9(f)–(j)** | **Notice versioning as consent evidence, DSAR response time, firm referral model, erasure-as-anonymisation, undesignated DPO — added Phase 8** | | | |
