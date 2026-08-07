# Counsel Meeting Brief — take this with you

> **Who this is for.** You, in a meeting with an Attorney-at-Law, today.
> Plain words. No legal jargon. Read it on your phone if you have to.
>
> The full list of 18 questions lives in [QUESTIONS-FOR-COUNSEL.md](./QUESTIONS-FOR-COUNSEL.md).
> This file picks the **five that matter most right now** and tells you how to ask them.

---

## Before you go — 4 practical things

1. **Check he is the right lawyer.** Ask at the start: *"Do you have experience with
   professional conduct rules for attorneys — the Supreme Court Rules, advertising and
   touting?"* Not every good lawyer knows this area. It is a niche. If he does not,
   the answers are worth much less, and you should ask him to refer you to someone who does.
2. **Agree the money first.** Ask what he charges and how. Do not start a two-hour
   conversation without knowing this.
3. **Write down his answers as he speaks.** Or ask if you may record. Later, ask for the
   important ones **in writing** — even a short email. A verbal "it's fine" protects you
   from nothing.
4. **Do not ask him to just say yes.** For each answer ask *"why?"* and *"which rule
   says that?"* You need his reasoning, not his comfort.

---

## Part 1 — The 3-minute introduction

**Say this first.** He needs to understand what you built before your questions make sense.

> "I am a software engineer. I built a legal platform for Sri Lanka. When I looked at the
> rules, I realised the original design was probably illegal, so for the last few weeks I
> have been rebuilding it to be safe. I want to check whether what I have now is actually
> safe — and whether one part of it can exist at all."

### What it used to be — and why I changed it

**The old design was a marketplace.** Like PickMe, but for lawyers.

- The client booked and paid **through my platform**
- I held the money, then passed it to the lawyer
- I took **15% commission** from every legal fee
- Lawyers could **pay me to appear at the top** of the search results
- Clients gave lawyers **star ratings**, and I sorted lawyers by rating
- My admin staff could **read what the client wrote about their legal problem**

I now believe every single one of those was a serious problem. So I removed them all.

### What it is now — software that law firms run on

The idea in one sentence:

> **The law firm provides the legal service. I only provide software.**

Like accounting software for a shop. The shop sells goods and takes the money; the
software just keeps the records. I want to be the software, not the shop.

### What I actually changed (say these — this shows you took it seriously)

| What I did | Why |
|---|---|
| **Deleted commission completely** | I take no share of any legal fee. Not 15%, not 1%. The column is deleted from the database, not just switched off |
| **Stopped holding money** | The client now pays the firm **directly**, into the firm's own bank account. I never touch it. I removed the payment gateway and the "wallet" system entirely |
| **Added a Law Firm to the system** | Before, the individual lawyer was the seller. Now the **firm** is the party the client engages. A solo lawyer becomes "a firm of one" automatically |
| **Deleted star ratings and reviews** | Gone from the database |
| **Made the directory alphabetical** | Nobody can pay for position. Nothing is "featured", "top rated" or "recommended". The page says out loud that ordering is alphabetical and cannot be bought |
| **One directory, two views** | There is a toggle: **"Practices"** (law firms) and **"People"** (individual attorneys). Same directory, two ways to look at it. Filters are only what the client types — practice area, district, language |
| **Changed how a booking works** | See the next section. This is the biggest change |
| **Blocked my own staff** | My admin users are blocked *in code* from reading what a client wrote about their legal problem |
| **Fixed the AI chatbot** | It explains what the law says. It refuses to advise anyone about their own case, and it never suggests any lawyer — not by name, not even by type |
| **Stopped selling ads to lawyers** | Only banks, insurers, universities etc. can advertise now. A lawyer literally cannot buy an ad — the database gives them nowhere to attach one |
| **Changed how I make money** | A flat monthly software fee to the firm, based on **how many staff log in** (seats). Not on how many clients they get |

### The directory has two tabs — explain this, he will ask

A *practice* is another word for a law firm. So the directory has two tabs:

- **"Practices"** — the law firms
- **"People"** — the individual Attorneys-at-Law

It is **one directory with two ways of looking at it**, not two separate products. Both are
alphabetical, both are free to be listed in, neither can be paid for.

**One thing to be honest about if he asks:** right now every firm on the platform is a
*firm of one*, because when I created the firm feature I automatically made a firm for each
existing attorney. So today both tabs show the same people — once as a person, once as
their own practice. That changes when real multi-attorney firms join.

