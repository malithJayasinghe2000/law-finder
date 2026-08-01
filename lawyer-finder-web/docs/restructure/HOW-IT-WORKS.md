# How This System Works — and Why

> **Who this is for.** You are a software engineer. You are not a lawyer, and you
> should not have to become one to work on this codebase. This document explains
> what a law firm actually is, what the system does, and *why* each constraint
> exists — in plain language, with no assumed legal knowledge.
>
> Read this before [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md). The guardrails
> tell you the rules; this tells you what they mean.
>
> Nothing here is legal advice. It is an engineering explanation of why the
> product is shaped the way it is.

---

## Part 1 — What a law firm actually is

### An attorney is a licensed individual, not a company

In Sri Lanka a lawyer is an **Attorney-at-Law**. They are admitted and enrolled by
the **Supreme Court**, and it is the Supreme Court — not any professional body —
that can discipline or disbar them. Their conduct is governed by the *Supreme
Court (Conduct of and Etiquette for Attorneys-at-Law) Rules 1988*.

Two things follow that surprise most engineers:

1. **The licence belongs to a person, not to a business.** A firm does not have a
   licence to practise law. Its members do.
2. **The rules bind that person's whole professional life**, including how they
   advertise, who they share money with, and what they do with your data. A
   platform that makes an attorney break those rules gets that attorney in
   trouble — and, as we will see, possibly us too.

### So what is "a law firm"?

A law firm is a group of attorneys practising together and sharing an office, a
name, staff, and overheads. In Sri Lanka the understood forms are:

| Form | What it means |
|---|---|
| **Sole practitioner** | One attorney practising alone. Legally, they *are* the firm. |
| **Partnership** | Several attorneys practising together, jointly responsible. |

Note what is *not* on that list: a company. Our understanding is that legal
practice cannot be incorporated in Sri Lanka — you cannot have "Perera Legal
Services (Pvt) Ltd" doing litigation. That is why `LawFirm.firmType` only has
`SOLE_PRACTITIONER` and `PARTNERSHIP`. (We have asked counsel to confirm this —
question 8(a).)

A firm may also employ people who are **not** attorneys: practice managers,
paralegals, clerks, receptionists. They work on matters, but they cannot give
legal advice and they are not licensed. This distinction is why `FirmRole` exists
and why it drives what people can see.

### Why the firm matters so much to this product

Here is the single most important sentence in the whole restructure:

> **The firm provides the legal service. We provide software.**

Before the restructure, this platform sat *between* client and lawyer — it took a
cut of the fee, held the money, and picked who you saw. That makes the platform a
participant in the provision of legal services, which it cannot lawfully be.

After the restructure, the client engages the **firm**. The firm quotes, the firm
gets paid, the firm gives the advice, the firm is responsible. We are the software
the firm happens to run on — like the accounting package a shop uses. The shop
sells the goods; the software just keeps the books.

Every design decision in Phase 2 flows from that sentence.

---

## Part 2 — The seven rules, explained like a person

These are in [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md) in formal terms. Here is
what they actually mean.

### 1. Never take a share of a legal fee

**The rule:** we can never take a percentage of what a client pays a lawyer.

**Why:** an attorney is not allowed to share their fees with a non-lawyer. The
reason is that if a non-lawyer has a financial stake in legal work, they have an
incentive to interfere in it — to push for a settlement, to encourage more
billable work, to steer the client. The profession forbids it outright.

**The trap:** it does not matter which direction the invoice points. "The client
pays the lawyer, and the lawyer pays us 15% later" is the same thing wearing a
hat. It also does not matter what you call it — a "platform fee" calculated from
the fee value is a share of the fee.

**So how do we make money?** A flat software licence. Priced on *seats and
features* — how many people use the software — never on how many matters flow
through it. The moment our revenue moves with the amount of legal work, we are
sharing fees again.

**In the code:** there is no commission field anywhere. It was deleted in Phase 0,
not disabled.

### 2. Never hold client money

**The rule:** money owed to a lawyer never touches an account we control.

**Why, part one:** attorneys must keep client money in their own **client
account**, separate from their business money, under professional rules designed
to stop client funds going missing. If we hold it, that segregation breaks.

