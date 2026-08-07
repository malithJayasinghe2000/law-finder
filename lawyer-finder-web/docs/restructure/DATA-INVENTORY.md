# Data Inventory

> **What this is.** Every model in `prisma/schema.prisma` that holds personal data:
> what it is for, whose it is, our legal role, the lawful basis, who can reach it, and
> how long it lives. Built for the **Personal Data Protection Act No. 9 of 2022**.
>
> **Why it is a document and not a comment.** It is the thing the Data Protection
> Authority would ask for, and the thing a firm will ask for before signing a processor
> agreement. It is also the only way to notice that we hold something nobody remembered.
>
> Added 2026-08-03, Phase 6. **Every model was checked, not only the obvious ones** —
> that sweep is what produced [§7 Findings](#7-findings-from-building-this).
>
> Not legal advice. An engineering interpretation, built to be checked.

---

## 1. The two roles we hold at once

The single most important thing on this page. We are **not** simply "a processor for
firms" — we are a processor for *some* data and a controller for the rest, and the duties
differ.

| | **Controller** — we decide why and how | **Processor** — the firm decides; we act on instruction |
| --- | --- | --- |
| **Data** | `User`, `LawyerProfile`, `LawyerApplication`, `AiConversation`/`AiMessage`, community content, `Advertiser`, `Invoice`, `Inquiry`, ad analytics | `Booking` and everything hanging off it: `ConflictCheck`, `Quote`, `EngagementLetter`, `FeeNote`, `BookingPayment`, and attorney↔client `Message` |
| **Our duties** | The full set: lawful basis, privacy notice, subject rights, retention, security, breach notification to the Authority | Act only on documented instruction; written contract with each firm; security; **assist** the firm with subject requests; notify the **firm** of a breach; no sub-processing without permission; return or delete on termination |
| **Who answers a subject request** | Us | **The firm.** We provide the data to them; we do not decide what is released |
| **Who decides an erasure** | Us | **The firm** — it may have a professional duty to retain that overrides the request |

**The practical consequence.** When a client asks *"delete everything about me"*, we can
act on our own controller data immediately. We cannot unilaterally delete their matter
file, because it is not ours to delete — and the firm may be professionally required to
keep it. This is implemented in `src/lib/privacy/policy.ts`, not decided per route.

---

## 2. Sensitivity tiers

Four tiers, because they carry genuinely different duties. Tier 1 is the one that makes
this project unusual.

| Tier | Meaning | Consequence of getting it wrong |
| --- | --- | --- |
| **1 — Privileged** | The client's account of their legal problem and everything derived from it. Protected by **Evidence Ordinance s.126** | Not just a statutory breach. Privilege can be **lost** if a third party is in the conversation — so a leak can damage the client's position **in their own case** |
| **2 — Sensitive** | Someone describing a legal situation where no attorney is involved (the AI assistant). Reads identically to Tier 1 but attracts no privilege | Serious PDPA exposure; reputational; no privilege consequence |
| **3 — Identity** | Government identifiers, credentials, identity documents, bank details | Identity theft, financial fraud |
| **4 — Ordinary** | Names, emails, public community content, usage counters | Standard PDPA duties |

---

## 3. Tier 1 — Privileged matter data

**Our role: processor.** The firm is the controller. Lawful basis is the **firm's**:
performance of the retainer, plus the firm's professional and legal obligations. **It is
not consent**, and it must never be presented as consent — implying it is withdrawable
would promise something we cannot deliver against a firm's retention duty.

Access is decided in exactly one place: [`src/lib/firms/access.ts`](../../src/lib/firms/access.ts),
asserted by `npm run check:privilege`.

| Model | The personal data | Who can read it | Retention |
| --- | --- | --- | --- |
| `Booking` | `subject`, `description` (the client's own words), `practiceArea`, `lawyerNotes`, `clientFeedback`, `cancelReason`, `assignmentNote`, `lawyerRemarks`, `adminRemarks` | Client · assigned attorney · firm principal/practice manager. **Not** other attorneys at the firm, **not** paralegals, **not** platform `ADMIN` | Firm's file-retention duty — see §5 |
| `ConflictCheck` | `notes`, `screenedParties` | Assigned attorney and firm principal only. Never the client, never platform staff | **Longest in the system.** A firm needs its past screenings to run *future* ones |
| `Quote` | `scopeOfWork`, `exclusions`, `declineReason`, fee amounts | Client and firm | With the matter file |
| `EngagementLetter` | `body` — a full snapshot naming the client, the matter and the terms | Client and firm. Explicitly not platform staff | With the matter file |
| `FeeNote` | `clientName`, `clientAddress`, `clientEmail`, `lineItems` (a narration of legal work), `content` snapshot | Firm and its client. Platform staff cannot read one | **Statutory tax retention** — cannot expire on a data-protection schedule |
| `BookingPayment` | `accountHolder`, `accountNumber`, `transactionRef`, `receiptImageUrl` | Client and firm | With the matter file |
| `Message` (+ `Conversation`, `ConversationParticipant`) | `content` — direct client↔attorney chat | Conversation participants | With the matter file |

> ⚠️ **`Message` is privileged data that does not pass through `firms/access.ts`.** The
> table has no `firmId` and no matter linkage; access is decided ad hoc in the chat
> routes. See [§7 finding B](#b-privileged-chat-sits-outside-the-privilege-system).

**`screenedParties` is the sharpest edge in the schema.** It names *other people's*
clients and opposing parties. A subject-access request from one client must never
become a disclosure route into another's affairs — so conflict-check records are
released field-filtered, never whole.

---

## 4. Tier 2 — Sensitive, not privileged

**Our role: controller.**

| Model | The personal data | Lawful basis | Who can read it | Retention |
| --- | --- | --- | --- | --- |
| `AiConversation` / `AiMessage` | `content` — the user's questions about legal situations, `title`, `citations`, `refusalCategory` | Performance of contract (the user asked for the service) | The user who owns it | **180 days from last use** — live today via `AI_CONVERSATION_RETENTION_DAYS` and `npm run ai:purge`. Counts `updatedAt`, so an active conversation is never deleted underneath someone |
| — guest questions | **Not stored at all** | — | — | The cheapest way to hold data safely is not to hold it |
| `Inquiry` | `clientName`, `clientPhone`, `clientEmail`, `message` — a person's legal problem sent to a named attorney | Steps at the data subject's own request | The addressed attorney | 12 months (proposed) |

> ⚠️ `Inquiry` is written by an **unauthenticated** endpoint and sits outside every
> access control in the system. See [§7 finding A](#a-inquiry-is-an-unauthenticated-intake-for-tier-2-data).

---

## 5. Tier 3 — Identity, credentials and money

**Our role: controller**, except `FeeNote` (processor, listed in §3).

| Model | The personal data | Lawful basis | Retention |
| --- | --- | --- | --- |
| `User` | `email`, `passwordHash`, `googleId`, `fullName`, `profileImageUrl`, `role` | Performance of contract | Life of the account + grace period. ⚠️ **There is no soft-delete field on `User` today** — see [finding C](#c-a-user-cannot-be-deactivated) |
| `LawyerProfile` | `nic` (national identity number), `identityImageUrl`, `licenseImageUrl`, `baslNumber`, `address`, `contactPhone`, `gender`, `latitude`/`longitude` | Legitimate interest — verifying that a person holding themselves out as an Attorney-at-Law really is one. **Not consent** | While enrolled + limited period after |
| `LawyerApplication` | `draftData` (untyped `Json`), `adminNotes` | Steps at the subject's request | 24 months after a decision (proposed). ⚠️ Contents unaudited — see [finding D](#d-lawyerapplicationdraftdata-is-an-unaudited-json-blob) |
| `VerificationToken` | `token`, `userId` | Contract / security | Delete on expiry + 30 days |
| `Invoice` / `InvoiceRemark` | `paymentDetails` (bank details), `receiptImageUrl`, `adminNotes` — **our** bill to a firm | Contract + our own tax obligation | Statutory tax retention |
| `Advertiser` | `contactName`, `contactEmail`, `contactPhone`, `nonLegalConfirmedById` | Contract | Life of relationship + statutory |
| `LawFirm` | `contactEmail`, `contactPhone`, bank details, `taxIdentificationNumber`, `vatNumber` | Contract | Life of relationship + statutory |
| `FirmMember` / `FirmOffice` | Membership, role, `title`, invitation trail, office contact details | Contract | Life of membership + audit period |

**Retention numbers marked "proposed" are engineering defaults chosen conservatively.**
The two that need a real answer are the matter file and the conflict check — that is
**counsel question 7(c)**, and it is unanswered. Until it is, nothing in §3 is
auto-deleted; the purge refuses to touch matter data rather than guess.

---

## 6. Tier 4 — Ordinary personal data

**Our role: controller.**

| Model | The personal data | Lawful basis | Retention |
| --- | --- | --- | --- |
| `Community`, `CommunityMember`, `CommunityRequest` | Membership, `reason`, `adminNotes` | Contract | Life of account |
| `Post`, `Comment` (+ `PostTranslation`, `CommentTranslation`) | `authorId`, `content`, `images` | Contract | Life of account, or until the author deletes |
| `Vote` | `userId` + what they voted on — a record of opinion | Contract | Life of account |
| `Report` | `reporterId`, `reason`, `description`, `adminNotes` — who reported whom | Legitimate interest (moderation) | 12 months after resolution (proposed) |
| `Article` | `authorId`, `content` | Contract | Life of account |
| `SlotHold` | `clientId` + which attorney's diary they were looking at — an **interest signal** even when no booking follows | Steps at the subject's request | 7 days after `expiresAt` (proposed) |
| `LawyerAvailability`, `AvailabilityOverride` | `reason` on a blocked day can be personal ("medical leave") | Contract | Life of profile |
| `ConsultationPricing` | Firm bank details | Contract | Life of profile |
| `FeatureUsage` | Usage counters per subscription — **counts software, never clients** | Contract | Life of subscription + 12 months |
| `AdAnalytics`, `AdSlotBooking` | Impressions and clicks, **aggregate per campaign per day**. No user identifier, no per-person tracking | Legitimate interest | 24 months (proposed) |
| `LegalDocument` | `uploadedById` — an admin's identity | Contract | Life of document |

**On "anonymous" community posts.** `Post.isAnonymous` and `Comment.isAnonymous` hide the
author *from readers* — `/api/posts` and `/api/comments` substitute the author on read.
The row still holds `authorId`, which is correct and necessary for moderation. But the
word means **pseudonymous to other users, not anonymous to us**, and the interface must
not imply otherwise.

---

## 7. Findings from building this

Five things the sweep surfaced that were not in the Phase 6 brief.

### A. `Inquiry` is an unauthenticated intake for Tier 2 data

[`POST /api/inquiries`](../../src/app/api/inquiries/route.ts) accepts `clientName`,
`clientPhone`, `clientEmail` and a free-text `message` describing a legal problem,
addressed to a named attorney. There is **no authentication, no rate limit, no firm
scoping, no privilege gate and no retention.** It is rendered on the lawyer dashboard
and counted on the admin dashboard. `/about` still advertises it as *"Send secure
inquiries directly to lawyers with your case details."*

This is a marketplace-era surface that survived Phases 0–5 because nobody looked at it.
It predates firm-first intake, which is its proper replacement.

### B. Privileged chat sits outside the privilege system

`Conversation` / `Message` carries client↔attorney communication — Tier 1 — but has no
`firmId`, no matter linkage, and never passes through `firms/access.ts`. Phase 3
correctly removed the *metering* of these conversations. The access question was never
revisited.

### C. A `User` cannot be deactivated

`User` has no `status`, `isActive` or `deletedAt` field. The project convention is soft
delete via status fields and **no hard deletes** — but `User` has nothing to soft-delete
*with*. Erasure therefore has no landing place today, and a hard delete would cascade
into community content and orphan matters that a firm is required to keep.

### D. `LawyerApplication.draftData` is an unaudited `Json` blob

An untyped column that has held whatever the application wizard put in it. An inventory
cannot honestly describe data nobody has looked at, and an export cannot safely include
it.

### E. Star ratings are still being collected and displayed

Phase 2 deleted the `Review` model and reported that ratings were *"gone entirely"*.
They are not. `Booking.clientRating` and `Booking.clientFeedback` are still written by
the `rate` action in
[`/api/consultations/bookings/[id]`](../../src/app/api/consultations/bookings/[id]/route.ts)
and **rendered as stars** to the attorney at
`dashboard/lawyer/consultations/page.tsx` (`Client Rating: ⭐⭐⭐⭐`).

It is not a Rule 40 breach today — it is not public and it touches no ordering. But it is
the same defect shape as the commission column: *a column that exists is a column a
future product decision can populate*, and `clientRating` is one `orderBy` away from
being ranking. It is also personal data with no stated purpose, no lawful basis and no
retention, collected for a feature that was supposed to have been removed.

---

## 8. Cross-border transfer

The PDPA restricts sending personal data outside Sri Lanka. Two flows need a documented
basis and neither has one:

| Flow | What crosses | Status |
| --- | --- | --- |
| **Database hosting** | Everything in this document | `.env` currently points at local Postgres, with a commented-out **Neon** URL (`us-east-1`). If production uses it, all tiers leave the country |
| **The AI model** | Tier 2 — the user's question text, forwarded by the RAG service at `RAG_API_URL` to whatever model backs it | Undocumented. Tier 1 does **not** travel this path: `buildModelContext()` takes a question and the chat's own history, and has no parameter through which matter data could reach it |

Recorded as **counsel question 19**.

---

## 9. What we deliberately do not hold

Negative assertions are part of an inventory. Each of these is an absence maintained on
purpose, and each would be a finding if it reappeared.

- **No commission or platform-fee column** on `Booking` or `FeeNote` — not nullable, not
  defaulting to zero
- **No client funds, balances, wallets or withdrawal records** — `WithdrawRequest` was
  deleted, not disabled
- **No guest AI conversations** — never written
- **No `AiMessage.lawyerSuggestions` or `.sources`** — dropped in Phase 5
- **No lawyer relation on `AdCampaign`** — an attorney has nowhere to attach an advert
- **No advert targeting on matter data** — `AdCampaign` targets a *page*, and its
  `targetDistricts` / `targetPracticeAreas` come from the campaign, never from anything a
  client wrote
- **No `Review` model, no ratings on any public surface** — but see [finding E](#e-star-ratings-are-still-being-collected-and-displayed)
- **No plaintext chat logs** — the RAG service stopped writing them in Phase 5;
  `data/chat_logs/` is gitignored

---

## 10. Where the rules live

| Concern | File |
| --- | --- |
| Who may **read** matter data | [`src/lib/firms/access.ts`](../../src/lib/firms/access.ts) → `npm run check:privilege` |
| **Retention and subject rights** | [`src/lib/privacy/policy.ts`](../../src/lib/privacy/policy.ts) → `npm run check:pdpa` |
| What the AI may say | [`src/lib/ai/policy.ts`](../../src/lib/ai/policy.ts) → `npm run check:ai` |
| What a firm is licensed for | [`src/lib/firms/billing.ts`](../../src/lib/firms/billing.ts) → `npm run check:billing` |
| Who may advertise | [`src/lib/ads/eligibility.ts`](../../src/lib/ads/eligibility.ts) |
