# Revenue Model — how this makes money, and what we should change

> Written 2026-09-12. Decisions are marked **DECISION** and are recommendations to be
> accepted or overruled, not settled fact. Where a number is an estimate rather than a
> measurement, it says so.
>
> Not legal advice. An engineering reading of the constraints, written to be checked.

---

## 1. The rule that shapes everything

> **Does the number we charge on count *software*, or *clients*?**
>
> Seats, storage, templates, features → **software**. Permitted.
> Enquiries, messages, matters, introductions, conversations → **clients**. Never.

Revenue that moves with the volume of legal work is fee-sharing, whichever way the invoice
points. This is not a stylistic preference — an attorney sharing fees with a non-lawyer
breaches the Supreme Court Rules, and we would be the mechanism of that breach.

**This rule has been broken twice, both times by accident, both times by someone building
a perfectly ordinary SaaS feature:**

- Phase 2.5 — subscription tiers sold `inquiries_per_month` and `chat_messages_per_month`,
  advertised on the public pricing page. *An attorney paid us more to receive more clients.*
- Phase 3 — an attorney without a plan saw only their five oldest client conversations,
  the rest reading *"Locked Conversation — Please upgrade to view this conversation."*
  That withheld **a client's own message from their own lawyer** over an unpaid software
  bill.

Neither was malicious. Both are what happens when you apply normal SaaS instincts to a
regulated profession. Assume you will be tempted a third time.

---

## 2. What we are permitted to charge for

| Stream | Model | Why it is clean | State today |
| --- | --- | --- | --- |
| **Firm SaaS licence** (the anchor) | Per seat / month | A software licence, decoupled from legal fees | ✅ Built, ⚠️ underpriced, ❌ collected manually |
| **Practice add-ons** | Per module | Document automation, e-sign, time recording, court diary | ❌ Not built |
| **Corporate panel management** | Enterprise annual | Companies managing outside counsel. Highest revenue per account, **no ethics question at all** | ❌ Not built |
| **Consumer subscription** | B2C monthly | Legal library, templates, AI research — selling *information*, not legal services | ❌ Not built |
| **Third-party advertising** | CPM / flat | **Non-lawyer advertisers only** | ⚠️ Serving works, **no billing module** |
| **Data & analytics** | Licence | Anonymised aggregate court/outcome trends | ❌ Not built |
| **CPD & events** | Per seat / sponsorship | A natural BASL partnership surface | ❌ Not built |

**Today, exactly one stream can actually take money: the firm licence. And it takes it by
an administrator looking at a photograph of a bank slip.**

---

## 3. What a seat is

The licence belongs to the **`LawFirm`**, not to an attorney. An attorney paying a platform
every month looks like an attorney paying for access to clients; a practice paying for
practice-management software is what we actually are.

**A seat is an `ACTIVE` `FirmMember` — a person who can sign in.** Attorney or not:
counting only attorneys would let a firm add unlimited paralegals free, and they use the
software just as much.

**A seat limit refuses a person, never a matter.** A firm on one seat may run a thousand
matters; it just does so with one login. If you ever find yourself writing a limit that
blocks a *matter*, stop — that is the rule breaking for the third time.

Resolution lives in [`src/lib/firms/billing.ts`](../src/lib/firms/billing.ts). Do not query
`prisma.subscription` by hand in a route.

---

## 4. Current pricing, and why I think it is wrong

### What is configured today

| Plan | Price / month | Seats | Storage | Effective price per seat |
| --- | --- | --- | --- | --- |
| Basic | **LKR 0** | 1 | 5 GB | — |
| Professional | **LKR 5,000** | 5 | 50 GB | LKR 1,000 |
| Premium | **LKR 10,000** | 20 | 250 GB | LKR 500 |
| Enterprise | *no price set* | unlimited | unlimited | — |

### The problem

At LKR 5,000/month, a **five-person law firm pays about USD 16 a month, all in** — roughly
USD 3.30 per person — for software that stores their client matters, encrypts privileged
material at rest, generates their engagement letters and issues their tax documents.

