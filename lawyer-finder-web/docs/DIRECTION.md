# Direction — what to build next, and in what order

> Written 2026-09-12, after Phase 8. This is a recommendation, not a decision already
> taken. Read [THE-PROJECT.md](./THE-PROJECT.md) first if you need the context, and
> [OPEN-ITEMS.md](./OPEN-ITEMS.md) for the full register this draws on.

---

## 1. Where the project actually stands

Nine phases have produced something genuinely unusual: **a legally defensible legal-tech
product**. The commission is gone, the escrow is gone, paid ranking is gone, privilege is
enforced in one file and asserted by 41 cases, matter data is encrypted at rest, the AI
refuses to advise, and the PDPA rights are real and reachable.

That work is done and it was the hard part.

**What is not done is everything that makes it a business.** The system has never been
deployed. It cannot take a payment without an administrator looking at a photograph. It has
no processor agreement to offer a firm, no custody arrangement for the key that protects
every matter, no tests of any user flow, and no answer to the question of whether its
consumer front end may lawfully exist.

> The honest summary: **the legal risk has been engineered down to near zero, and the
> execution risk is entirely untouched.**

---

## 2. The strategic question, and my recommendation

Everything forks on Counsel Q16–18: *may a consumer directory of attorneys lawfully exist
in Sri Lanka?*

| | **Shape A — consumer directory + firm software** (today) | **Shape B — firm and corporate software only** |
| --- | --- | --- |
| Who pays | Firms, per seat | Firms and companies, per seat |
| Directory | Public, alphabetical, unpurchaseable | None |
| Touting exposure | **Real, unresolved, criminal in the worst case** | **None** |
| Revenue today | Zero — the directory earns nothing | Same, per seat |
| If counsel says no | Front end withdrawn; product survives | Unaffected |

**Notice what the table shows: the directory carries all of the legal risk and none of the
revenue.** It is a customer-acquisition channel — a good one, possibly — but it is not the
product and it is not the money.

### **RECOMMENDATION: build B2B-first, and put the directory behind a feature flag.**

Concretely:

1. **Treat the firm product as the product.** Practice management is what firms pay for
   every month, and it raises no touting question at any scale.
2. **Put the consumer directory behind one feature flag**, so withdrawing it is a config
   change rather than a release. SYSTEM-REVIEW §3.7 recommended this and it has not been
   done. It costs a day and it converts an existential risk into a switch.
3. **Ask counsel now** (A1). If the answer is favourable, the flag stays on and the
   directory becomes an acquisition channel with a clean conscience. If not, you flip one
   boolean instead of unpicking a product.
4. **Prioritise corporate panel management** when you get to new features — companies
   managing firms they have *already* retained. Highest revenue per account, and **no
   introduction, no directory, no touting question at all.**

This is not pessimism about the directory. It is refusing to let an unanswered question
sit on the critical path when it does not have to.

---

## 3. The sequence

Four phases. The ordering principle: **make it real, make it safe, make it pay, then make
it better.** Nothing here is a feature until the product can be deployed and paid for.

---

### Phase 9 — Make it real *(the only phase that matters right now)*

**Goal: a real firm can use this, on the internet, and we can be paid for it.**

Nothing in Phase 9 is a new feature. Every item is the difference between a good codebase
and a product.

| # | Item | Why now | Ref |
| --- | --- | --- | --- |
| 1 | **Ask counsel** — Q16–18, plus the processor agreement and DPO | Seven phases overdue. Book it first; the answer takes weeks to arrive and everything else can proceed in parallel | A1, A2, A3 |
| 2 | **Deploy it** — host, TLS, managed Postgres, backups with a *tested restore*, error monitoring, CI | It has never run anywhere but `localhost` | B3 |
| 3 | **Provision key custody** — secrets manager, second copy, tested restore, two custodians | Losing the key destroys every matter. The procedure exists; the control does not | B1 |
| 4 | **Authenticated file serving for identity documents** | Practising certificates and face photographs currently have nowhere safe to live | C1 |
| 5 | **Schedule `jobs:daily`** | One cron entry. A retention policy nobody runs is not one | B2 |
| 6 | **Payment gateway for subscriptions**, with the structural boundary and a `check:billing` case | Revenue currently depends on someone looking at a picture | Rev. D2 |
| 7 | **Per-seat pricing** — after talking to ten firms | The current price is a fifth of a defensible one | Rev. D1 |
| 8 | **Feature-flag the consumer directory** | Converts the existential risk into a switch | §2 above |
| 9 | **One end-to-end test**: the full firm-first engagement | Would have caught defects in at least four phases | C4 |
| 10 | **Decide database hosting jurisdiction** | Far cheaper now than after real client data exists | A4 |

