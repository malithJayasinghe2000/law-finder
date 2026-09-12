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
| `Booking` | 🔒 `subject`, 🔒 `description` (the client's own words), `practiceArea`, 🔒 `lawyerNotes`, `clientFeedback`, `cancelReason`, `assignmentNote`, `lawyerRemarks`, `adminRemarks` | Client · assigned attorney · firm principal/practice manager. **Not** other attorneys at the firm, **not** paralegals, **not** platform `ADMIN` | Firm's file-retention duty — see §5 |
| `ConflictCheck` | 🔒 `notes`, 🔒 `screenedParties` | Assigned attorney and firm principal only. Never the client, never platform staff | **Longest in the system.** A firm needs its past screenings to run *future* ones |
| `Quote` | 🔒 `scopeOfWork`, 🔒 `exclusions`, 🔒 `declineReason`, fee amounts | Client and firm | With the matter file |
| `EngagementLetter` | 🔒 `body`, 🔒 `matterSubject`, 🔒 `scopeOfWork` — a full snapshot naming the client, the matter and the terms | Client and firm. Explicitly not platform staff | With the matter file |
| `FeeNote` | `clientName`, `clientAddress`, `clientEmail`, `lineItems` (a narration of legal work), `content` snapshot | Firm and its client. Platform staff cannot read one | **Statutory tax retention** — cannot expire on a data-protection schedule |
| `BookingPayment` | `accountHolder`, `accountNumber`, `transactionRef`, `receiptImageUrl` | Client and firm | With the matter file |
| `Message` (+ `Conversation`, `ConversationParticipant`) | 🔒 `content` — direct client↔attorney chat | Participants only, and a lawyer participant must still be an ACTIVE member of `Conversation.firmId`. **Not** the firm's principal unless they are in the thread; **not** platform staff | With the matter file |

> ✅ **Closed in Phase 7.** `Conversation` now carries `firmId`, `clientId` and an
> optional `bookingId`, and access runs through `resolveConversationAccess()` in
> `firms/access.ts`. See [§7 finding B](#b-privileged-chat-sits-outside-the-privilege-system).

**Fields marked 🔒 are encrypted at rest** (AES-256-GCM, bound to their row and column).
Plaintext is only ever produced inside the disclosure gate in `firms/access.ts` — see
[§12 Encryption at rest](#12-encryption-at-rest).

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
> ✅ **`Inquiry` was removed entirely in Phase 7**, model and rows. It was an
> unauthenticated intake collecting a stranger's account of their legal problem with no
> lawful basis to keep it. See [§7 finding A](#a-inquiry-is-an-unauthenticated-intake-for-tier-2-data).

---

## 5. Tier 3 — Identity, credentials and money

**Our role: controller**, except `FeeNote` (processor, listed in §3).

| Model | The personal data | Lawful basis | Retention |
| --- | --- | --- | --- |
| `User` | `email`, `passwordHash`, `googleId`, `fullName`, `profileImageUrl`, `role` | Performance of contract | Life of the account + grace period. ⚠️ **There is no soft-delete field on `User` today** — see [finding C](#c-a-user-cannot-be-deactivated) |
| `LawyerProfile` | `nic` (national identity number), `identityImageUrl`, `licenseImageUrl`, `baslNumber`, `address`, `contactPhone`, `gender`, `latitude`/`longitude` | Legitimate interest — verifying that a person holding themselves out as an Attorney-at-Law really is one. **Not consent** | While enrolled + limited period after |
| `LawyerApplication` | `draftData` — now a **typed, strict** shape (`ApplicationDraftSchema`): name, gender, languages, bio, phone, address, district, coordinates, BASL number, years, practice type, courts, notary flag, practice areas, and **URLs** to two uploaded identity documents. Plus `adminNotes` | Steps at the subject's request | **730 days from last update**, live in `RETENTION_SCHEDULE`. An APPROVED application is reduced to a stub immediately, since its contents move to the profile. See [finding D](#d-lawyerapplicationdraftdata-is-an-unaudited-json-blob) |
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
| `PrivacyNotice` | `publishedById` — which administrator published a version. No subject data at all | Our own accountability | **Permanent.** A published version is the evidence of what a person was shown when they consented, so it is never deleted or edited — see §12 |
| `SubjectRequestFirmResponse` | `respondedById`, and the firm's `reason` written to its own client | Legitimate interest (answering a statutory request) | With the subject request |

**On "anonymous" community posts.** `Post.isAnonymous` and `Comment.isAnonymous` hide the
author *from readers* — `/api/posts` and `/api/comments` substitute the author on read.
The row still holds `authorId`, which is correct and necessary for moderation. But the
word means **pseudonymous to other users, not anonymous to us**, and the interface must
not imply otherwise.

---

## 7. Findings from building this

Five things the Phase 6 sweep surfaced that were not in its brief. **All five are now
closed** — C and E in Phase 6, A, B and D in Phase 7. Each is kept here with what was
actually wrong and what was done, because the shape of the mistake is the useful part.

### A. `Inquiry` is an unauthenticated intake for Tier 2 data

> **Closed in Phase 7 — removed, not fixed.**

`POST /api/inquiries` accepted `clientName`, `clientPhone`, `clientEmail` and a
free-text `message` describing a legal problem, addressed to a named attorney, with
**no authentication, no rate limit, no firm scoping, no privilege gate and no
retention.** It was rendered on the lawyer dashboard and counted on the admin
dashboard, and `/about` advertised it as *"Send secure inquiries directly to lawyers
with your case details."*

**Why removal rather than repair.** Fixing it — authentication, rate limiting, firm
scoping, a privilege gate, retention — is rebuilding firm-first intake, which already
exists and additionally runs the conflict check, the quote and the engagement letter.
Two intakes doing the same job is the duplicate-state-machine problem this restructure
has already fixed twice. It was also the touting-exposed surface at its rawest: an
unauthenticated channel transmitting a legal problem to an attorney picked from a
directory, with none of the engagement flow's protections.

**Entry points were replaced before the endpoint was deleted**, per the standing rule
against breaking a working flow to make a legal fix. The rows were deleted rather than
migrated: an enquiry created no retainer and no obligation, so there was no lawful
basis to keep holding a stranger's account of their legal problem.

**Two more live violations were found on `/about` while doing it**, both promising
features the restructure had already removed: *"Filter lawyers by … fee range"*
(`baseFeeRange` was deleted in Phase 2 — a published fee indication is beyond the Rule
40 content limit) and *"Verified Reviews"* (the `Review` model was deleted in Phase 2).
Marketing copy is a surface like any other; a page promising a feature we removed for
legal reasons is still holding the platform out as offering it.

### B. Privileged chat sits outside the privilege system

> **Closed in Phase 7.**

`Conversation` / `Message` carried client↔attorney communication — Tier 1 — with no
`firmId`, no matter linkage, and no route through `firms/access.ts`. Phase 3 correctly
removed the *metering* of these conversations; the access question was never revisited.

Looking at it properly turned up **four holes, not one**:

1. **A departed attorney kept reading.** A `ConversationParticipant` row has no end
   date, so leaving a practice removed access to the matter file and left the
   conversation *about* that matter wide open — including from inside a competing firm.
2. **Nothing said platform staff may not.** No route did read a thread, but the rule
   lived in the absence of a query rather than in a decision, and absences do not
   survive the next feature.
3. **`POST /api/chat/conversations` accepted any user id**, so any signed-in user could
   open a thread with anyone at all — client to client included.
4. **The socket server had the same weak check**, so a departed attorney could still
   join the live room and receive messages in real time.

**What was built.** `Conversation` gained `firmId`, `clientId` and an optional
`bookingId` (backfilled by migration). `resolveConversationAccess()` in
`firms/access.ts` now decides, and `npm run check:privilege` asserts nine cases.

**The rule is deliberately narrower than the matter rule**: a thread is readable by its
participants and by nobody else — *not* the firm's principal, who can read the matter
file itself. A principal needs the file to triage and reassign; they do not need to read
a conversation that has already happened. Every additional reader of a privileged
communication is another person an opponent can name to argue privilege was waived.

### C. A `User` cannot be deactivated

> **Closed in Phase 6.** `User.status` and `User.erasedAt` exist; erasure anonymises.

`User` had no `status`, `isActive` or `deletedAt` field. The project convention is soft
delete via status fields and **no hard deletes** — but `User` has nothing to soft-delete
*with*. Erasure therefore has no landing place today, and a hard delete would cascade
into community content and orphan matters that a firm is required to keep.

### D. `LawyerApplication.draftData` is an unaudited `Json` blob

> **Closed in Phase 7 — and it was worse than the finding said.**

Auditing it found four things:

1. **The route stored the raw request body, not the parsed result.** It validated only
   the steps *before* the current one and then wrote `body.draftData` verbatim. So the
   step being edited was never checked, and any key a caller invented was persisted
   forever. Validating and then saving something else is the shape of the bug.
2. **It held two identity documents as inline base64.** The wizard used
   `FileReader.readAsDataURL` for the practising certificate and `canvas.toDataURL` for
   a photograph of the applicant's face, then posted both into the draft. Up to two
   multi-megabyte images sat in a JSON column, and those exact strings were copied into
   `LawyerProfile.licenseImageUrl` / `identityImageUrl` — columns named "Url" that were
   not URLs. It also meant the documents bypassed `/api/upload` and with it the
   magic-byte anti-spoofing check, the MIME allow-list, the size limit and the rate
   limit.
3. **Approval invented a BASL number.** `baslNumber: data.step2?.baslNumber ||
   \`BASL-MANUAL-${Date.now()}\`` ran in the same statement that set
   `isVerified: true`. "Verified" means we checked this person's BASL registration; an
   invented number makes that claim false on the one field it is a claim about. The
   route now refuses to approve an incomplete application, and refuses a BASL number
   already registered to someone else.
4. **The local upload fallback writes to `public/uploads`.** When object storage is not
   configured, `/api/upload` saves into a publicly served directory. Acceptable for a
   profile photograph; not for a practising certificate and a face photograph on a
   guessable URL. An `identity` upload now **fails loudly** rather than degrading into
   public storage. A proper authenticated file-serving route for tier 3 documents is
   still outstanding — see PROGRESS.md.

`draftData` is now `ApplicationDraftSchema`: strict per step, unknown keys rejected,
images stored as URLs. It is on the retention schedule (730 days), reduced to a stub on
approval, deleted on erasure, and — because it is finally a shape somebody has looked
at — included in a subject-access export.

### E. Star ratings are still being collected and displayed

> **Closed in Phase 6.** `Booking.clientRating` and `clientFeedback` were dropped.

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
- **No `Review` model and no rating column anywhere** — `Booking.clientRating` and
  `clientFeedback` were dropped in Phase 6, not disabled
- **No plaintext chat logs** — the RAG service stopped writing them in Phase 5;
  `data/chat_logs/` is gitignored
- **No unauthenticated intake** — `Inquiry` was deleted in Phase 7, model and rows
- **No content column on `DataAccessLog`**, and none may be added
- **No plaintext in the tier 1 columns listed in §12** — asserted, not assumed
- **No content column on `SubjectRequestFirmResponse`** — a firm's answer to a subject
  request says what it decided and which duty required it. It is not a place to copy the
  matter file into. Same reasoning as `DataAccessLog`
- **No way to edit or delete a published `PrivacyNotice`** — not an admin override, not a
  soft-delete flag. `assertEditable()` refuses it and `check:pdpa` asserts the refusal

---

## 10. The privacy notice register

Added 2026-09-06, Phase 8. Implemented in
[`src/lib/privacy/notice.ts`](../../src/lib/privacy/notice.ts); asserted by
`npm run check:pdpa`.

### The defect it closes

`ConsentRecord.noticeVersion` has stamped every consent since Phase 6 — and until
Phase 8 there was **no document anywhere that the version referred to**. It was a
constant in `policy.ts` reading `'2026-08-03'`, pointing at nothing. Every consent record
in the system was a claim about wording nobody could produce, which is not demonstrable
consent.

### Why versioned rather than editable

If an administrator edits the notice in place, every past consent record silently starts
pointing at wording that person never saw. **Nothing errors.** The evidence is destroyed
by an ordinary content edit, and the loss is discovered when somebody asks you to prove
consent — which is the moment you cannot.

So publishing writes a **new row** and supersedes the old one, and a superseded version
keeps its own permanent URL for ever. Evidence you can take off the shelf is not evidence.
It is the same snapshot rule as `EngagementLetter.body` and `FeeNote.content`, for the
same reason.

| Rule | Where |
| --- | --- |
| A published or superseded version can never be edited | `assertEditable()` |
| A published or superseded version can never be deleted | The `DELETE` route refuses anything but a `DRAFT` |
| At most one version is in force | `publishNotice()`, in one transaction |
| A draft is never served at a public URL | `getNoticeByVersion()` returns null for `DRAFT` |
| The version stamped on a consent is a **lookup**, not a constant | `resolveNoticeVersion()` |

### Consent fails closed

Granting a consent when no notice is published is **refused**
(`requirePublishedVersionForConsent`). Recording "they agreed to version X" where X
resolves to nothing recreates the exact defect the register exists to remove, and doing it
silently is worse than an error.

**Withdrawal is never blocked this way.** That is the person exercising a right, and a gap
in our own paperwork is not a reason to refuse it.

### The firm answers its own half

`SubjectRequestFirmResponse` is one row per (request, firm). Phase 6 referred requests to
firms and gave them nowhere to answer, so a referred request sat in `AWAITING_FIRM` for
ever — the same "right that cannot be exercised" defect as the client's, at the firm's end.

Two rules that are not obvious:

- **A firm answers only for itself.** One request can be referred to several firms. If the
  first to reply closed it, the second firm's client would be told their matter had been
  dealt with by a practice that never looked at it.
- **The parent request closes only when every referred firm has replied**, and reports
  `PARTIALLY_FULFILLED` whenever any firm retained the file. A clean `COMPLETED` over a
  firm still holding the file is a false answer to a statutory request.

---

## 11. Where the rules live

| Concern | File |
| --- | --- |
| Who may **read** matter data | [`src/lib/firms/access.ts`](../../src/lib/firms/access.ts) → `npm run check:privilege` |
| Who may read a **message thread** | `resolveConversationAccess()` in the same file → `npm run check:privilege` |
| **Encryption at rest** | [`src/lib/privacy/encryption.ts`](../../src/lib/privacy/encryption.ts) → `npm run check:privilege`, backfilled by `npm run privacy:encrypt` |
| Who may **join a firm** | [`src/lib/firms/invitations.ts`](../../src/lib/firms/invitations.ts) → `npm run check:firm` |
| **Retention and subject rights** | [`src/lib/privacy/policy.ts`](../../src/lib/privacy/policy.ts) → `npm run check:pdpa` |
| The **privacy notice register** | [`src/lib/privacy/notice.ts`](../../src/lib/privacy/notice.ts) → `npm run check:pdpa` |
| A **firm answering a subject request** | [`src/lib/privacy/firmResponse.ts`](../../src/lib/privacy/firmResponse.ts) → `npm run check:pdpa` |
| What the AI may say | [`src/lib/ai/policy.ts`](../../src/lib/ai/policy.ts) → `npm run check:ai` |
| What a firm is licensed for | [`src/lib/firms/billing.ts`](../../src/lib/firms/billing.ts) → `npm run check:billing` |
| Who may advertise | [`src/lib/ads/eligibility.ts`](../../src/lib/ads/eligibility.ts) |

---

## 12. Encryption at rest

Added 2026-08-16, Phase 7. Implemented in
[`src/lib/privacy/encryption.ts`](../../src/lib/privacy/encryption.ts); disclosed only
through [`src/lib/firms/access.ts`](../../src/lib/firms/access.ts); asserted by
`npm run check:privilege`.

### Why, given `firms/access.ts` already exists

`access.ts` binds code that goes through the application. A database dump, a restored
backup, a misconfigured replica and an engineer with a `psql` prompt all sit underneath
it. Encryption closes that gap. Counsel question 4(c) asks whether technical controls
are legally relevant *to privilege*; the PDPA imposes a security duty on us
independently, so the answer to 4(c) changes how much credit this earns, not whether it
was worth building.

### The trap it was at risk of shipping

An "encryption at rest" feature where the redaction path returns `enc.v1.k1.…` instead
of the plaintext **looks like it works and has protected nothing** — the withheld reader
now holds the ciphertext and the key is one environment variable away. A privilege check
that only asks "did the plaintext leak?" passes on exactly that implementation.

So the disclosure gate has **three outcomes and ciphertext is not one of them**:
plaintext, `[Withheld — privileged]`, or `[Unavailable — could not be decrypted]`.
`decryptField` throws rather than degrading to its input. `check:privilege` asserts the
withheld value is neither the plaintext **nor the stored ciphertext**, and both failure
modes were verified by deliberately breaking the code and watching the check go red.

### What is covered

| Model | Encrypted columns |
| --- | --- |
| `Booking` | `subject`, `description`, `lawyerNotes` |
| `ConflictCheck` | `notes`, `screenedParties[]` |
| `Quote` | `scopeOfWork`, `exclusions`, `declineReason` |
| `EngagementLetter` | `body`, `matterSubject`, `scopeOfWork`, `exclusions` |
| `Message` | `content` |

`EngagementLetter.matterSubject` and `scopeOfWork` are on that list because they are
**copies** of encrypted columns on `Booking` and `Quote`. Leaving the copies in the
clear would have made encrypting the originals pointless for every matter that ever
reached acceptance — the leak would have been a plaintext column three tables away from
the one anyone was looking at.

### What is deliberately NOT encrypted, and why

| Field | Reason |
| --- | --- |
| `FeeNote.content`, `FeeNote.lineItems` | A fee note is a **tax document** the firm can be compelled to produce, with a statutory retention period in years. Making a statutory record depend on our key custody trades a confidentiality risk for a compliance failure the firm cannot argue its way out of. Encrypt once key escrow is designed |
| `FeeNote.clientName / clientAddress / clientEmail` | Identity (tier 3), not the client's account of their problem, and printed on the face of a document the client already holds |
| `Booking.practiceArea` | A category the client picked from a list. It is what a firm filters its queue on, and says nothing the choice of firm does not already say |
| `Quote.amount`, `paymentInstructions` | Commercial terms the client is told in full; not an account of the matter |
| `Booking.cancelReason`, `assignmentNote` | Short operational strings the firm writes about its own scheduling. Still access-gated |

### How it works

- **AES-256-GCM**, envelope `enc.v1.<keyId>.<iv>.<tag>.<ciphertext>`, each part base64url.
- **Bound to its row and column** via GCM additional authenticated data
  (`<model>:<recordId>:<field>`). Ciphertext copied to another row, or into another
  column, **fails to decrypt**. This is the defence that matters: the reader rule 5 is
  about is a platform insider, and an insider with write access who could relocate
  ciphertext into a record they are allowed to read would walk straight around the
  access rules. Record ids are therefore generated in application code before the insert.
- **Rotatable**: the key id travels with the value, so a new key encrypts new writes
  while old rows keep decrypting. Retired keys must stay in the ring until
  `npm run privacy:encrypt` has re-encrypted everything written under them.
- **Fails closed on write**: with no key configured, writing privileged data throws.
  Writing plaintext with a warning would be a silent downgrade.
- **Tolerant on read**: a value not in envelope form is treated as legacy plaintext, so
  the backfill can run incrementally.

### Key custody — the risk this creates

**Losing `MATTER_ENCRYPTION_KEYS` destroys every matter description, conflict check,
quote scope, engagement letter and client message in the database.** That is a real
operational risk introduced deliberately in exchange for confidentiality. It must be
backed up somewhere that is neither this repository nor the same host as the database,
and it is the reason the tax documents above are excluded.