For comparison, international practice-management software (Clio, LawVu, Provakil and
similar) sits at **USD 39–129 per user per month**. Even discounting heavily for Sri Lankan
purchasing power — a factor of four to five is a defensible rule of thumb — the
corresponding figure would be **USD 8–25 per seat**, or roughly **LKR 2,500–7,500 per seat
per month**.

We are charging between a fifth and a tenth of that.

> **Be clear about the confidence here.** The comparables are real; the purchasing-power
> adjustment is an estimate, and I have no Sri Lankan market data and have not spoken to a
> single firm. Treat the direction as well-founded and the specific number as a starting
> hypothesis to test, not a conclusion.

Three further problems with the current shape:

1. **Per-seat economics run backwards.** Premium works out at LKR 500/seat against
   Professional's LKR 1,000. Volume discounting is normal, but a 20-seat firm paying half
   per head — and paying only twice what a 5-seat firm pays for four times the people — is
   giving away exactly the accounts worth the most.
2. **Bundled seat tiers punish growth at the boundary.** A firm going from 5 to 6 people
   doubles its bill. That is the moment they call to negotiate, or quietly share a login —
   and a shared login destroys the audit trail that the whole privilege story rests on.
3. **Enterprise has no price at all**, so the highest-value segment cannot be sold to.

### **DECISION 1 — move to true per-seat pricing**

| | Recommendation |
| --- | --- |
| **Solo practitioner** | **Free, 1 seat.** Acquisition. Sri Lanka has a very large number of sole practitioners and they are the cheapest route to credibility |
| **Per seat, beyond the first** | **LKR 3,500 / seat / month**, billed on `ACTIVE` members |
| **Annual** | Ten months for twelve — the standard incentive, and it stabilises cash |
| **Enterprise / corporate panel** | Quoted annually. Price it separately; it is a different product with a different buyer |

Why per-seat rather than tiers: it is the only metric we are permitted to charge on, so it
should be the metric the customer sees. It scales smoothly, it removes the boundary
negotiation, and it removes the incentive to share a login. Keep storage and template
limits as *fair-use* ceilings, not as the thing being sold.

**Do not delete the existing tiers until firms are migrated onto seats.** Replace before
removing.

---

## 5. How we get paid — the part that actually blocks revenue

### How it works today

1. The firm's principal picks a plan; an `Invoice` is created.
2. The firm transfers money to our bank and **uploads a photograph of the receipt**.
3. An **administrator looks at the image** and marks the invoice `PAID`.
4. Marking it paid activates the subscription.

This is lawful and it is honest. It is also **entirely manual, unbounded in latency, and
dependent on a human looking at a picture** — and it will not survive twenty customers,
let alone two hundred.

### The misconception worth killing

Phase 0 removed PayHere, and the reasoning is recorded so clearly that it is easy to draw
the wrong conclusion from it. So, plainly:

> **We may absolutely take card payments for our own software licence.**
>
> Rule 2 forbids holding **money owed to a lawyer for legal work**. A firm paying *us* LKR
> 3,500 for a software seat is **our own revenue**. It is not client money, it is not a
> legal fee, and no part of it belongs to an attorney. A payment gateway settling our
> subscription revenue into our own account raises none of the Payments and Settlements
> Systems Act questions that escrowing a consultation fee does.

PayHere was removed because it was settling **consultation fees** into a platform merchant
account. That is the thing that was wrong — not the existence of a payment gateway.

### **DECISION 2 — integrate a gateway for subscriptions only, with a structural boundary**

- Wire a gateway (PayHere, Stripe, or a local acquirer) to the `Invoice` model **only**.
- **Never** to `Booking`, `BookingPayment`, `Quote` or `FeeNote`. A client paying a firm
  must continue to pay the firm's own bank account directly.
- Enforce that boundary the way this codebase enforces everything else that matters:
  **structurally**. The gateway module must have no import path to matter payments, and
  `check:billing` should gain a case asserting it.
- Keep manual bank transfer as an option. Many Sri Lankan firms will prefer it, and
  removing it would lose customers for no benefit.