### There are two ways a client can start — both are the client choosing

This matters, because they behave differently and he may see it as significant.

| | **Attorney-first** (the older path, still live) | **Firm-first** (the newer path) |
|---|---|---|
| The client picks | a named attorney **and a time slot** from that attorney's diary | a **firm** only |
| At the moment they submit | date and time are already fixed | **no attorney, no date, no fee** |
| What happens next | conflict check → fee quote | the firm assigns one of its attorneys → conflict check → fee quote **with a proposed time** |

I kept both on purpose. If a client already knows exactly which attorney they want, I did
not want to force them through a firm they do not care about. The system records which of
the two paths was used, permanently, so I can always show that the choice of practitioner
came from the client and never from me.

### How a client engagement works now

The old flow was "buy a consultation". The new flow is "ask a firm if they will act for you".

```
1. Client browses the directory            alphabetical, nobody paid to be there
2. Client chooses a firm (or a named lawyer) — THEIR choice, never mine
3. Client sends a request                  no date, no fee, no relationship yet
4. The firm assigns one of its attorneys   the FIRM decides, I never assign
5. That attorney does a conflict check     firm-internal, I cannot read it
6. The attorney sends a fee quote          the firm's own fee, firm's own bank details
7. Client accepts → engagement letter      THIS is when the lawyer-client relationship starts
8. Client pays the firm directly           I only record "the firm says it arrived"
9. Consultation happens
```

**The important point to make:** there is no price and no appointment until step 6.
A client cannot "buy a lawyer" on my platform. They ask, and the firm decides whether
it can act, what it charges, and when it can see them.

---

## Part 2 — The five questions

Ask them in this order. **Questions 1 and 2 are the important ones.** If you only get
through two, get through those two.

---

### ⭐ QUESTION 1 — Am I allowed to have a lawyer directory at all?

*(This is Q16 in the full list.)*

**Say this:**

> "My platform has a public directory with two tabs — one lists **law firms**, the other
> lists **individual Attorneys-at-Law**. Any verified attorney or firm can be listed, it is
> completely free, the order is alphabetical, and nobody can pay to appear higher. Clients
> can filter by practice area, district and language.
>
> But I have read Rule 40 of the Supreme Court Rules. It says an attorney may display
> their name, professional qualifications, academic qualifications, and office hours.
> That is a very short list.
>
> **My question is: does Rule 40 mean that is the maximum an attorney is allowed to show?
> Or is it a minimum, and other factual information is also fine?**
>
> And the bigger question behind it — **is a third party like me allowed to publish a
> directory of lawyers at all?**"

**Why this is the most important question.**

Everything I built sits on top of an assumption I have never checked: that a neutral,
free, unpaid list of lawyers is legal. If that assumption is wrong, the fix is not a
small change — I would have to **delete the entire consumer side of the product.**

**Follow-up questions — ask the first one, it is nearly as important as the question itself:**

- **"Is the answer different for the firm list and the attorney list?"** Rule 40 says an
  attorney may display the name of the attorney **or firm** — so firm names seem to be
  contemplated. **But a law firm in Sri Lanka is not a company and holds no licence of its
  own; it is just the attorneys inside it.** So I want to know: if listing individual
  attorneys is a problem, does listing firms have the same problem, or is it safer?
  *(Ask this plainly. Do not assume showing only firms is a way out — check whether it is.)*
- Does it help that listing is **free** and **open to every** verified attorney?
- If an attorney **gives me written permission** to list him, does that change anything?
- Can I show practice areas, courts, languages and years of experience? Or only the
  four things in Rule 40?

**What I do with his answer:**

| If he says | I do |
|---|---|
| "Yes, a neutral directory is fine" | Continue as planned. Huge relief |
| "Only the Rule 40 four items" | Strip the profile pages down. Painful but survivable |
| "Firms are fine, individuals are not" | Remove the **People** tab, keep **Practices**. Medium-sized change |
| "No, you cannot publish a directory" | **Delete the consumer product.** Switch to selling the software to companies to manage law firms they already hired. No directory, no browsing, no problem |

---

### ⭐ QUESTION 2 — Can I personally go to jail for this?

*(This is Q17 in the full list.)*

**Say this:**

