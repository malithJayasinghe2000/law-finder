# The Project — what this is, how it works, and where it stands

> **Read this first.** If you have been away from this project, or you are new to it,
> or you have lost the thread after nine phases of change — start here and read nothing
> else until you have finished it.
>
> Written 2026-09-12. Current as of Phase 8.

---

## ⚠️ Before anything else: ignore the documents at the repository root

`project_scope_and_vision.md`, `mvp_project_plan.md`, `developer_project_plan.md` and
`architecture_manual.md` at the root of this repository describe a **different product**
— the one this project started as, and spent nine phases dismantling.

They still promise sponsored listings, commission on consultation fees, star reviews, an
"Inquire Now" lead-generation flow, and an AI that recommends "top property lawyers in
Colombo". **Every one of those was removed because it is unlawful in Sri Lanka**, and
several carry criminal exposure for the platform operator, not just the lawyer.

If you built from those documents you would rebuild the illegal product. They are kept
only as a record of where the project started. This file supersedes them.

---

## 1. What this is, in one paragraph

**TheLawyr is software that Sri Lankan law firms run their practice on.** A firm manages
its client matters here: intake, conflict checks, quotes, engagement letters, fee notes,
messages and documents. We charge the firm a flat software licence, priced per person who
can sign in. There is also a public directory where a citizen can find a practice and ask
it to act — but that directory is a front end, not the business, and it may yet have to be
withdrawn (see §7).

**The single sentence everything else follows from:**

> **The firm provides the legal service. We provide software.**

## 2. What it is *not*, and why that matters

This started life as a legal-services **marketplace** — take a commission, hold the money,
rank the lawyers, sell leads. That is the one shape this product cannot lawfully take in
Sri Lanka:

| The marketplace instinct | Why it is not available to us |
| --- | --- |
| Take a % of the consultation fee | An attorney may not share fees with a non-lawyer. Illegal in **either** direction — invoicing the lawyer afterwards is the same thing wearing a hat |
| Hold the fee in escrow until the meeting | Holding and settling other people's money is a regulated financial activity needing Central Bank authorisation |
| Sell a lawyer a "featured" slot | Attorneys may not advertise or solicit. Under the **Intermeddlers with Suitors Ordinance No. 11 of 1894**, touting is a **criminal offence that reaches the intermediary — us** |
| Rank lawyers, "best match", "recommended for you" | Any structure that channels clients toward particular lawyers — even algorithmically — is indirect solicitation |
| Star ratings and reviews | Unfair attraction, and one `orderBy` away from being paid ranking |
| Charge per enquiry, message or matter | Revenue that moves with the volume of legal work is fee-sharing under a different name |
| Let platform staff read a client's matter | Privilege under Evidence Ordinance s.126 can be **lost** if a third party is in the conversation — a leak can damage the client's position in their own case |

These are the seven hard rules. They are set out in full in
[LEGAL-GUARDRAILS.md](./restructure/LEGAL-GUARDRAILS.md), and explained in plain language
in [HOW-IT-WORKS.md](./restructure/HOW-IT-WORKS.md). **Read HOW-IT-WORKS.md before writing
any feature code.** It is the best document in this repository.

## 3. Who uses it

| Person | What they are | What they do here |
| --- | --- | --- |
| **Client / citizen** | The person with a legal problem | Finds a practice, asks it to act, accepts a quote, pays the firm directly, messages their attorney |
| **Attorney-at-Law** | Licensed by the Supreme Court. The licence belongs to the **person**, not the business | Runs conflict checks, quotes, advises, bills |
| **Firm principal** (`FIRM_OWNER`) | The partner or sole practitioner | Registers the practice, invites members, assigns matters, buys the licence |
| **Practice manager** (`FIRM_ADMIN`) | **Not an attorney** — platform role is `CLIENT` | Runs the diary, triages matters, answers data requests |
| **Paralegal** (`PARALEGAL`) | Not an attorney | Sees that matters exist, cannot read what they say |
| **Platform admin** (`ADMIN`) | Us | Verifies attorneys and firms, publishes the privacy notice, approves advertisers. **Cannot read any matter** |

> **Authority inside a firm comes from an `ACTIVE` `FirmMember` row, never from the
> platform role.** A practice manager's platform role is `CLIENT`. Getting this wrong has
> broken five separate layers of this codebase so far.