The prize is not convenience. It is that revenue stops depending on an administrator's
attention, and renewals stop being a monthly act of chasing.

---

## 6. Advertising — built, serving, and unbillable

The advertising system works and is carefully constrained: `AdCampaign` belongs to an
`Advertiser` and has **no relation to a lawyer or a firm at all**, so an attorney cannot
buy visibility because the schema gives them nowhere to be. A named administrator must
positively confirm each advertiser is not a legal-services provider. Adverts appear only on
editorial surfaces, are labelled "Advertisement", and always link outward.

**There is no billing module.** Advertisers are invoiced outside the platform, by hand.
Placement prices are seeded (LKR 800–2,500 per day) but nothing turns a served impression
into an invoice.

### **DECISION 3 — do not build advertiser billing yet**

It is a real revenue stream and it is genuinely clean, but it is **second** to the firm
licence, for three reasons: the audience is small until the consumer side has traffic; the
consumer side is exactly the part that may have to be withdrawn (Counsel Q16–18); and every
hour spent here is an hour not spent making the firm product worth LKR 3,500 a seat.

Revisit once counsel has answered and there is measurable traffic. Until then, invoice the
handful of advertisers by hand — that is the correct amount of engineering for the volume.

---

## 7. Fee notes — the firm's invoice, our document

The single most common confusion in this codebase. Learn the pair:

| Model | Who bills whom | For what | Do we touch the money? |
| --- | --- | --- | --- |
| `Invoice` | **us → firm** | the software licence | **yes** — it is our revenue |
| `FeeNote` | **firm → its client** | legal work | **never** |

A fee note is a document we render. The firm bills under its own TIN and VAT number, into
its own bank account, and we are not in the transaction at any point.

- **There is no platform-fee column and no commission column on `FeeNote`** — not a
  nullable one, not one defaulting to zero. *A column that exists is a column a future
  product decision can populate.* **The absence is the guardrail.** If you are asked to add
  one, that is the restructure being undone.
- **"Record as paid" records; it does not verify.** There is no admin approval, because we
  did not see the payment and cannot honestly attest to it.
- **A cancelled fee note keeps its number.** A gap in the series is a question the firm has
  to answer to a tax officer, created by our convenience.

---

## 8. What this could be worth

Illustrative only — there is no market research behind these numbers, and they exist to
show the *shape* of the model rather than to forecast.

At **LKR 3,500 per seat**, with solo practitioners free:

| Scenario | Paying firms | Avg paying seats | Monthly | Annual |
| --- | --- | --- | --- | --- |
| Early traction | 20 | 4 | LKR 280,000 | ~LKR 3.4M |
| Modest success | 100 | 5 | LKR 1,750,000 | ~LKR 21M |
| Category leader | 400 | 6 | LKR 8,400,000 | ~LKR 101M |

Two observations that matter more than the figures:

1. **The model is boring, and that is the point.** It scales with the number of people
   using software, not with anybody's legal problems. It is defensible to a regulator on
   the face of the invoice.
2. **Corporate panel management is the highest-value line and has no ethics question
   attached.** A company managing law firms it has already retained involves no
   introduction, no directory, and no touting. If Counsel Q16–18 comes back badly, that
   line survives untouched — which is also why it is the strategic hedge, not just a
   revenue stream. See [DIRECTION.md](./DIRECTION.md).

---

## 9. Decisions summary

| # | Decision | Effort | Blocked by |
| --- | --- | --- | --- |
| 1 | Move to true per-seat pricing; solo free; LKR 3,500/seat; price Enterprise | Medium — migration + pricing page | Nothing. Validate with 5–10 real firms first |
| 2 | Payment gateway for **subscriptions only**, with a structural boundary and a `check:billing` case | Medium | Choosing an acquirer |
| 3 | Defer advertiser billing | — | Counsel Q16–18, and traffic |

**Before acting on Decision 1, talk to ten firms.** The direction is well-founded; the
number is a hypothesis. Ten conversations will settle it better than any further analysis,
and this project's whole history says the same thing in a different register: **verify by
running, not by reasoning.**