**Why, part two:** holding and settling other people's money is a *regulated
financial activity* in Sri Lanka under the Payments and Settlements Systems Act
No. 28 of 2005. Doing it without authorisation from the Central Bank is illegal —
and it drags in anti-money-laundering obligations too.

The old system had escrow, admin payment verification, and withdrawal requests.
That was, functionally, an unlicensed payment service.

**What we do instead:** the quote carries the **firm's own bank details**. The
client pays the firm directly. We record two facts — "a payment is expected" and
"the firm says it arrived". We never see the money.

**In the code:** `LawFirm.bankName/accountName/accountNumber` are printed onto
quotes. There is no balance, no wallet, no withdrawal.

### 3. Never sell position, visibility, or leads to a lawyer

**The rule:** an attorney can never pay us to be seen more.

**Why:** attorneys may not advertise or solicit clients. If we sell a "featured"
slot, the attorney who buys it is advertising — through us. We become the
mechanism for a breach of their professional rules.

**The bit that should worry you:** under the **Intermeddlers with Suitors
Ordinance No. 11 of 1894**, "touting" — steering clients toward lawyers for
reward — is a **criminal offence**, and it is not limited to attorneys. It can
reach the intermediary. That is us.

**What we found in Phase 2:** the platform was doing exactly this. Attorneys could
buy an ad campaign and appear as a "★ Sponsored" card at the top of the lawyer
directory, above everyone else. That was removed.

**What is still fine:** selling ads to *non-lawyer* advertisers — a bank, an
insurer, a university. They are not bound by the conduct rules.

### 4. Never let the platform choose the lawyer

**The rule:** the client picks. Always. We never rank, recommend, or auto-assign.

**Why:** the moment software decides which attorney a client sees first, the
software is channelling work toward that attorney. Indian courts — interpreting a
rule almost identical to Sri Lanka's — have held that *any* structure designed to
channel clients toward particular lawyers, **even algorithmically**, is indirect
solicitation. They expressly included search-based filtering.

**How we comply:** ordering is alphabetical, and we say so on the page. Filters
are applied from criteria the *client* types (practice area, district, language),
never from a judgement we make. Nothing about subscription tier, spend, or rating
touches ordering — which is why ratings are gone entirely.

**Inside a firm, this is different.** A *firm* deciding which of its own attorneys
handles a matter is a professional decision by the practice, not solicitation by
us. That is why the assignment feature exists, why only a firm principal can use
it, and why the list of attorneys in that dialog is alphabetical with no workload
figures — we present the facts and the firm decides.

### 5. Protect privilege and confidentiality

**The rule:** platform staff — including `ADMIN` — cannot read what a client says
about their legal problem.

**Why this one is not just politeness:** when you tell your lawyer something to get
legal advice, that conversation is **privileged** under section 126 of the
Evidence Ordinance. Nobody can force it to be produced in court. But privilege can
be **lost** if a third party is in the conversation. If our support staff can read
a client's matter description, an opposing lawyer can argue the client already
shared it with a third party — and the protection weakens.

So this is not "customer data is sensitive". It is: *if we get this wrong, we can
damage a client's legal position in their own case.*

**How it works in the code:** exactly one file decides —
[`src/lib/firms/access.ts`](../../src/lib/firms/access.ts). Never re-implement it
inline in a route.

| Who | Sees the matter exists | Reads the client's description |
|---|---|---|
| The client | yes | yes — they wrote it |
| The attorney assigned to it | yes | yes |
| The firm's principal / practice manager | yes | yes — they must be able to reassign |
| Another attorney at the same firm | yes | **no** |
| A paralegal at the same firm | yes | **no** |
| An attorney at a different firm | **no** | **no** |
| Platform `ADMIN` (us) | yes | **no** |

Run `npm run check:privilege` after changing that file. It asserts every row of
that table. A green `npm run build` proves nothing about this.

**Still open:** whether non-attorney staff should see matter detail at all is a
question for counsel (8(b)). We currently allow it for a practice manager, because
someone has to run the diary — but that is the case most likely to change.

### 6. Never present the platform as giving legal advice

**The rule:** every AI surface says clearly that it is information, not advice, and
cites its sources.