**Definition of done:** a Sri Lankan law firm can sign up on a real domain, be invoiced,
pay by card or bank transfer, run a matter end to end, and we can restore their data from a
backup and produce a processor agreement when they ask for one.

---

### Phase 10 — Clean the house

**Goal: the codebase stops carrying weight that slows every future change.** Do this
*before* adding features, not after — the cost only grows.

| # | Item | Ref |
| --- | --- | --- |
| 1 | **Delete the permissions system** — 5 models, 8 screens, ~480 lines, almost entirely unenforced, and where two guardrail violations hid | D1 |
| 2 | **Rename `Booking` → `Matter`**, `/api/consultations/bookings` → `/api/matters` | D2 |
| 3 | **Fold the two subscription resolvers and the two matter-listing routes** | D3 |
| 4 | **Settle the AI model** — one model, one config, hosted inference, measured | E1, E2 |
| 5 | **Disable the assistant for `si`/`ta`** until refusal patterns are translated | E3 |
| 6 | **Delete `DashboardSidebar.tsx`**, fold `ConsultationPricing`, collapse the six payment pages | D4, D5, D6 |
| 7 | **Rate limiting to Redis**, extended to every write route | C2 |
| 8 | **Register the three missing Acts** | E4 |

---

### Phase 11 — Make it worth paying for

**Goal: features a firm would miss if you took them away.** Only start once Phase 9 is
done and real firms are on it — their complaints should reorder this list.

Ordered by my estimate of value to a Sri Lankan practice:

1. **Court date diary with cause-list integration.** Sri Lankan courts publish cause lists.
   Auto-matching them to firm matters and pushing reminders is plausibly the single
   most-loved feature this product could ship — **missing a court date is a lawyer's
   nightmare**, and nothing else on this list has that emotional weight.
2. **Time recording and matter budgeting.** What practice-management software is actually
   bought for, every month, everywhere in the world.
3. **Sri Lankan document automation.** Deeds, affidavits, plaints, MOUs. Pair with notary
   support — the Notaries Ordinance protocol register is crying out for digitisation, and
   `LawyerProfile.isNotary` already exists.
4. **Corporate panel management.** Enterprise tier, highest revenue per account, zero
   ethics exposure. **The strategic hedge as well as a revenue line.**
5. **Sinhala and Tamil legal NLP.** Genuinely underserved, and a real moat — but it needs
   E3 solved first.
6. **Matter-scoped AI** — a research assistant over the firm's *own* files. Needs its own
   design: firm-scoped context, a processor agreement, and counsel question 4. **No matter
   data reaches a model until that is settled.**
7. **Pro bono / Legal Aid Commission module.** Cheap, builds BASL goodwill, opens donor and
   CSR funding.
8. **CPD tracking** and a **case-law citator** over the existing RAG corpus.

---

### Parallel track — BASL, starting now

Not a code task, and plausibly the highest-leverage thing on this page.

Approach the Bar Association **before** scaling, and seek a formal view or an MOU. The
biggest regulatory risk is also the biggest available moat: *"the platform BASL endorses"*
is a position no competitor can copy, and it converts Q16–18 from a threat into a
credential. Use the counsel answers from A1 to seed the conversation.

---

## 4. What I would do in the next two weeks

If nothing else happens, do these five:

1. **Book the counsel meeting.** [COUNSEL-MEETING-BRIEF.md](./restructure/COUNSEL-MEETING-BRIEF.md)
   has been ready since Phase 6. One email.
2. **Get it deployed somewhere**, even unpolished, with backups and a tested restore.
3. **Move `MATTER_ENCRYPTION_KEYS` into a secrets manager** and test restoring it.
4. **Talk to ten Sri Lankan law firms.** Not to sell — to find out what they use today,
   what they would pay, and whether the engagement flow matches how they actually work.
   This project has been reasoned about for nine phases and validated with zero users.
5. **Feature-flag the directory.** One day, and it de-risks everything else.

Numbers 1 and 4 are the two that cannot be done by writing code, which is exactly why they
have not been done. **They are also the two with the most leverage.**

---

## 5. The one-line version

> **The legal work is done. Now deploy it, get it paid for, and go and talk to some
> lawyers — because after nine phases of careful reasoning, the biggest remaining risk is
> that nobody has ever tried to use it.**