> "I found an old law — the **Intermeddlers with Suitors Ordinance No. 11 of 1894**. As I
> understand it, 'touting' — sending clients to lawyers — is a **criminal offence** under
> it, and it does not only apply to attorneys. It can apply to the middleman.
>
> I am the middleman.
>
> **Does this Ordinance apply to a software company that publishes a lawyer directory and
> passes client enquiries to attorneys?**"

**Real-world way to explain touting:** it is like the man standing outside a hotel in
Kandy who grabs tourists and walks them to a particular gem shop, and the shop pays him
for each tourist. The law says you cannot do that with lawyers.

**Why this matters more than everything else.**

Every other mistake in this project is a *business* problem — I lose money, or I have to
rebuild something. This one is different. If the answer is bad, **I could be personally
charged with a crime.** Not the company. Me.

**Follow-up questions — these are the ones that really matter:**
- Does it change anything that **no attorney pays me anything** for visibility, position,
  or for receiving a client? Nobody can buy their way up my list.
- Does it change anything that I **do** charge attorneys a flat monthly fee — but only for
  practice-management software, not for getting clients?
  *(This is the one I am most worried about. Ask him directly.)*
- **What is my personal exposure as a director?**

**What I do with his answer:** if he says the Ordinance reaches me, I stop the consumer
product immediately. This is not something to manage or reduce. It is a stop.

---

### ⭐ QUESTION 3 — Is a search box the same as recommending a lawyer?

*(This is Q18 in the full list.)*

**Say this:**

> "In India there is a rule almost identical to our Rule 39. Indian courts decided that
> **any system that channels clients toward particular lawyers is indirect solicitation —
> even when a computer does it.** They specifically included search and filtering. The Bar
> Council of India sent legal notices to lawyer platforms because of it. And Sri Lanka
> never adopted the 2008 relaxation that India later made — so on paper we may be
> *stricter* than India.
>
> **On my platform the client types their own filters and gets an alphabetical list.
> I never rank, never recommend, never choose. Is that still solicitation by me?**"

**How to explain the distinction I am trying to draw:**

- The **phone book** — you look up what you want, it is alphabetical, nobody paid. I think this is me.
- A **broker** — you describe your problem and he says "go to this lawyer, he's the best for you". This is definitely not allowed.

I built the phone book on purpose. I need to know if the law sees a difference.

**Follow-up questions:**
- Is Indian case law persuasive in a Sri Lankan court, or irrelevant?
- Is there a version of this product that is **clearly safe** — for example, if there is no
  browsing or searching at all, and the client can only contact a firm they already know
  by name?

**Why I need this:** it tells me whether the search and filter feature has to be removed,
and it is the difference between a big change and a small one.

---

### QUESTION 4 — Is the way I make money legal?

*(This is Q1 in the full list.)*

**Say this:**

> "I know an attorney cannot share fees with a non-lawyer. So I removed all commission.
> The client pays the firm's full fee straight into the firm's own bank account, and I
> never see the money.
>
> Instead, I charge the firm a **flat monthly software fee**, based on how many staff have
> a login — I call them seats. A firm on one seat can handle a thousand clients for the
> same price. My income does not move with how much legal work they do.
>
> **Is a flat per-seat software subscription billed to a law firm free of the fee-sharing
> rule?**"

**Real-world way to explain what I am claiming:** it is like a hospital paying a monthly
licence for its patient-record software. The software company gets the same money whether
the hospital treats 10 patients or 10,000. It is not taking a cut of the doctor's fee.

**Follow-up questions:**
- Does it matter that the software **helps the attorney get work**? Is that itself a problem?
- Is there any pricing model I should avoid **even though it is flat** — for example
  charging by number of matters, or by the firm's revenue?
  *(I already avoid both. I want him to confirm I was right to.)*

**Why this matters:** this is my entire business model. If it is wrong, there is no company.

**A mistake I already made and fixed — tell him this, it shows good faith.** My old pricing
plans sold attorneys a quota of *client enquiries* and *client messages* per month — 10
enquiries on the cheap plan, unlimited on the expensive one. Nobody called it commission,
but the attorney was literally paying me more money to receive more clients. I deleted it.
**Ask him: was I right that this was fee-sharing?**

---

### QUESTION 5 — Am I damaging privilege by storing client secrets?

*(This is Q4 in the full list. This is the one I am building next, so I need it soon.)*

**Say this:**