**Why:** giving legal advice without being an attorney is unauthorised practice.
Worse, BASL issued a cautionary note in June 2021 that providing legal advice
through an online platform amounts to touting — which loops back to rule 3 and the
1894 Ordinance.

There is also a plainer reason: someone acting on a chatbot's answer about their
own case can lose their house.

### 7. The firm is the service provider; we are software

**The rule:** every document a client sees says the firm provides the service.

**Why:** if a client reasonably believes *we* are their legal service provider, we
are holding ourselves out as providing legal services. We are also, potentially, on
the hook when advice goes wrong.

**Where you see it:** the engagement letter has a whole section headed "Who is
providing the legal service", and it says the platform is not a law firm, is not a
party to the engagement, and receives no part of the fee.

---

## Part 3 — How a matter actually flows

Here is one client engaging one firm, end to end, with the reasoning at each step.

```
 1. Client browses the directory        alphabetical, unpurchaseable ordering
        │                               (rules 3, 4)
        ▼
 2. Client chooses an attorney          THEIR choice, recorded on Booking.lawyerId
        │                               so we can always show it was theirs
        ▼
 3. Client submits an intake request    status: REQUESTED
        │                               Booking.firmId = that attorney's firm
        │                               No fee. No commitment. No relationship yet.
        ▼
 4. Firm may reassign internally        only FIRM_OWNER / FIRM_ADMIN
        │                               only within the same firm, never across
        ▼
 5. Attorney runs a conflict check      status: CONFLICT_CHECK
        │                               privileged, firm-internal
        │                               ├── conflict found → DECLINED
        │                               │   (client is told only that the firm
        │                               │    cannot act — the reason belongs to
        │                               │    the other client)
        ▼
 6. Attorney issues a quote             status: QUOTED
        │                               the firm's fee in full, the firm's own
        │                               bank details, scope and exclusions, expiry
        ▼
 7. Client accepts                      status: ACCEPTED
        │                               engagement letter generated and snapshotted
        │                               THIS is when the lawyer-client relationship
        │                               begins — not at step 3
        ▼
 8. Client pays the FIRM directly       we record that they said they paid
        │                               we never touch the money
        ▼
 9. Firm confirms receipt               status: SCHEDULED
        │                               only the firm can confirm; no admin approval
        ▼
10. Consultation happens                → COMPLETED, or NO_SHOW
```

### Things worth noticing about that flow

**No fee exists until step 6.** A client cannot "buy a consultation". They request
one; the firm decides whether it can act and what it charges. This is why the
model is called `Booking` but the language everywhere says "request" and
"engagement" — the model name is historical, the behaviour is not.

**Steps 5 and 6 cannot be done by a colleague.** Screening for conflicts is a
professional duty of the attorney taking the matter. A conflict check signed by
someone else is worthless if it is ever tested. The principal can *move* the matter
(step 4), but then the new attorney does their own screening.

**The engagement letter is snapshotted, not joined.** Its full text is stored on
the row at the moment terms were accepted. If the firm later renames itself or
changes its address, the letter still says what the client actually agreed to.
This is why old letters keep rendering unchanged after Phase 2 renamed the party
from the attorney to the firm.

---

## Part 4 — The Phase 2 data model, and why it looks like this

```
User ────────────────┐
 │                   │
 │ 1:1               │ M:N via FirmMember (role: OWNER/ADMIN/ATTORNEY/PARALEGAL)
 ▼                   ▼
LawyerProfile ───► LawFirm ───► FirmOffice
 │   (firmId)        │
 │                   │
 │                   ▼
 └──────────────► Booking (lawyerId = who acts, firmId = who is engaged)
                     │
                     ├── ConflictCheck   (privileged, firm-internal)
                     ├── Quote           (versioned)
                     └── EngagementLetter (snapshotted)
```

**Why `LawyerProfile` kept its `firmId` instead of being replaced.** A solo
practitioner should never have to think about firms. Their profile still works
exactly as it did; a firm of one was created for them automatically. Replacing the
profile would have broken every existing screen for no benefit.

**Why `Booking` has both `lawyerId` and `firmId`.**
- `firmId` — who the client engaged. This is the party to the retainer.
- `lawyerId` — who is doing the work right now. This can change.