## 4. How a matter actually flows

Two lawful ways in. Both are the **client** choosing; neither is us choosing.

```
   FIRM-FIRST (the shape the model points at)          ATTORNEY-FIRST
   client engages a practice                           client picks a named
   and leaves the choice of attorney to it             attorney and one of
                                                       their published slots
```

Firm-first, end to end:

```
 1. Client browses the directory        alphabetical, unpurchaseable ordering
        │
        ▼
 2. Client engages a firm               THEIR choice, recorded on Booking.firmId
        │
        ▼
 3. Client submits an intake request    status: REQUESTED
        │                               No attorney. No date. No fee. No relationship yet.
        │                               Deliberately no slot picker — holding a diary slot
        │                               before a conflict check is a marketplace habit
        ▼
 4. Firm assigns an attorney            only the principal or practice manager
        │                               only within the same firm, never across
        ▼
 5. Attorney runs a conflict check      privileged, firm-internal
        │                               conflict found → DECLINED, and the client is told
        │                               only that the firm cannot act, never why
        ▼
 6. Attorney issues a quote             the firm's fee in full, the firm's OWN bank
        │                               details, scope, exclusions, expiry — and a
        │                               proposed appointment
        ▼
 7. Client accepts                      engagement letter generated and SNAPSHOTTED.
        │                               THIS is where the lawyer-client relationship
        │                               begins — not at step 3
        ▼
 8. Client pays the FIRM directly       we record that they say they paid.
        │                               We never see the money
        ▼
 9. Firm confirms receipt               status: SCHEDULED. No admin approval — we did
        │                               not see the payment and cannot attest to it
        ▼
10. Consultation happens                → COMPLETED, or NO_SHOW
```

**The thing to notice:** no fee exists until step 6, and on the firm-first path no
appointment does either. A client cannot "buy a consultation". They *request* one, and the
firm decides whether it can act, what it charges, and when it can see them.

## 5. Who can read what — the privilege table

This is the most important table in the system. It is decided in exactly one file,
[`src/lib/firms/access.ts`](../src/lib/firms/access.ts), and asserted by
`npm run check:privilege` (41 cases).

| Who | Matter exists | Reads the description | Reads the message thread |
|---|---|---|---|
| The client | yes | yes — they wrote it | yes |
| The assigned attorney | yes | yes | yes, if in it |
| Firm principal / practice manager | yes | yes — they must be able to reassign | **no**, unless in it |
| Another attorney at the same firm | yes | **no** | **no** |
| A paralegal | yes | **no** | **no** |
| An attorney who has **left** | **no** | **no** | **no** |
| Platform `ADMIN` (us) | yes | **no** | **no** |

Those columns are also **encrypted at rest** (AES-256-GCM, bound to their own row and
column). Blocking a read in code binds code; a database dump does not go through the code.

> **The rule that keeps this honest: ciphertext is never a return value.** The disclosure
> gate has three outcomes — the words, `[Withheld — privileged]`, or `[Unavailable]`.
> Never the stored value, because handing a blocked reader the ciphertext passes a naive
> check while giving them an offline-attackable copy of a client's legal problem.

## 6. How the rules are actually enforced

Every hard rule is enforced in one of three ways. Know which before you change anything.

| How | Example | What breaks it |
| --- | --- | --- |
| **Structurally** — the schema gives it nowhere to exist | `AdCampaign` has no lawyer relation, so a lawyer *cannot* buy an advert. `FeeNote` has no commission column | A migration — which is a conversation |
| **One policy file** — a single function decides | `firms/access.ts`, `ai/policy.ts`, `firms/billing.ts`, `privacy/policy.ts`, `privacy/notice.ts` | Re-implementing the rule inline in a route |
| **A runnable check** — an assertion, not a promise | `check:privilege`, `check:ai`, `check:billing`, `check:pdpa`, `check:firm` | Nothing, if you run them |

**A green `npm run build` has never once proved any of these rules hold.** The five checks
carry 193 assertions between them and have caught real, live defects in every phase.

```bash
npm run check:privilege   # 41 — who may read a matter
npm run check:firm        #  15 — who may be in a practice
npm run check:ai          #  49 — what the assistant may say
npm run check:billing     #  21 — what may be metered, and fee notes
npm run check:pdpa        #  67 — retention, erasure, consent, the notice register
```

