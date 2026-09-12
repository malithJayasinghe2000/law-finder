-- CreateEnum
CREATE TYPE "PrivacyNoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "PrivacyNotice" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Privacy Notice',
    "body" TEXT NOT NULL,
    "changeSummary" TEXT,
    "status" "PrivacyNoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyNotice_version_key" ON "PrivacyNotice"("version");

-- CreateIndex
CREATE INDEX "PrivacyNotice_status_publishedAt_idx" ON "PrivacyNotice"("status", "publishedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed the first published version.
--
-- This is a DATA migration on purpose, not a job for the seed script. Every
-- existing `ConsentRecord` carries `noticeVersion = '2026-08-03'` and, until
-- this row exists, points at a document nobody can produce — which is not
-- demonstrable consent. A database that has had `migrate deploy` run against it
-- but not the seed would still be in that state, so the document ships with the
-- schema that references it.
--
-- The text lives here rather than in TypeScript because a published notice is
-- an immutable snapshot, like `EngagementLetter.body`. There is deliberately no
-- constant in the codebase holding it: a second copy is a copy that can drift
-- from the one people actually agreed to.
--
-- `changeSummary` says out loud that this version was written on the day the
-- register was created. The alternative — quietly backdating a document — would
-- make the register itself dishonest on its first row.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO "PrivacyNotice" ("id", "version", "title", "body", "changeSummary", "status", "publishedAt", "publishedById", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '2026-08-03',
  'Privacy Notice',
  $notice_body$
# Privacy Notice

**Version 2026-08-03.** This is the notice that explains what personal data TheLawyr
collects, why, on what legal basis, who can reach it, and how long we keep it.

It is written to be read, not to be survived. Where something is unusual, it says so.

---

## 1. The most important thing on this page

**There are two different kinds of data here, and we have a different role for each.**

| | Data about **you and your account** | Your **matter file** with a law firm |
| --- | --- | --- |
| Examples | Your name, email, sign-in details, community posts, questions you asked the legal assistant | What you told your attorney about your problem, conflict-of-interest checks, quotes, engagement letters, fee notes, messages with your attorney |
| Who decides what happens to it | **We do.** We are the controller | **The law firm does.** They are the controller; we only host it for them |
| Who you ask to see it or delete it | Us | **The firm.** We pass your request to them and tell you which firm |

This is not a technicality we are hiding behind. A law firm can be *professionally
required* to keep your file — a duty that outlives your request and that we have no
power to override. If we deleted your matter file because you asked us to, we would be
destroying a record the firm may have to produce, on our own authority, as their
processor. So we do not, and this notice will not pretend otherwise.

**TheLawyr is not a law firm.** We do not provide legal services, we are not a party to
any engagement between you and a firm, and we receive no part of any legal fee. We sell
software to law practices. Anything you are advised is advised by the attorney, not by us.

---

## 2. Who we are, and how to reach us

TheLawyr operates this platform. Write to **hello@thelawyr.lk** about anything in this
notice, including a data-protection complaint.

We have **not yet designated a data protection officer**. We are saying so rather than
leaving a gap you would have to notice: if that changes, it will change in a new version
of this notice with the date on it.

---

## 3. What we collect, and why

### 3.1 Your account

| What | Why |
| --- | --- |
| Email address, password (stored only as a one-way hash), or your Google account identifier if you sign in with Google | To create and secure your account |
| Your name and profile photograph, if you provide them | So people you deal with know who you are |
| Whether your email is verified, and your account status | Security, and to stop an abandoned account being taken over |

**Legal basis: performance of our contract with you.** You cannot use the platform without
an account, so this is not consent and we do not ask for it as though it were.

### 3.2 If you apply to be listed as an Attorney-at-Law

| What | Why |
| --- | --- |
| Your National Identity Card number, your BASL registration number, your practising certificate and a photograph of you | To check that a person holding themselves out as an admitted Attorney-at-Law really is one |
| Your practice details: address, contact number, districts, courts, practice areas, languages, year of admission, notary status | To display your professional listing, within the limits Supreme Court Rule 40 sets on what may be displayed about an attorney |

**Legal basis: our legitimate interest** in not publishing an unverified claim that
somebody is entitled to practise law. This is deliberately **not** consent: a verification
you could withdraw while the listing stayed up would be worthless.

### 3.3 What you ask the legal assistant

Your questions to the AI assistant, and its answers, are kept so you can return to them.

**If you are not signed in, your questions are not stored at all.** A guest has no history
to come back to, so there is no reason to hold their account of a legal problem.

**The assistant explains what the law says. It never advises you about your own case** —
questions about your own situation are refused before they are sent anywhere. This is a
legal rule about who may practise law, and it is also why the assistant is the one part
of this platform we deliberately made less useful than we could have.

**Legal basis: performance of our contract with you** — you asked for the service.
Whether we *keep the history* is a separate question, and that one is consent: see §6.

### 3.4 What you post in the community

Posts, comments, votes and reports. Posting "anonymously" hides your name **from other
readers**. It does not hide it from us: the record still identifies you, because
moderation would be impossible otherwise. We would rather say that plainly than let the
word "anonymous" do work it cannot do.

**Legal basis: performance of our contract with you.**

### 3.5 Your matter with a law firm

When you engage a firm through this platform, the firm's file about you is created here:
what you said about your problem, the firm's conflict-of-interest check, any quote, the
engagement letter, fee notes, records of payments you made **directly to the firm**, and
your messages with your attorney.

**We never see your money.** Fees are paid into the firm's own bank account. We record
that a payment is expected and that the firm said it arrived. There is no platform
balance, no escrow and no wallet.

**Legal basis: the firm's, not ours** — performing your engagement with them, and their
own professional and legal obligations. **This is not consent**, and we will not present
it as consent: implying you could withdraw it would be a promise we cannot keep against a
firm that is required to keep the file.

### 3.6 Records of who read what

When somebody at a law firm opens your matter file, we record **that it happened** — who,
when, and which record. We do not record **what it said**. There is no column anywhere in
that log for your matter description, not even a truncated one, because a log that copied
it would simply be a second copy of your confidential material with different access rules.

**Legal basis: our legitimate interest** in being able to answer the question "who read
this?", which is also your protection.

---

## 4. Who can see your matter — and who cannot

Your account of your legal problem is **privileged** under section 126 of the Evidence
Ordinance. Privilege can be weakened if a third party is inside the conversation, so the
rule here is not "we treat it as confidential" but "the number of people who can reach it
is kept to the minimum that still lets a practice run".

| | Sees the matter exists | Reads what you wrote | Reads your messages with your attorney |
| --- | --- | --- | --- |
| You | yes | yes | yes |
| The attorney handling it | yes | yes | yes |
| The firm's principal or practice manager | yes | yes — they must be able to reassign it | **no**, unless they are in the conversation |
| Another attorney at the same firm | yes | **no** | **no** |
| A paralegal at the same firm | yes | **no** | **no** |
| An attorney who has **left** that firm | **no** | **no** | **no** |
| Any attorney at a different firm | **no** | **no** | **no** |
| **TheLawyr's own staff, including administrators** | yes | **no** | **no** |

That last row is the one to read twice. **Our own staff cannot read what you wrote about
your legal problem, or your messages with your attorney.** This is enforced in code in one
place, and there is a test that fails the build for every row of that table.

**It is also encrypted.** Your matter description, the conflict-check record, the quoted
scope of work, the engagement letter and every message between you and your attorney are
encrypted in the database, tied cryptographically to the record they belong to. Somebody
with a copy of the database, and no key, has nothing.

---

## 5. Who else receives your data

We do not sell personal data. We do not allow advertising to be targeted on anything you
wrote about a legal problem — advertisers can choose a *page*, never a person, and no
attorney or law firm may buy advertising here at all.

| Who | What reaches them | When |
| --- | --- | --- |
| **The law firm you engage** | Your matter, as above | When you engage a firm |
| **Our hosting and database provider** | Everything we hold | Always — see §8 |
| **The service behind the legal assistant** | The text of the question you type | Only when you use the assistant. **Nothing from a matter file is ever sent** — there is no route through which it could be |
| **Google** | Your Google account identifier and email | Only if you choose to sign in with Google |
| **Our email provider** | Your email address and the message | Verification, notifications |
| **Our image hosting provider** | Images you upload | Profile photographs, payment receipts, identity documents |
| **Google Translate** | The text of a **public community post** | Only when someone asks for that post to be translated. Nothing private is sent |
| **The Data Protection Authority, a court, or a regulator** | What we are lawfully required to produce | If we are lawfully required to |

---

## 6. The three things we ask consent for — and nothing else

Consent here is genuinely optional. **Refusing all three costs you nothing**; every part
of the platform still works.

| Purpose | What it means | What happens if you withdraw it |
| --- | --- | --- |
| **Product news and offers** | Occasional email about new features | We stop sending. Nothing else changes |
| **Usage analytics** | Non-essential measurement of which screens get used, so we know what to build. Never applied to anything you wrote about a legal problem | We stop collecting. What already exists carries no identifier |
| **Keeping my AI chat history** | Keeps your conversations with the assistant so you can return to them | **Your existing conversations are deleted**, not merely hidden. Withdrawal that leaves the data in place is not withdrawal |

**Your matter data is deliberately not on that list**, and cannot be added to it. See §1
and §3.5.

You can change any of these at any time on the **Your data** page in your account, and we
record which version of this notice was in force when you did.

---

## 7. How long we keep things

| What | How long | Why this period |
| --- | --- | --- |
| Your account | While it is open, plus a short grace period | You may come back |
| Conversations with the legal assistant | **180 days from the last time you used that conversation** | Counted from last use, not creation, so an active conversation is never deleted underneath you |
| An application to be listed as an attorney | **730 days** from the last update. An approved one is cut down to a stub immediately, because its contents have moved to the professional profile | Long enough to answer a challenge to how we handled it; short enough that a rejected applicant is not on file indefinitely. Two copies of a national identity number is one too many |
| A held appointment slot that lapsed | **7 days** after it expires | It records which attorney you were considering, which says something about your affairs, and serves no purpose once lapsed |
| Sign-in and verification tokens | **30 days** after expiry | A spent credential is only a liability |
| The record of who read a matter | **730 days** | Long enough to investigate a complaint; short enough that it does not become a permanent history of a firm's working habits |
| Moderation reports | **365 days** after resolution | |
| **Your matter file, and everything in it** | **The firm decides.** Nothing in it is on any automatic deletion schedule of ours | An attorney's professional duty to retain a file is not ours to set, and we would rather hold something too long than destroy a record a firm is required to produce |

---

## 8. Where your data is held

**This is the one section of this notice we cannot yet complete honestly, so we are not
going to pretend otherwise.**

The Personal Data Protection Act restricts sending personal data outside Sri Lanka. Two
things could cross a border: where the database is hosted, and the service behind the
legal assistant. We have not yet settled and documented either, and it is on our list of
questions for Sri Lankan counsel.

**Before this platform carries a real client's matter, this section will name the
countries and the safeguard relied on.** If you are reading a version of this notice that
still says this, it has not been settled yet.

---

## 9. Your rights, and how to use them

Go to **Your data** in your account. Everything below is a button there — none of it needs
an email to support.

**We aim to answer within 21 days.** That is our own standard, set deliberately below the
statutory maximum so a request that is slipping is visible to us before it is late in law.

### See and download what we hold

You get a file containing your account, your consents, your conversations with the legal
assistant, your community activity, and any attorney application.

**It does not contain your matter files**, and that is not an oversight:

- Those belong to the law firm, not to us.
- A **conflict-of-interest record names other people** — other clients, opposing parties.
  Answering your request by handing it over would breach several other people's
  confidentiality at once, and would tell you the names of everyone the firm screened you
  against.

The file names the firms to ask instead, and we pass your request to them.

### Correct something

You can correct your own name and photograph directly. You cannot edit your matter file —
it is the firm's record of what happened, and a client rewriting it would corrupt the file
rather than correct it. Send a correction to the firm and they will decide.

### Delete your account — and what that really does

**Deletion here is partial, and irreversible.** We will tell you exactly which parts
before you confirm, and again afterwards. In summary:

- **Deleted:** your conversations with the legal assistant; any attorney application and
  the identity documents on it; your votes; lapsed appointment holds.
- **Overwritten:** your name, email, photograph and sign-in credentials. The account
  record itself survives with nothing identifying in it — deleting the row outright would
  damage or orphan a law firm's file, which is not ours to break.
- **Detached from you:** your community posts and comments. The text stays, because other
  people's replies depend on it; your name comes off it.
- **Kept:** your matter file and everything in it, and the record of what you consented to
  and when. For each one, we tell you which duty required keeping it. **A refusal that
  does not name the duty is not a real answer**, so you will always get the reason.

### Object, or complain

Write to hello@thelawyr.lk. You also have the right to complain to Sri Lanka's Data
Protection Authority, and you do not have to come to us first.

---

## 10. Security

Passwords are stored as one-way hashes, never in a readable form. Your matter description,
conflict checks, quoted scope, engagement letter and attorney messages are encrypted at
rest and cryptographically bound to the record they belong to, so a copied value will not
decrypt somewhere else. Access to matter data is decided in one place in our code and
recorded when it happens.

No system is perfectly secure, and we would rather describe what we actually do than make
a claim of the "bank-grade" kind.

---

## 11. Children

The platform is not intended for people under 18 and we do not knowingly create accounts
for them.

---

## 12. Changes to this notice

**Every version of this notice is kept permanently and has its own address.** When we
publish a change, the old version does not disappear — it stays readable at its own URL,
and if you agreed to something under it, your consent record still points at the exact
words you were shown.

We do this because consent that cannot be produced on demand is not demonstrable consent,
and a notice that is quietly edited destroys its own evidence.
$notice_body$,
  'First published version. This is the notice in force since 2026-08-03, the version stamped on consent records from that date. It was written when the version register was built, so that those records resolve to a document that can actually be produced; before then, the version number referred to no document at all.',
  'PUBLISHED',
  TIMESTAMP '2026-08-03 00:00:00',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