Keeping both means we never lose the record of the client's original choice
(rule 4) while still letting the firm manage its own workload. The invariant that
`lawyerId` must always belong to `firmId` is enforced in
`assertAttorneyBelongsToFirm()` and re-checked on every reassignment.

**Why availability stayed on `LawyerProfile`.** A firm does not have a calendar;
its attorneys do. Collapsing them would double-book people. This is also why
reassignment checks the receiving attorney's own diary for a clash before moving
anything.

**Why firm verification is separate from attorney verification.**
- `LawyerProfile.isVerified` — we checked *this person's* BASL registration.
- `LawFirm.verificationStatus` — we checked *this practice* exists as it claims.

A firm of five verified attorneys is not automatically a verified firm. And note
what happens when a solo practice adds a second member: it stops being a firm of
one, so it loses its inherited verification and goes back into the queue to be
checked in its own right.

---

## Part 5 — Things you will be tempted to build. Don't.

Each of these is a normal, sensible product feature that is illegal here.

| Tempting feature | Why it is prohibited |
|---|---|
| "Top rated lawyers" / star ratings | Unfair attraction under Rule 39. Also makes ordering non-neutral (rule 4) |
| "Recommended for you" / "best match" | Indirect solicitation — the system is choosing (rule 4) |
| "Featured firm" / promoted placement | Selling visibility to an attorney (rule 3) — and potentially criminal under the 1894 Ordinance |
| Fee ranges on profiles | Beyond the Rule 40 content limit; reads as advertising |
| "Pay per lead" / per-introduction billing | Textbook touting |
| Escrow, wallet, "hold the fee until the meeting" | Regulated payment activity without a licence (rule 2) |
| Admin dashboard showing matter descriptions | Threatens privilege (rule 5) |
| AI that says "you should sue them" | Unauthorised practice + BASL 2021 note (rule 6) |
| Auto-assigning a request to the least busy attorney | The platform choosing (rule 4) — the *firm* may do this, we may not |

If you catch yourself writing any of these words in a ticket, component name, or
string file — `featured`, `top rated`, `recommended lawyer`, `best match`,
`sponsored listing`, `per lead`, `commission` — stop and check the guardrails.

---

## Part 6 — The biggest unresolved question

Everything above assumes a public directory of attorneys is permissible as long as
it is neutral and unpurchaseable.

**That assumption has never been tested, and it might be wrong.**

Rule 40 of the Supreme Court Rules specifies what an attorney may display: name,
professional qualifications, academic qualifications, office hours. That reads
like an exhaustive permission, not a minimum. Combine it with the 1894 Ordinance's
criminal exposure for intermediaries, and there is a real argument that a
consumer-facing lawyer directory should not exist at all in Sri Lanka.

We have designed to the most conservative reading we can while keeping the product
working — that is what the "Rule 40 content limit" in the guardrails is. But this
is not a question engineering can settle. It is **counsel questions 16, 17 and 18**
in [QUESTIONS-FOR-COUNSEL.md](./QUESTIONS-FOR-COUNSEL.md), and it is the first
thing to ask a Sri Lankan attorney experienced in professional conduct.

**If the answer is unfavourable, the consumer directory must be withdrawn, not
adjusted.** The good news is that Phase 2 is what makes that survivable: now that
`LawFirm` exists and matters route through it, the consumer front end is a
removable layer rather than the foundation. The same engine underneath serves a
business-to-business product — companies managing law firms they have already
hired — which raises no touting question at all, and which is the shape described
in `PROJECT-PLAN.md` at the repository root.

---

## Quick reference

| I want to… | Read / run |
|---|---|
| Understand a rule | [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md) |
| Know what is done and what is next | [PROGRESS.md](./PROGRESS.md) |
| Change who can read matter data | `src/lib/firms/access.ts`, then `npm run check:privilege` |
| Change the database | [database-migrations.md](../database-migrations.md) — migrations only, never `db push` |
| Add a field to a public profile | Check it against the Rule 40 content limit first |
| Know what counsel still has to answer | [QUESTIONS-FOR-COUNSEL.md](./QUESTIONS-FOR-COUNSEL.md) |
