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

**The subtle version of this rule, which we got wrong for a while.** Subscription
tiers used to sell attorneys a quota of *client enquiries* and *client messages* —
10 a month on the cheap tier, unlimited on the expensive one — and advertised it on
the public pricing page. Nobody called it commission, and it still was one: revenue
rising with the amount of legal work is fee-sharing whatever the invoice says. If
you are ever asked to meter something, ask whether the number counts **software**
or **clients**. Seats, storage and templates are software. Enquiries, messages,
matters and introductions are clients.

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

**What we found, in two goes.** Phase 2 removed attorney adverts from the
directory. Phase 4 found that only *half* the job had been done — attorney adverts
were still running on the homepage, the blog, and the AI chat sidebar, where
someone describes their legal problem and an attorney who paid us appeared beside
the answer.

**What is still fine:** selling ads to *non-lawyer* advertisers — a bank, an
insurer, a university. They are not bound by the conduct rules.

**But "not an attorney" is not enough.** A legal consultancy, a claims-management
company, a document-drafting service or a legal-expenses insurer either practises
law without a licence or funnels work to those who do — and we would be the
funnel. Those are refused by category. The full list, and where adverts may
appear, is in
[LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md#advertising--who-may-buy-and-where).

**How it is enforced:** structurally. `AdCampaign` belongs to an `Advertiser` and
has no relation to `LawyerProfile` or `LawFirm` at all — a lawyer cannot buy an
advert because the schema gives them nowhere to be. A named `ADMIN` has to
positively confirm each advertiser is not a legal-services provider before
anything runs.

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

There are two ways a matter starts, and the difference is **what the client
chose**. Both are the client choosing; neither is us choosing.

```
FIRM-FIRST                              ATTORNEY-FIRST
client engages a practice               client picks a named attorney
                                        and one of their published slots
```

Firm-first is the shape the model points at — the firm is the provider of legal
services, so engaging the firm is the natural act. Attorney-first exists because a
client who already knows which practitioner they want should not be forced through
a firm they do not care about. `clientSelectedAttorneyId` records which happened,
and never changes afterwards.

Here is a firm-first matter end to end, with the reasoning at each step.

```
 1. Client browses the firm directory   alphabetical, unpurchaseable ordering
        │                               (rules 3, 4)
        ▼
 2. Client engages a firm               THEIR choice, recorded on Booking.firmId
        │                               clientSelectedAttorneyId stays NULL —
        │                               they left the practitioner to the firm
        ▼
 3. Client submits an intake request    status: REQUESTED
        │                               lawyerId NULL — it sits in the firm's queue
        │                               No date. No fee. No relationship yet.
        │                               Deliberately no slot picker: the firm has
        │                               not yet decided whether it can act, and
        │                               holding a diary slot before a conflict
        │                               check is a marketplace habit.
        ▼
 4. Firm assigns an attorney            only FIRM_OWNER / FIRM_ADMIN
        │                               only within the same firm, never across
        │                               the client is told who is acting
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
        │                               — AND a proposed appointment, because
        │                               this matter still has no time. The slot
        │                               is held while the quote is outstanding.
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

**No fee exists until step 6, and on the firm-first path no appointment does
either.** A client cannot "buy a consultation". They request one; the firm decides
whether it can act, what it charges, and when it can see them. This is why the
model is called `Booking` but the language everywhere says "request" and
"engagement" — the model name is historical, the behaviour is not.

**An unassigned matter is a real state.** `Booking.lawyerId` is null while a
request sits in the firm's queue. Only the principal or practice manager can read
it — that is what makes it triageable — and the conflict check and quote both
refuse until someone is assigned.

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
| Charging a lawyer per enquiry, message, or matter | Pay-per-lead and fee-sharing (rules 1, 3) — even packaged as a subscription tier |
| Any advert on the directory, a profile, or the engagement flow | Blurs a paid placement into a listing (rule 3) — true whoever bought it |
| Selling ad space to a "legal consultancy" or claims manager | They sell legal services without a licence; we would be the channel (rule 3) |
| Targeting an advert on what a client described in chat | Selling adverts against privileged material (rule 5 + PDPA) |
| Auto-assigning a firm request to an attorney by workload | The platform choosing (rule 4). The *firm* may pick however it likes; we may not pick for it |
| Letting a client book a slot before the firm accepts | Marketplace booking — it holds a diary slot before any conflict check, and implies a consultation was purchased |
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

## Part 7 — How the two enforcement subsystems actually work

Parts 1–6 explain the rules. This part explains the machinery, because two of the
seven rules cannot be enforced by schema shape alone and needed real systems
built for them.

### The pattern, in one paragraph

Every hard rule in this codebase is enforced in exactly one of three ways, and
you should know which before you change anything:

| How | Example | What breaks it |
|---|---|---|
| **Structurally** — the schema gives it nowhere to exist | `AdCampaign` has no lawyer relation, so a lawyer cannot buy an advert. `FeeNote` has no commission column | A migration, which is a conversation |
| **By one policy file** — a single function decides, and routes call it | `firms/access.ts` (who reads a matter), `ads/eligibility.ts` (who advertises), `ai/policy.ts` (what the AI may say), `firms/billing.ts` (what a firm is licensed for) | Re-implementing the rule inline in a route |
| **By a runnable check** — an assertion, not a promise | `check:privilege`, `check:ai`, `check:billing` | Nothing, if you run them |

The rule of thumb: **prefer structural, fall back to a policy file, and always
add a check.** A green `npm run build` has never once proved any of these rules
hold.

### The AI (rule 6) — refuse, generate, evaluate, then publish

The AI is the only surface where a violation is produced *at runtime, per answer,
by a generative model*. Schema cannot stop it and neither can a prompt, because a
model that ignores an instruction fails silently.

So generation is a **four-step pipeline in one route**,
[`/api/ai/ask`](../../src/app/api/ai/ask/route.ts), and the order is the
compliance measure:

```
1. classifyRequest(question)      ── refuse BEFORE the model is called
       │                             "what should I do about my landlord"
       │                             Their account of their problem is never
       │                             transmitted at all. That is the
       ▼                             confidentiality dividend of checking the
2. askRag(context)                   request and not only the answer.
       │                          ── generate, server side
       ▼                             The browser has no model URL any more.
3. evaluateAnswer({...})          ── withhold AFTER generation
       │                             advice · practitioner steering ·
       │                             invented citations · nothing cited
       ▼
4. persist + return               ── only now does anyone see a character
```

Three things about this that are easy to get wrong later:

**Nothing streams, deliberately.** Streaming and step 3 are mutually exclusive —
a streamed answer has been read by the time it can be checked. The typing effect
is worth less than the check.

**Answers are withheld whole, never edited.** Rewriting a model's legal prose to
make it compliant means we are authoring legal content by hand, which is the
thing rule 6 exists to stop.

**Citations cannot be faked, but prose can.** The citation list comes from
retrieval metadata, so the model cannot invent an entry in it. What it *can*
invent is a mention in the sentence — which is why `findUnsupportedProseCitations`
cross-checks every Act named in the prose against what retrieval actually
returned. This is not theoretical: live testing caught the model citing an
"Employment (Amendment) Ordinance No. 14 of 2017" that is not in the corpus, with
six unrelated Companies Act sources attached. **Having sources is not the same as
being sourced.**

A citation is shown as a link only where it resolves to a `LegalDocument` the
reader can open. Where it does not, it is shown as text marked *"Not yet in the
library"* — never as a link to nowhere, because a citation nobody can open
manufactures authority.

### The money (rules 1, 2, 7) — two different invoices

The single most common confusion in this codebase, so learn the pair:

| Model | Who bills whom | For what | Do we touch the money? |
|---|---|---|---|
| `Invoice` | **us → firm** | the software licence | yes, it is our revenue |
| `FeeNote` | **firm → its client** | legal work | **never** |

`FeeNote` is a document we render. The firm bills under its own TIN and VAT
number, into its own bank account, and we are not in the transaction at any
point. There is no platform-fee column and no commission column on the model —
not a nullable one, not one defaulting to zero, because *a column that exists is
a column a future product decision can populate.* The absence is the guardrail.

Two behaviours that look like bugs and are not:

- **"Record as paid" does not verify anything.** The firm asserts the money
  arrived; there is no admin approval step. We did not see the payment and
  cannot honestly attest to it — the same reasoning as booking payments since
  Phase 1.
- **A cancelled fee note keeps its number.** Sri Lankan tax practice expects an
  unbroken series, and a gap created by our convenience is a question the firm
  has to answer to a tax officer.

The rendered note is **snapshotted at issue**, like the engagement letter. A fee
note is a tax document: if the firm renames itself tomorrow, an issued note must
still say what it said today.

### Seats — the only thing we are allowed to meter

The licence belongs to the `LawFirm`. A **seat is a person who can sign in** — an
`ACTIVE` `FirmMember`, attorney or not.

> **The test, every time you are asked to meter something: does the number count
> software, or clients?**
>
> Seats, storage and templates are software. Enquiries, messages, matters,
> introductions and conversations are clients — and metering a client is
> fee-sharing under a different name, whichever way the invoice points.

A seat limit refuses a **person**, never a matter. A firm on one seat may run a
thousand matters; it just does so with one login.

This is the rule that has been broken twice, both times by accident, both times
by someone building a perfectly ordinary SaaS feature:

- Phase 2.5 — subscription tiers sold `inquiries_per_month` and
  `chat_messages_per_month`, advertised on the public pricing page
- Phase 3 — an attorney without a plan saw only their five oldest client
  conversations, the rest reading *"Locked Conversation — Please upgrade to view
  this conversation"*

The second is the more instructive. Nobody set out to sell leads; someone
implemented a freemium limit on a chat list. It withheld a client's own message
from their own lawyer over an unpaid software bill. **If you find yourself gating
something that a client did, stop.**

---

## Quick reference

| I want to… | Read / run |
|---|---|
| Know whether something may be metered in pricing | Does the number count software, or clients? Clients are never permitted |
| Understand a rule | [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md) |
| Know what is done and what is next | [PROGRESS.md](./PROGRESS.md) |
| Change who can read matter data | `src/lib/firms/access.ts`, then `npm run check:privilege` |
| Change the database | [database-migrations.md](../database-migrations.md) — migrations only, never `db push` |
| Add a field to a public profile | Check it against the Rule 40 content limit first |
| Know what counsel still has to answer | [QUESTIONS-FOR-COUNSEL.md](./QUESTIONS-FOR-COUNSEL.md) |
| Change what the AI may say | `src/lib/ai/policy.ts`, then `npm run check:ai` |
| Change what a firm is licensed for | `src/lib/firms/billing.ts`, then `npm run check:billing` |
| Change a fee note | `src/lib/consultations/feeNote.ts` — and never add a fee of ours to it |
| Understand how any of that is enforced | [Part 7](#part-7--how-the-two-enforcement-subsystems-actually-work) |