> "When a client asks a firm for help, they type their legal problem into my system. That
> text sits on servers I operate. Same for the lawyer's notes, the conflict check, and the
> messages between the client and the lawyer.
>
> I know that under section 126 of the Evidence Ordinance, what a client tells their
> attorney is privileged — and that privilege can be **lost if a third party is in the
> conversation.**
>
> **I am a third party holding those communications. Am I damaging the client's privilege
> just by hosting the data?**"

**Real-world way to explain the worry:** privilege is like a sealed envelope between the
client and the lawyer that a court cannot open. My worry is that because the envelope
passes through my building, the other side's lawyer can argue it was never really sealed —
and the client loses that protection **in their own court case.** That is much worse than
a fine. It damages my user in the actual thing they came to me for.

**What I already built:** my own admin staff are blocked in code from reading the client's
description, the lawyer's notes, the conflict check, the quotes and the engagement letter.
I have an automated test that proves it, and I run it after every change.

**Follow-up questions:**
- Is a **written data-processor agreement** between me and each firm enough protection? Is
  there specific Sri Lankan wording it must contain?
  *(I need to write this document. Can you draft it, and what would that cost?)*
- Do **technical controls** — access blocks, audit logs, encryption — actually matter
  legally? Or is only the contract what counts?
  *(This decides what I build next month. If encryption is legally irrelevant, I would
  rather spend that time elsewhere.)*
- Does it change anything that the client writes their problem **before** any attorney has
  accepted them — so before a lawyer-client relationship even exists?
- If a court orders me to produce this material, am I obliged to be **able** to produce it,
  or obliged to be **unable** to?

---

## Part 3 — If there is extra time

Only if the first five are properly answered. In this order:

**6. Please review my engagement letter.** *(Q3)* — This is not really a question, it is a
job. My software generates the engagement letter automatically when a client accepts a
quote. **I wrote the wording myself. I am not a lawyer.** A real client will rely on this
document. Print it and hand it to him. Ask what it would cost for him to rewrite it
properly, and whether click-acceptance is enough or a signature is needed.

**7. Can non-lawyer staff see matter details?** *(Q8b)* — Right now I let a firm's practice
manager read matter details, because someone has to run the diary. I let paralegals see
that a matter *exists* but not read what it says. Is that the right line?

**8. Where is the line for the AI?** *(Q5f)* — My rule is: *the assistant may explain the
law, but never advise on your own case.* Is that the right line? **A worked example either
side of it would help me more than a general statement.**

**9. How long must conflict-check records be kept?** *(Q7c)* — I am building automatic
deletion next. I need a real number, and it conflicts with data-protection rules that say
delete things quickly.

**10. Is it wrong to reserve a time slot before the conflict check?** — On my **firm-first**
path nothing is scheduled until the firm has checked for a conflict of interest and the
client has accepted the fee. But on my older **attorney-first** path, the client picks a
date and time at the very start, and the system reserves it — *before* anyone has checked
for a conflict. I am not comfortable with that difference. **Should the attorney-first path
also stop reserving a slot until after the conflict check, or is holding a provisional time
harmless?** *(I am inclined to change it. I want to know whether I have to.)*

---

## Part 4 — Fill this in during the meeting

| # | Question | His answer | Sure or unsure? |
|---|---|---|---|
| 1 | Can a lawyer directory exist at all? | | |
| 1b | Is the answer different for **firms** vs **individual attorneys**? | | |
| 2 | Does the 1894 Ordinance reach me criminally? | | |
| 3 | Is client search indirect solicitation? | | |
| 4 | Is a flat per-seat software fee OK? | | |
| 5 | Am I damaging privilege by hosting the data? | | |

**Also ask at the end:**
- "What is the **one thing** in what I have described that worries you most?"
  *(This question is often worth more than all the others.)*
- "Is there anything I have not asked about that I should be worried about?"
- "Can I send you these answers in writing for you to confirm?"

---

## After the meeting

Bring the answers back and I will:
1. Record them in the answer log in [QUESTIONS-FOR-COUNSEL.md](./QUESTIONS-FOR-COUNSEL.md)
2. Update [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md) wherever an answer changes a rule
3. Note it in [PROGRESS.md](./PROGRESS.md)

**If the answers to questions 1 or 2 are bad**, we do not patch the product. We withdraw
the consumer directory and move to the B2B shape — software for companies managing law
firms they have already hired. No directory, no browsing, no introductions, so no touting
question at all. Phase 2 is what makes that switch survivable: now that the firm entity
exists, the consumer front end is a removable layer rather than the foundation.