## 7. The biggest unresolved question — read this before building anything consumer-facing

Everything above assumes **a public directory of attorneys is permissible** as long as it
is neutral and unpurchaseable.

**That assumption has never been tested, and it might be wrong.**

Supreme Court Rule 40 lists what an attorney may display — name, professional
qualifications, academic qualifications, office hours. That reads like an exhaustive
permission, not a minimum. Combine it with the 1894 Ordinance's criminal exposure for
intermediaries, and there is a serious argument that a consumer-facing lawyer directory
**should not exist at all in Sri Lanka**. India's courts have held that even
*search-based filtering* across lawyers is indirect solicitation — and Sri Lanka never
adopted India's 2008 relaxation, so on the face of the instruments **Sri Lanka is
stricter than India.**

This is **counsel questions 16, 17 and 18**, and it is unanswered. It has been the top of
"Next up" since Phase 2 and nobody has asked a lawyer yet.

**If the answer is unfavourable, the consumer directory must be withdrawn, not adjusted.**
The good news: Phase 2 is what makes that survivable. Now that `LawFirm` exists and matters
route through it, the consumer front end is a **removable layer** rather than the
foundation. The same engine underneath serves a business-to-business product with no
touting question at all.

See [DIRECTION.md](./DIRECTION.md) for what we recommend doing about this.

## 8. What is actually built

Nine phases, ~60,000 lines, 116 API routes, 73 pages, 56 database models, 17 migrations.

| Area | State |
| --- | --- |
| Engagement lifecycle (intake → conflict → quote → letter → payment → complete) | ✅ Built and driven end to end |
| Law firm entity, membership, invitations, registration | ✅ Built |
| Privilege + encryption at rest | ✅ Built, 41 assertions |
| AI assistant with refusal/withholding policy | ✅ Built, 49 assertions — but see the model problem in [OPEN-ITEMS.md](./OPEN-ITEMS.md) |
| Advertising (non-lawyer advertisers only) | ⚠️ Built, but **no billing module** — advertisers are invoiced outside the platform |
| Firm SaaS licence + seats + fee notes | ✅ Built — but **collection is manual** (see [REVENUE-MODEL.md](./REVENUE-MODEL.md)) |
| PDPA: retention, export, erasure, consent, access log | ✅ Built, 67 assertions |
| Privacy notice register + data-rights screens | ✅ Built in Phase 8 |
| Community, blog, legal library | ✅ Built |
| **Tests beyond the five policy checks** | ❌ **None** |
| **CI, containerisation, monitoring, backups** | ❌ **None** |
| **Deployment** | ❌ Never deployed; runs on localhost |

## 9. Where to go next

| I want to… | Read |
| --- | --- |
| **Go through the whole system, feature by feature** | **[TOUR.md](./TOUR.md)** — the long walk. Every screen, every rule, and why each is built that way |
| Understand *why* a rule exists | [HOW-IT-WORKS.md](./restructure/HOW-IT-WORKS.md) — start here, it is written for an engineer with no legal background |
| Know the hard constraints | [LEGAL-GUARDRAILS.md](./restructure/LEGAL-GUARDRAILS.md) |
| Know what is done and what happened when | [PROGRESS.md](./restructure/PROGRESS.md) |
| Know how the money works | [REVENUE-MODEL.md](./REVENUE-MODEL.md) |
| Know everything still outstanding | [OPEN-ITEMS.md](./OPEN-ITEMS.md) |
| Know what to do next, and in what order | [DIRECTION.md](./DIRECTION.md) |
| Ship to production | [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) |
| Change the database | [database-migrations.md](./database-migrations.md) — migrations only, never `db push` |
| Know what personal data we hold | [DATA-INVENTORY.md](./restructure/DATA-INVENTORY.md) |

## 10. The five things that will bite you

1. **A green build proves nothing.** Run the five checks. Then drive the actual app.
2. **Authority comes from firm membership, not platform role.** A practice manager is a
   `CLIENT`.
3. **Never meter clients.** Seats, storage and templates are software. Enquiries,
   messages, matters and introductions are clients — metering them is fee-sharing.
4. **Never break a working flow to make a legal fix.** Replace before removing.
5. **If you build a right, build the screen.** Phase 6 shipped an entire PDPA rights
   engine with no caller, and the compliance position was unchanged for two phases.
