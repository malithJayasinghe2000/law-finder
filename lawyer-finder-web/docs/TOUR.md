# The Tour — the whole system, one stop at a time

> **Who this is for:** you, or anyone who has to work on this and does not yet know what
> is in it. No legal background assumed. No prior knowledge of the codebase assumed.
>
> **How to use it:** read it in order, with the repo open. Each stop tells you what to
> look at, what it does, and — the part that matters most here — **why it is built that
> way**. Almost every odd-looking decision in this codebase is odd for a reason, and the
> reason is usually a law.
>
> **Time:** about two hours to read. A day if you actually open the files and click
> through the screens, which is the version I would do.
>
> Written 2026-09-13. Companion to [THE-PROJECT.md](./THE-PROJECT.md), which is the
> two-page summary. This is the long walk.

---

## Contents

| Part | What it covers |
| --- | --- |
| [0](#part-0--before-you-start) | Before you start — get it running |
| [1](#part-1--what-this-actually-is) | What this actually is, in one paragraph |
| [2](#part-2--the-seven-rules-that-shape-everything) | The seven rules that shape everything |
| [3](#part-3--the-people) | The people, and why "role" is not what you think |
| [4](#part-4--stop-1-the-public-site) | **Stop 1** — the public site |
| [5](#part-5--stop-2-a-matter-from-start-to-finish) | **Stop 2** — a matter, start to finish ⭐ |
| [6](#part-6--stop-3-inside-a-law-firm) | **Stop 3** — inside a law firm |
| [7](#part-7--stop-4-the-platform-admin) | **Stop 4** — the platform admin |
| [8](#part-8--stop-5-the-ai-assistant) | **Stop 5** — the AI assistant |
| [9](#part-9--stop-6-privacy-and-data-rights) | **Stop 6** — privacy and data rights |
| [10](#part-10--stop-7-money) | **Stop 7** — money |
| [11](#part-11--stop-8-advertising) | **Stop 8** — advertising |
| [12](#part-12--stop-9-community-and-content) | **Stop 9** — community and content |
| [13](#part-13--the-machine-room) | The machine room — where decisions are made |
| [14](#part-14--the-database) | The database — 56 models, grouped |
| [15](#part-15--the-plumbing) | The plumbing — auth, languages, real-time, security |
| [16](#part-16--what-is-half-built-dead-or-wrong) | What is half-built, dead, or wrong |
| [17](#part-17--exercises) | Exercises — drive it yourself |

---

## Part 0 — Before you start

Get it running. Reading code you cannot execute is how people form confident wrong ideas
about a system.

```bash
# 1. The database must be up (Postgres, local)
#    DATABASE_URL is in lawyer-finder-web/.env

# 2. The web app
cd lawyer-finder-web
npm install
npm run db:generate      # builds the Prisma client from the schema
npm run dev              # http://localhost:3210

# 3. The AI service, in a second terminal
cd lawyer-rag
source venv/bin/activate
ollama serve &                                   # the local model host
gunicorn -c gunicorn.conf.py wsgi:app            # http://127.0.0.1:5001
```

If the assistant says it is unavailable, the cause is almost always that
`RAG_SERVICE_TOKEN` in `lawyer-finder-web/.env` does not match the one in
`lawyer-rag/.env`. See [lawyer-rag/docs/RUNNING.md](../../lawyer-rag/docs/RUNNING.md).

**Then run the checks.** They are the fastest way to understand what the system promises:

```bash
npm run check:privilege   # 41 — who may read a client's legal problem
npm run check:firm        # 15 — who may be in a law practice
npm run check:ai          # 52 — what the assistant may say
npm run check:billing     # 21 — what may be charged for
npm run check:pdpa        # 67 — retention, erasure, consent
```

Read the *names* of the assertions as they scroll past. That is a spoken description of
every rule the system holds itself to, and it takes two minutes.

---

## Part 1 — What this actually is

**TheLawyr is software that Sri Lankan law firms run their practice on.**

A firm manages its client work here: intake, conflict checks, quotes, engagement letters,
fee notes, messages, documents. We charge the firm a flat licence, priced per person who
can sign in.

There is also a public directory where a citizen can find a practice and ask it to act.
That directory is a front door, not the business.

> **The sentence everything else follows from:**
> **The firm provides the legal service. We provide software.**

### What it is not, and why that matters more than what it is

This began life as a legal-services **marketplace** — take a commission, hold the money,
rank the lawyers, sell leads. Nine phases of work were spent removing that, because in
Sri Lanka it is not merely a bad idea, it is unlawful, and some of it is **criminal for
the platform operator**, not only for the lawyer.

You will see the scars everywhere: deleted enum values with comments explaining why,
models with their price columns removed, a `Booking` table with no commission field. Those
comments are not clutter. **They are there to stop someone helpfully adding the feature
back.**

> ⚠️ **The four documents at the repository root**
> (`project_scope_and_vision.md`, `mvp_project_plan.md`, `developer_project_plan.md`,
> `architecture_manual.md`) describe the **old, illegal product**. They promise sponsored
> listings, commission on fees, star reviews and lead generation. They are marked
> superseded. **Building from them rebuilds the illegal product.** Ignore them.

---

## Part 2 — The seven rules that shape everything

If a piece of this system looks over-complicated, the reason is almost always on this list.
Full detail in [LEGAL-GUARDRAILS.md](./restructure/LEGAL-GUARDRAILS.md); plain-language
explanations in [HOW-IT-WORKS.md](./restructure/HOW-IT-WORKS.md), which is the best
document in this repo.

| # | The rule | What it means here |
| --- | --- | --- |
| **1** | **Never take a share of a legal fee** | No commission, in either direction. Invoicing the lawyer afterwards is the same thing wearing a hat. An attorney may not share fees with a non-lawyer |
| **2** | **Never hold client money** | No escrow, no balances, no withdrawals. Holding other people's money is a regulated financial activity needing Central Bank authorisation. The client pays the **firm** directly; we only record that they say they did |
| **3** | **Never sell position, visibility, or leads** | No "featured" slots. Touting is a **criminal** offence under the **Intermeddlers with Suitors Ordinance No. 11 of 1894**, and it reaches the **intermediary — us** |
| **4** | **Never let the platform choose the lawyer** | The directory is alphabetical and unpurchaseable. No "best match", no "recommended for you". Even algorithmic channelling is indirect solicitation |
| **5** | **Protect privilege** | Platform staff, **including `ADMIN`**, cannot read a client's matter. Privilege under Evidence Ordinance s.126 can be **lost** if a third party is in the conversation — a leak can damage the client's own case |
| **6** | **Never present the platform as giving legal advice** | The AI explains what the law says. It never advises a person about their own situation |
| **7** | **The firm is the service provider; we are software** | Every fee, every bank account, every engagement letter is the firm's |

### Two instruments worth knowing by name

- **Intermeddlers with Suitors Ordinance No. 11 of 1894** — touting is criminal, and the
  offence reaches the platform, not just the attorney.
- **Supreme Court Rule 40** — limits what may be *displayed* about an attorney: name,
  professional qualifications, academic qualifications, office hours. **That is the whole
  list.** No fee ranges, no ratings, no promotional copy. This is why attorney profiles
  look so sparse.

### How each rule is actually enforced

There are only three mechanisms in this codebase. Know which one you are dealing with
before you change anything.

| Mechanism | Example | What breaks it |
| --- | --- | --- |
| **Structural** — the schema gives it nowhere to exist | `AdCampaign` has no lawyer relation, so a lawyer *cannot* buy an advert. `FeeNote` has no commission column | A migration — which is a conversation, not a commit |
| **One policy file** — a single function decides | `firms/access.ts`, `ai/policy.ts`, `firms/billing.ts`, `privacy/policy.ts` | Re-implementing the rule inline in a route |
| **A runnable check** — an assertion, not a promise | `check:privilege`, `check:ai`, `check:billing`, `check:pdpa`, `check:firm` | Nothing, if you run them |

> **`npm run build` passing has never once proved any of these rules hold.** That is
> exactly what the 196 assertions are for.

---

## Part 3 — The people

| Person | What they really are | Platform `role` |
| --- | --- | --- |
| **Client / citizen** | Someone with a legal problem | `CLIENT` |
| **Attorney-at-Law** | Licensed by the Supreme Court. **The licence belongs to the person, not the business** | `LAWYER` |
| **Firm principal** | The partner or sole practitioner who runs the practice | `LAWYER` |
| **Practice manager** | Runs the diary, triages matters. **Not an attorney** | `CLIENT` |
| **Paralegal** | Not an attorney | `CLIENT` |
| **Platform admin** | Us | `ADMIN` |

### The single most important thing on this page

> **Authority inside a firm comes from an `ACTIVE` `FirmMember` row — never from the
> platform role.**

A practice manager's platform role is `CLIENT`. They can run a firm's diary and answer
data requests. A `LAWYER` who has left a firm can do nothing there at all.

**This has been got wrong in five separate layers of this codebase** — access resolution,
route guards, the lawyer layout, the route guard, and the sidebar. When you write a check,
ask *"is this person an active member of this firm, in what role?"* — never *"is this
person a LAWYER?"*

Open [`src/lib/firms/access.ts`](../src/lib/firms/access.ts) and read `getFirmMembership`.
That is the question, asked properly, in one place.

---

## Part 4 — Stop 1: the public site

**Open** `http://localhost:3000/en`  *(check your startup log for the port)*.

Everything under `src/app/[locale]/(public)/` is reachable without signing in.

| Page | Route | What it is |
| --- | --- | --- |
| Home | `/en` | Landing page |
| Find a practice | `/en/firms` | **The law firm directory** |
| A practice | `/en/firms/[slug]` | One firm's public page |
| Find an attorney | `/en/lawyers` | The attorney directory |
| An attorney | `/en/lawyers/[id]` | One attorney's public profile |
| Legal library | `/en/legal-library` | Acts and legislation you can read |
| Ask the assistant | `/en/chat` | The AI |
| Community | `/en/blog` | Articles and community posts |
| Pricing | `/en/pricing` | What a firm pays |
| Privacy notice | `/en/privacy` | The published notice, and every past version |
| Apply | `/en/apply` | An attorney applying to join |

### Look closely at the directory — the absences are the design

Open `/en/lawyers` and ask yourself what is **missing**:

- **No star ratings.** Rule 3 — unfair attraction, and one `orderBy` away from paid ranking.
- **No "best match" or "recommended".** Rule 4.
- **No fee ranges.** Rule 40 — not on the list of what may be displayed.
- **No "Inquire Now" lead button.** That was lead generation, removed in Phase 0.
- **No sponsored results.** Rule 3, and it is the criminal one.
- **Ordering is alphabetical and unpurchaseable.**

> **This is the part of the tour people skim and should not.** A marketplace is what this
> naturally wants to be, and every one of those absences is load-bearing. If you ever find
> yourself adding a sort order that someone could pay to influence, stop.

### And the biggest open question in the entire project

**Whether this directory may lawfully exist at all** has never been tested.

Rule 40 lists what an attorney may display, and it reads like an exhaustive permission
rather than a minimum. Combine that with the 1894 Ordinance's criminal exposure for
intermediaries, and there is a serious argument that a consumer-facing lawyer directory
**should not exist in Sri Lanka at all**. Indian courts have held that even *search-based
filtering* across lawyers is indirect solicitation — and Sri Lanka never adopted India's
2008 relaxation, so on the face of the instruments **Sri Lanka is stricter than India.**

This is counsel questions 16–18. It has been top of "next up" since Phase 2 and nobody has
asked a lawyer yet. If the answer is unfavourable the directory is **withdrawn, not
adjusted** — which is survivable only because matters route through `LawFirm`, making the
consumer front end a removable layer rather than the foundation.

---

## Part 5 — Stop 2: a matter from start to finish ⭐

**This is the heart of the system. If you read one part of this tour, read this one.**

A "matter" is one piece of legal work for one client. In the database it is still called
`Booking` — a leftover name from the marketplace days, and one of the four names for the
same thing (see Part 16).

### Two lawful ways in

Both are **the client choosing**. Neither is us choosing.

```
  FIRM-FIRST (the shape the model points at)      ATTORNEY-FIRST
  client engages a practice and leaves the        client picks a named attorney
  choice of attorney to the firm                  and one of their published slots
```

### The firm-first path, step by step

```
 1. Client browses the directory          alphabetical, unpurchaseable
        │
        ▼
 2. Client engages a firm                 THEIR choice, recorded on Booking.firmId
        │
        ▼
 3. Client submits an intake request      status: REQUESTED
        │                                 No attorney. No date. No fee. No relationship yet.
        ▼
 4. Firm assigns an attorney              only the principal or practice manager,
        │                                 only within the same firm, never across
        ▼
 5. Attorney runs a conflict check        privileged, firm-internal
        │                                 conflict → DECLINED, and the client is told only
        │                                 that the firm cannot act — never why
        ▼
 6. Attorney issues a quote               the firm's fee in full, the firm's OWN bank
        │                                 details, scope, exclusions, expiry
        ▼
 7. Client accepts                        engagement letter generated and SNAPSHOTTED.
        │                                 THIS is where the lawyer–client relationship
        │                                 begins — not at step 3
        ▼
 8. Client pays the FIRM directly         we record that they say they paid.
        │                                 We never see the money
        ▼
 9. Firm confirms receipt                 status: SCHEDULED. No admin approval — we did
        │                                 not see the payment and cannot attest to it
        ▼
10. Consultation happens                  → COMPLETED, or NO_SHOW
```

### The five things to notice, and why each is that way

**1. There is no slot picker at step 3.** Deliberately. Holding a diary slot before a
conflict check is a marketplace habit — it implies the firm has agreed to act before it has
checked whether it *may*.

**2. No fee exists until step 6.** A client cannot "buy a consultation". They *request*
one, and the firm decides whether it can act, what it charges, and when it can see them.
This is the difference between a service and a product, and it is the whole ballgame for
rule 7.

**3. The conflict check comes before everything.** An attorney cannot act against an
existing client's interest. When a conflict is found, the client is told only that the firm
cannot act — **never why**, because *why* would leak the existence of the other client.

**4. The engagement letter is snapshotted, not linked.** Open
[`src/lib/consultations/engagementLetter.ts`](../src/lib/consultations/engagementLetter.ts).
The letter's text is **frozen** at the moment of acceptance. If the firm later changes its
terms, the letter the client agreed to is unchanged. A letter you can silently edit is not
evidence of anything.

**5. Nobody at the platform approves the payment.** Step 9 is the *firm* confirming
receipt. We never saw the money, so we cannot attest to it — and pretending otherwise
would make us look like we handled it, which is rule 2.

### Where the code is

| Thing | File |
| --- | --- |
| The state machine | [`src/lib/consultations/bookingStatus.ts`](../src/lib/consultations/bookingStatus.ts) |
| Intake, listing | `src/app/api/consultations/bookings/route.ts` |
| Assign an attorney | `src/app/api/consultations/bookings/[id]/assign/route.ts` |
| Conflict check | `.../[id]/conflict-check/route.ts` |
| Quote | `.../[id]/quotes/route.ts` |
| Engagement letter | `.../[id]/engagement-letter/route.ts` |
| Payment record | `.../[id]/payment/route.ts` |
| Fee note | `.../[id]/fee-notes/route.ts` |

Read `bookingStatus.ts` first — it is 114 lines and it is the spine. Note the four lists:
which statuses release a diary slot, which block it, which are terminal, and which are
waiting on the firm. Keeping them in one file stopped two competing state machines that
existed before Phase 1.

### Who can read what — the privilege table

**The most important table in the system.** Decided in exactly one file,
[`src/lib/firms/access.ts`](../src/lib/firms/access.ts), and asserted by 41 cases.

| Who | Matter exists | Reads the description | Reads the messages |
|---|---|---|---|
| The client | yes | yes — they wrote it | yes |
| The assigned attorney | yes | yes | yes, if in the thread |
| Firm principal / practice manager | yes | yes — they must be able to reassign | **no**, unless in it |
| Another attorney at the same firm | yes | **no** | **no** |
| A paralegal | yes | **no** | **no** |
| An attorney who has **left** | **no** | **no** | **no** |
| Platform `ADMIN` (us) | yes | **no** | **no** |

Two things make this real rather than aspirational:

**Encryption at rest.** Those columns are AES-256-GCM encrypted, each value bound to its
own row and column. Blocking a read in code binds code; **a database dump does not go
through the code.** See [`src/lib/privacy/encryption.ts`](../src/lib/privacy/encryption.ts).

**Ciphertext is never a return value.** The disclosure gate has exactly three outcomes: the
words, `[Withheld — privileged]`, or `[Unavailable]`. Never the stored value — because
handing a blocked reader the ciphertext passes a naive check while giving them an
offline-attackable copy of a client's legal problem.

---

## Part 6 — Stop 3: inside a law firm

**Sign in as an attorney** and open `/en/dashboard/lawyer`.

| Screen | What it does |
| --- | --- |
| `/dashboard/lawyer` | Overview |
| `/dashboard/lawyer/firm` | The practice — members, offices, verification |
| `/dashboard/lawyer/firm/register` | Register a new practice |
| `/dashboard/lawyer/firm/requests` | Answer a client's data request (Part 9) |
| `/dashboard/lawyer/consultations` | **The matter queue** |
| `.../availability` | Diary — when this attorney can be seen |
| `.../pricing` | Consultation terms |
| `.../earnings` | What the firm has been paid |
| `.../refunds` | Refunds the firm owes |
| `/dashboard/lawyer/chat` | Messages with clients |
| `/dashboard/lawyer/payments/*` | **The firm's own bill from us** |
| `/dashboard/profile/privacy` | The attorney's own personal data |

### Why a `LawFirm` exists at all

Phase 2 added it, and it is the single most important structural change in the project.

Before, a matter belonged to an *attorney*. That is wrong in two ways: a firm is the entity
that contracts with a client and carries professional indemnity, and an attorney who leaves
cannot take a client's live matter with them.

It also turned out to be the thing that makes the directory risk survivable: because
matters route through `LawFirm`, the consumer front end is a **removable layer**. The same
engine underneath serves a business-to-business product with no touting question at all.

### Joining a firm — and the two rules with teeth

Open [`src/lib/firms/invitations.ts`](../src/lib/firms/invitations.ts).

- **`ATTORNEY_ONLY_ROLES`** — `FIRM_OWNER` and `ATTORNEY` require an admitted,
  **verified** attorney. A practice manager cannot become a partner by accepting an
  invitation.
- **An attorney cannot carry a live matter into a different practice.** Leaving a firm
  ends access — see the departed-attorney row in the privilege table.
- Invitations expire after **14 days** (`INVITATION_VALID_DAYS`).

`npm run check:firm` asserts 15 cases here.

---

## Part 7 — Stop 4: the platform admin

**Sign in as `ADMIN`** and open `/en/dashboard/admin`.

| Screen | What it does |
| --- | --- |
| `/admin/verification` | Verify an attorney's practising certificate |
| `/admin/firms` | Verify a law firm |
| `/admin/users` | User management |
| `/admin/invoices` | **Our** invoices to firms |
| `/admin/finances` | Financial reporting |
| `/admin/legal-documents` | Upload Acts into the AI's library |
| `/admin/privacy-notices` | Draft, version and publish the privacy notice |
| `/admin/advertisements`, `/advertisers`, `/ad-config` | Advertising (Part 11) |
| `/admin/communities`, `/content-moderation` | Community moderation |
| `/admin/consultations` | Matter list — **metadata only** |
| `/admin/subscriptions/*` | Plan configuration (mostly dead — Part 16) |

### What an admin deliberately cannot do

> **An `ADMIN` can see that a matter exists. They cannot read what it says.**

Open `/admin/consultations`. You will see status, dates, which firm. You will not see the
client's description of their problem, the conflict check, the quote's scope, the
engagement letter, or a single message.

**This is rule 5, and it is the one people find surprising.** Every other admin panel you
have built probably lets an administrator see everything, for support. Here, privilege
under Evidence Ordinance s.126 can be **lost** if a third party is in the conversation. A
support engineer reading a matter to be helpful could damage a client's position in their
own case. So the ability simply does not exist — in code *and* in the encryption.

---

## Part 8 — Stop 5: the AI assistant

**Open** `/en/chat`.

```
browser → POST /api/ai/ask → policy.ts → RAG service → policy.ts → user
                (server-side, always)
```

### The one thing to understand

**The browser never talks to a model.** Before Phase 5 it did — the page held a
`NEXT_PUBLIC_RAG_API_URL` and the user's question went straight from their machine to the
model. That made three things impossible at once: enforcing any rule, knowing what was
asked, and keeping the service off the public internet.

Now everything goes through [`src/app/api/ai/ask/route.ts`](../src/app/api/ai/ask/route.ts),
and **the order of operations is the compliance measure**:

1. **Classify the question.** If it asks for advice on the user's own matter, refuse
   **before** calling the model — so their account of their problem is never transmitted.
2. Generate.
3. **Evaluate the whole answer.** Withhold if it advises, steers toward a practitioner, or
   cites something that was never retrieved.
4. Only then store, and only then return.

> **Step 3 is why nothing streams.** A streamed answer has already been read by the time it
> could be checked, which makes the check theatre.

### The two rules the assistant lives under

- **It never advises you about your own case.** It explains what the law says.
- **It never names or steers toward a practitioner** — not by name, not by category,
  however you ask. `LAWYER_REQUEST_REFUSAL` is a **fixed string** on purpose: *a refusal a
  model composes is a refusal a model can compose its way out of.*

Citations come from **retrieval metadata, never the model**, so the model cannot invent a
source entry.

`npm run check:ai` asserts 52 cases. And see
[lawyer-rag/eval/](../../lawyer-rag/eval/) for the 76-question exam that measures whether
the answers are any good — a separate question from whether they are lawful.

---

## Part 9 — Stop 6: privacy and data rights

Sri Lanka's **Personal Data Protection Act** applies. The hard part here is not the rights
themselves — it is *whose data it is*.

### The two-hat problem

> For our own data (accounts, logins, the blog) we are the **controller**.
> For a firm's matter data we are the firm's **processor**.

That distinction decides everything. Open
[`src/lib/privacy/policy.ts`](../src/lib/privacy/policy.ts) and read `FIRM_CONTROLLED_MODELS`.

**Never delete, export, or seek consent for anything under `Booking`.** If a client asks us
to erase their matter, the honest answer is that it is the firm's file and the firm decides
— so the request is **referred to the firm**, which answers in its own words. That is
`SubjectRequestFirmResponse`, and the firm-side screen is
`/dashboard/lawyer/firm/requests`.

### What a person can actually do

| Screen | What it does |
| --- | --- |
| `/en/privacy` | Read the current published notice |
| `/en/privacy/[version]` | Read **any past version**, exactly as published |
| `/dashboard/profile/privacy` | See what we hold, export it, withdraw consent, object, ask for erasure |

### Why the notice is versioned and immutable

**Consent is only evidence if you can show what the person was told when they gave it.** A
notice you can silently edit proves nothing. So publishing writes a **new version**; past
versions stay readable at their own URLs; consent records point at the exact wording shown.

Recording a consent *grant* fails closed when no notice is published. A *withdrawal* never
does — you can always take it back.

### Erasure is not deletion

Read `ERASURE_PLAN` in `policy.ts`. Erasure **anonymises** the person and keeps records the
firm has a professional duty to retain. A matter file survives an erasure request, and each
retained model carries the reason.

Also: **never add a content column to `DataAccessLog`.** An access log that records what was
read becomes a second copy of the privileged material it was meant to protect.

`npm run check:pdpa` asserts 67 cases.

---

## Part 10 — Stop 7: money

Two entirely separate flows. Keeping them separate **is** the compliance.

### Flow A — the client pays the firm. We are not in it.

```
client ──────────── pays ────────────▶ firm's own bank account
   │                                      │
   └──── "I have paid" ──▶ platform ◀──── "received" ────┘
                    (a record, not a transaction)
```

We never touch the money. `BookingPaymentMethod` has exactly two values —
`BANK_TRANSFER` and `PAY_AT_OFFICE`. A `PAYHERE` option existed and was **removed in
Phase 0.3** because it settled client fees into a platform merchant account. That is rule 2,
and it is the Central Bank one.

**Refunds work the same way.** The firm holds the fee, so the firm refunds it and we record
it. And because a record resting on the firm's word alone is not enough, the client
confirms receipt — or disputes it: `NONE → PENDING → PROCESSED → CONFIRMED`, with
`DISPUTED` as the branch.

**Fee notes** ([`src/lib/consultations/feeNote.ts`](../src/lib/consultations/feeNote.ts))
are the firm's bill to its client. There is no commission column, no platform line, and no
place to put one.

### Flow B — the firm pays us. A normal software licence.

Open [`src/lib/firms/billing.ts`](../src/lib/firms/billing.ts). 176 lines, and it is where
the real licensing rule lives.

> **The licence belongs to the `LawFirm`. A seat is a person who can sign in.**

| May be metered | May **never** be metered |
| --- | --- |
| Seats | Clients |
| Storage | Matters |
| Templates | Enquiries |
| | Messages |
| | Introductions |

**Why:** revenue that moves with the volume of legal work is fee-sharing under a different
name. If we earn more because a firm got more clients, we are taking a cut of legal fees —
rule 1 — whatever we call the line item.

This is not theoretical. Three "inquiries" permissions sat in the seed until Phase 7, one
of them selling *"receive client inquiries"* as a tier feature. **That is pay-per-lead, in
a table nobody was looking at.**

`npm run check:billing` asserts 21 cases.

---

## Part 11 — Stop 8: advertising

A real revenue line, and the one with the sharpest edges.

Open [`src/lib/ads/eligibility.ts`](../src/lib/ads/eligibility.ts).

### Who may advertise

**Not lawyers.** Structurally: `AdCampaign` has **no relation to a lawyer or a firm**, so
an attorney cannot buy an advert even if someone tried to sell one.

`REFUSED_ADVERTISER_TRADES` blocks **23 trades** that are lawyers wearing a hat — *claims
management, accident claims, deed writing, litigation funding, legal expenses insurance*.
Screening is on the advertiser's **text**, not just a dropdown, because a category is chosen
by the person being screened.

### Where an advert may appear

Editorial surfaces only — pages a person reads for information:

```
HOMEPAGE_BELOW_HERO · BLOG_TOP_BANNER · BLOG_RIGHT_SIDEBAR · BLOG_BOTTOM_STICKY
BLOG_POST_SIDEBAR · BLOG_POST_BOTTOM · LEGAL_LIBRARY_SIDEBAR · CHAT_RIGHT_SIDEBAR
```

And `FORBIDDEN_AD_SURFACES`, kept as an explicit list so a new page **fails closed**:

```
/lawyers · /lawyers/[id] · /firms · /firms/[slug] · /firms/[slug]/engage
/lawyers/[id]/book · /dashboard
```

> **Why the directory is forbidden:** an advert inside a list of attorneys teaches a client
> that position in that list is purchasable, and blurs an advertisement into a listing —
> and that is true **whoever bought it**. `DIRECTORY_TOP` and `DIRECTORY_INLINE` were
> removed from the enum entirely in Phase 4.

Every advert is labelled `Advertisement` and every link carries
`rel="sponsored noopener noreferrer"`.

---

## Part 12 — Stop 9: community and content

The softest part of the system, and the easiest to understand.

| Thing | Where |
| --- | --- |
| Articles and posts | `/en/blog`, `Post`, `Article` |
| Communities | `Community`, `CommunityMember`, `CommunityRequest` |
| Comments and voting | `Comment`, `Vote` |
| Moderation | `Report`, `/admin/content-moderation` |
| Translation | `PostTranslation`, `CommentTranslation`, `/api/posts/[id]/translate` |
| Legal library | `LegalDocument`, `/en/legal-library` |

**Voting is on posts and comments — never on lawyers.** Star ratings on practitioners were
removed. (Worth knowing: they were reported removed two phases before they actually stopped
being collected. Grep before believing a removal.)

The **legal library** is the public face of the same Acts the AI searches. When the
assistant cites a section, the citation links here — which is what makes a citation
checkable by the person relying on it. Three Acts are in the vector store with no library
row, so their citations render as "Not yet in the library".

---

## Part 13 — The machine room

**29 files in `src/lib/`. These make the decisions. Everything else is plumbing and paint.**

Read them in this order:

| # | File | Lines | What it decides |
| --- | --- | --- | --- |
| 1 | `firms/access.ts` | 708 | **Who may read a client's legal problem.** The privilege table, in code |
| 2 | `ai/policy.ts` | 684 | **What the assistant may say.** Refusals, advice detection, citation checking |
| 3 | `privacy/policy.ts` | 530 | **Controller vs processor**, retention, consent, the erasure plan |
| 4 | `privacy/encryption.ts` | 440 | AES-256-GCM for matter fields, bound to row and column |
| 5 | `email/EmailService.ts` | 434 | Transactional email |
| 6 | `subscription.ts` | 309 | Old per-attorney resolver — **being deleted** (Part 16) |
| 7 | `privacy/subject.ts` | 281 | Data subject requests: export, erasure, objection |
| 8 | `firms/invitations.ts` | 274 | Who may join a practice, in what role |
| 9 | `consultations/feeNote.ts` | 250 | The firm's bill to its client |
| 10 | `privacy/notice.ts` | 238 | Versioned, immutable privacy notices |
| 11 | `consultations/engagementLetter.ts` | 207 | The snapshotted letter |
| 12 | `security.ts` | 203 | Rate limits, UUID validation, file magic bytes, headers |
| 13 | `ads/eligibility.ts` | 193 | Who may advertise, and where |
| 14 | `firms/provisioning.ts` | 187 | Setting up a new practice |
| 15 | `firms/billing.ts` | 176 | **Seats, never clients** |
| 16 | `privacy/firmResponse.ts` | 163 | A firm answering a client's data request |
| 17 | `ai/rag.ts` | 148 | The only code that talks to the AI service |
| 18 | `consultations/bookingStatus.ts` | 114 | The matter state machine |
| 19 | `privacy/audit.ts` | 92 | Access logging — **shape only, never content** |
| 20 | `ai/ragService.ts` | 70 | The AI service's address and shared secret |
| 21 | `auth.ts` | 66 | Sessions (JWT in an httpOnly cookie) |

If you read only three: **`firms/access.ts`**, **`ai/policy.ts`**, **`privacy/policy.ts`**.
Those three files are the product's conscience.

---

## Part 14 — The database

56 models. Nobody holds 56 things in their head — hold the **nine groups**.

| Group | Models | Notes |
| --- | --- | --- |
| **People & access** | `User`, `VerificationToken`, `LawyerApplication`, `LawyerProfile` | `role` is `ADMIN`/`LAWYER`/`CLIENT` and is **not** firm authority |
| **The practice** | `LawFirm`, `FirmOffice`, `FirmMember`, `FirmInvitation` | **`FirmMember` is where authority lives** |
| **The matter ⭐** | `Booking`, `ConflictCheck`, `Quote`, `EngagementLetter`, `SlotHold`, `BookingPayment` | The heart. **Five of these models carry encrypted columns** — 12 in all, listed in `ENCRYPTED_FIELDS` |
| **Diary & terms** | `LawyerAvailability`, `AvailabilityOverride`, `ConsultationPricing` | `ConsultationPricing` holds no price any more (Part 16) |
| **Our revenue** | `SubscriptionPlan`, `Subscription`, `SubscriptionCycle`, `Invoice`, `InvoiceRemark`, `SubscriptionDetails` | The firm's licence |
| **The firm's revenue** | `FeeNote` | The firm's bill to its client. **No commission column** |
| **Advertising** | `Advertiser`, `AdCampaign`, `AdPlacementConfig`, `AdSlotBooking`, `AdAnalytics` | **No lawyer relation, by design** |
| **Content & community** | `Article`, `Post`, `PostTranslation`, `Comment`, `CommentTranslation`, `Vote`, `Community`, `CommunityMember`, `CommunityRequest`, `Report`, `LegalDocument` | |
| **Messaging & AI** | `Conversation`, `ConversationParticipant`, `Message`, `AiConversation`, `AiMessage` | `Message.content` is encrypted |
| **Privacy** | `ConsentRecord`, `PrivacyNotice`, `DataAccessLog`, `DataSubjectRequest`, `SubjectRequestFirmResponse` | |
| **Permissions (mostly dead)** | `SubscriptionRole`, `Permission`, `SubscriptionRolePermission`, `Feature`, `FeatureLimitConfig`, `FeatureUsage` | See Part 16 |

### The absences are the design, again

When you read `schema.prisma`, look for what is **not** there:

- `FeeNote` has **no commission or platform-fee column**
- `AdCampaign` has **no lawyer or firm relation**
- `Booking` has **no rating**, and no platform payment account
- `ConsultationPricing` has **no price columns** — dropped in Phase 3
- `DataAccessLog` has **no content column**

Each of those is a rule enforced structurally: **the schema gives it nowhere to exist.**
Changing one is a migration, and a migration is a conversation.

### Changing the schema

```bash
npm run db:migrate -- --name what_you_did    # ✅ always
npx prisma db push                            # ❌ never on a shared database
```

Commit `prisma/migrations/` with the schema change, and **test the migration against a
database seeded with the data that would break it** — `scripts/tmp/mkdb.js` makes a scratch
database for exactly this. `npm run db:reset` is destructive and has been declined before.

---

## Part 15 — The plumbing

### Sessions and sign-in

[`src/lib/auth.ts`](../src/lib/auth.ts) — a JWT in an **httpOnly** cookie, so JavaScript
cannot read it. Email/password plus Google OAuth (`/api/auth/google/*`). Email
verification via `VerificationToken`.

### The route guard

[`src/proxy.ts`](../src/proxy.ts) — Next 16's middleware. It does **less than you expect**,
on purpose:

- No session and you asked for `/dashboard` → redirected to login.
- `/dashboard/admin` requires `role === 'ADMIN'`.
- **`/dashboard/lawyer` is deliberately NOT gated on role**, and there is a comment
  explaining why: a practice manager's role is `CLIENT`, and firm membership lives in the
  database, which the edge guard cannot read. The **layout** checks membership instead, and
  every `/api/firms` route checks it again.

> That is worth pausing on. The guard is not being lax — it is refusing to enforce a rule
> it cannot evaluate correctly. A guard that half-knows the answer is worse than one that
> defers to the layer that knows.

### Three languages

`next-intl`, with `messages/en.json`, `si.json`, `ta.json`. Every URL starts with a locale:
`/en/...`, `/si/...`, `/ta/...`.

> ⚠️ **Known gap:** the AI's refusal patterns are **English-only**. A question asked in
> Sinhala or Tamil bypasses the pre-generation check entirely. The honest interim position
> is to disable the assistant for `si` and `ta` until the patterns are translated — an
> assistant that refuses to answer is a smaller failure than one that advises a Sinhala
> speaker about their own case.

### Real-time messaging

`server.js` is a **custom server** — Next plus Socket.IO on one port, because chat needs a
websocket. Note the sanitising in there (`DANGEROUS_HTML_PATTERN` and friends): messages
are scrubbed of script tags, event handlers and `javascript:` URIs **on the server**,
before they are stored.

### Security helpers

[`src/lib/security.ts`](../src/lib/security.ts) — rate limiting, UUID validation, pagination
clamping, **file magic-byte validation** (a `.pdf` extension is not proof of a PDF), and
security headers.

> ⚠️ Rate limiting is **in-memory** and covers four routes — login, register, upload, AI.
> It resets on deploy and does not work across instances. Moving it to Redis is on the list.

---

## Part 16 — What is half-built, dead, or wrong

**Read this part before you trust anything you find in the codebase.** A system this size
accumulates things that look finished and are not.

### The permissions system is mostly imaginary

Five models, eight admin screens, ~480 lines. **`canUseFeature` is called by exactly one
route, which nothing in the UI calls.** The real licensing rule is
`firms/billing.ts` — 176 lines.

It is not merely untidy: **it is where guardrail violations hide.** The pay-per-lead
"inquiries" permissions sat in that seed for seven phases. **Decision: delete it**, keeping
`FeatureLimitConfig`/`FeatureUsage` for seats, storage and templates only.

### One concept, four names

The model is `Booking`, the code says "request" and "engagement", the client sees "matter",
and the URL says `consultations`. **Decision: rename to `Matter`** before the codebase
grows further.

### `ConsultationPricing` is a model named "Pricing" that holds no price

Its price columns were dropped in Phase 3 — a published consultation price is a rule-1
problem. What is left is a terms/notes row on a screen a lawyer would reasonably expect to
set fees on. **The name alone invites someone to put a price back.**

### Six payment pages where there should be two

`invoices`, `payments/history`, `payments/invoice` (a redirect), `payments/invoices`,
`payments/invoice/[planId]`, `payments/offline/[planId]`.

### Things that are documented but not provisioned

- **`MATTER_ENCRYPTION_KEYS` has no custody arrangement.** Losing it destroys every matter
  description, conflict check, quote scope, engagement letter and client message in the
  database. The procedure is written; **none of it is set up.** The key lives in a `.env`.
- **Nothing runs on a timer.** `npm run jobs:daily` exists and nothing calls it. A retention
  schedule nobody runs is a retention *document*.
- **Never deployed.** No Dockerfile, no CI, no TLS, no backups, no monitoring.

### And the one that teaches the most

`DashboardSidebar.tsx` is **dead** — imported by nothing. Phase 7's sidebar repair, recorded
as *"all 18 links now resolve, and every one was opened"*, went into that unused file. The
rendered sidebar is `AppSidebar.tsx`.

> **Check what is rendered, not what is named.** That single habit would have caught most of
> the defects this project has found the hard way.

Full register with a decision on every item: [OPEN-ITEMS.md](./OPEN-ITEMS.md).

---

## Part 17 — Exercises

Reading gets you a map. Driving gets you the territory. Do these in order.

**1. Run the five checks and read the assertion names.** Two minutes, and it is a spoken
summary of every rule.

**2. Drive a matter end to end.** Register a client, engage a firm, submit intake, assign an
attorney from the firm side, run a conflict check, issue a quote, accept it, record a
payment, confirm receipt, complete. **Every phase of this project found a real break by
doing exactly this.**

**3. Try to break privilege.** Sign in as a paralegal and open a matter. You should see that
it exists and not what it says. Then sign in as `ADMIN` and try the same.

**4. Ask the assistant for a lawyer.** *"Can you recommend a good property lawyer in
Colombo?"* Watch it refuse. Then ask *"My employer fired me without notice — what should I
do?"* and watch it refuse differently, **before** the model is even called.

**5. Read one policy file properly.** `firms/access.ts`. Then re-read the privilege table in
Part 5 and see how the code says the same thing.

**6. Find something wrong.** There is plenty. Check it against
[OPEN-ITEMS.md](./OPEN-ITEMS.md) — if it is not there, you have found something new, and
that is worth writing down.

---

## Where to go next

| I want to… | Read |
| --- | --- |
| Understand *why* a rule exists, in plain language | [HOW-IT-WORKS.md](./restructure/HOW-IT-WORKS.md) — the best document here |
| Know the hard constraints exactly | [LEGAL-GUARDRAILS.md](./restructure/LEGAL-GUARDRAILS.md) |
| Know what happened when | [PROGRESS.md](./restructure/PROGRESS.md) |
| Know everything outstanding | [OPEN-ITEMS.md](./OPEN-ITEMS.md) |
| Know what to build next | [DIRECTION.md](./DIRECTION.md) |
| Ship it | [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) |
| Work on the AI | [lawyer-rag/docs/](../../lawyer-rag/docs/) |

## The five things that will bite you

1. **A green build proves nothing.** Run the five checks. Then drive the actual app.
2. **Authority comes from firm membership, not platform role.** A practice manager is a
   `CLIENT`.
3. **Never meter clients.** Seats, storage and templates are software. Enquiries, messages,
   matters and introductions are clients — metering them is fee-sharing.
4. **Never break a working flow to make a legal fix.** Replace before removing.
5. **If you build a right, build the screen.** Phase 6 shipped an entire PDPA rights engine
   with no caller, and the compliance position was unchanged for two phases.
