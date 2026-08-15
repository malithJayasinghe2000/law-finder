# System Review — what to remove, what to restructure, what to add

> Written 2026-08-16, after Phase 7, by reading the whole codebase rather than one
> feature. Plain words on purpose.
>
> This is an engineering opinion, not a plan anyone has approved. Nothing here has been
> done except where it says **DONE**.

---

## The one-paragraph summary

The legal work is in good shape. Seven phases have removed the things that could not
lawfully exist and put the remaining rules into four policy files with runnable checks
behind them. **What is now weak is the ordinary software**: there is a large amount of
half-built machinery nobody uses, several subsystems exist twice, and a few finished
features have no screen attached — the biggest being the whole data-protection rights
engine, which works and which no user can reach.

The single most useful thing the project could do next is **delete or finish**, not
build new.

---

## 1. Things to REMOVE

Ordered by how much confusion each one causes.

### 1.1 The subscription "permissions" system — mostly imaginary

There are 5 models (`Permission`, `SubscriptionRolePermission`, `SubscriptionRole`,
`FeatureLimitConfig`, `FeatureUsage`), 8 admin screens, and ~480 lines in
`src/lib/subscription.ts` + `subscription-middleware.ts` devoted to a per-feature
permission and usage-metering system.

**Almost none of it is enforced.** `canUseFeature` is called by exactly one route
(`/api/subscriptions/check-feature`), which nothing in the UI calls. The real licensing
rule — how many seats a firm has — lives in `src/lib/firms/billing.ts` and is 176 lines.

Worse, this is where the guardrail violations keep hiding. Three "inquiries" permissions
were still in the seed until Phase 7, one of which sold *"receive client inquiries"* as a
tier feature — the pay-per-lead shape Phase 2.5 removed from the public pricing page,
still sitting in a table nobody looked at.

**Recommendation:** delete `Permission`, `SubscriptionRolePermission`,
`SubscriptionRole`, `subscription.ts` and `subscription-middleware.ts`, and the five
admin screens over them. Keep `FeatureLimitConfig`/`FeatureUsage` **only** for seats,
storage and templates. Every feature limit should resolve through `firms/billing.ts`,
which already answers the only question that matters and is the file the checks cover.

*Why this is a legal point and not just tidiness:* a permission table is a place where
someone can add a limit on clients without touching the pricing page. Twice now that is
exactly what happened.

### 1.2 Six payment pages where there should be two

`dashboard/lawyer/` currently has: `invoices`, `payments/history`, `payments/invoice`
(a redirect), `payments/invoices`, `payments/invoice/[planId]`, `payments/offline/[planId]`,
and until this review `payments/submit-payment/[invoiceId]` — a page whose own first line
read *"This directory is intentionally empty — not used"*.

**DONE:** `submit-payment` deleted.
**Recommendation:** collapse the rest into `dashboard/lawyer/invoices` (list) and
`dashboard/lawyer/invoices/[id]` (view and pay). One licence, one place.

### 1.3 `ConsultationPricing`

Its price columns were dropped in Phase 3 because a published consultation price is a
rule 1 problem. What remains is a terms/notes row and a `dashboard/lawyer/consultations/pricing`
page for it. It is a model named "Pricing" that holds no price, on a screen a lawyer
would reasonably expect to set fees on.

**Recommendation:** fold the remaining fields onto `LawyerProfile` (or `LawFirm`) and
delete the model and the page. The name alone invites someone to put a price back.

### 1.4 Dead and duplicated odds and ends

- `src/app/api/chat/route.ts` — a stub returning `{status:'ok'}`. **DONE:** deleted.
- `/api/ads/expire` and `/api/ads/availability` — no callers. Either schedule the first
  (see 3.4) or delete it.
- `src/store/useUIStore.ts` — one Zustand store; check whether it is still used before
  keeping a whole state library for it.
- `LawyerProfile.latitude` / `longitude` — collected by the application wizard, stored,
  and displayed nowhere. Either build the map or stop collecting location.

---

## 2. Things to RESTRUCTURE

### 2.1 The sidebar led almost nowhere — **DONE**

Four of the twelve navigation links were **404s** (`lawyer/profile`, `lawyer/articles`,
`admin/lawyers`, `admin/subscription-conf`), and a fifth (`lawyer/inquiries`) pointed at
a page that had never existed. Meanwhile the sidebar did **not** link to an attorney's
matters, messages, or invoices — the three screens they actually use every day.

So the primary navigation mostly led nowhere, and the real product was reachable only by
typing a URL. Fixed in this review: all 18 links now resolve, and the missing screens are
in. **If you add a link, open it.**

### 2.2 One "booking" concept with three names

The model is `Booking`, the language everywhere is "request" and "engagement", the client
sees "matter", and the URL says `consultations`. Four names for one thing across
`/api/consultations/*`, `dashboard/*/consultations`, `Booking`, and the word "matter" in
every comment.

`HOW-IT-WORKS.md` already says the model name is historical. It should stop being
historical: rename `Booking` → `Matter` and `/api/consultations/bookings` →
`/api/matters` in one migration. This is a large diff and a small risk, and it removes
the single most common source of confusion for anyone new.

### 2.3 Two subscription resolvers

`src/lib/subscription.ts` still resolves by `LawyerProfile.id`; `src/lib/firms/billing.ts`
resolves by firm. Phase 3 moved the licence to the firm and left the old file in place.
Two answers to "what is this person subscribed to" is one too many — and the older one
answers by *attorney*, which is the model the restructure exists to undo. Fold into
`firms/billing.ts`. (Overlaps with 1.1.)

### 2.4 Two matter-listing routes with different rules

`/api/consultations/bookings` and `/api/admin/bookings` both list matters with their own
`where` clauses. The first goes through `firms/access.ts`; the second is admin-scoped.
They should share one query builder, because the next privilege change has to be made in
both and Phase 0 already shipped a redaction applied to one booking read path and not the
other.

### 2.5 The application wizard holds state as `any`

`ApplicationClientForm` is 660 lines with `useState<any>` and `formData.step1?.…`
throughout. Phase 7 made the *server* strict; the client still cannot tell you what it is
sending. Type it from `ApplicationDraftSchema` — the schema already exists, so this is
inference rather than new work.

---

## 3. Things to ADD

### 3.1 A data-protection screen — the biggest gap in the system

Phase 6 built a complete DSAR engine: `/api/privacy/requests`, `/api/privacy/export`,
`/api/privacy/consents`, `/api/privacy/me`, and `/api/firms/me/subject-requests` for the
firm side. **Not one of them has a caller.**

There is no page where a person can export their data, withdraw a consent, or ask for
erasure, and no screen where a firm sees a request referred to it. The PDPA rights exist
in code and are unusable by any actual user.

This is the worst possible position: the work is done, the cost is paid, and the
compliance posture is unchanged — a regulator would see rights that were built and never
offered. It needs roughly two screens:

- `/dashboard/profile/privacy` — what we hold, the three consents with toggles, "download
  my data", "ask for erasure", and an honest explanation that erasure is **partial** and
  why (`summariseErasure()` already produces exactly this).
- `/dashboard/lawyer/firm/requests` — subject requests referred to the firm, since the
  firm decides on matter data and not us.

### 3.2 Scheduled jobs — nothing runs on a timer

`privacy:purge`, `ai:purge` and `ads/expire` all exist and are all manual. A retention
schedule nobody runs is a retention *document*, not a retention *policy*, and the PDPA
asks about the second. Add a scheduler (a cron workflow is enough) and have the purge
report what it did not touch, which it already does.

### 3.3 An authenticated file-serving route for identity documents

`/api/upload` falls back to `public/uploads` when object storage is unconfigured, which
would serve a practising certificate and a photograph of someone's face on a guessable
URL. Phase 7 made an `identity` upload **refuse** that fallback, which closes the hole
but does not build the right thing: tier 3 documents should be served through a route that
checks who is asking.

### 3.4 Somewhere to put the encryption key that is not a `.env` file

`MATTER_ENCRYPTION_KEYS` now protects every matter description, conflict check, quote
scope, engagement letter and client message. **Losing it destroys all of them.** It needs
a documented custody arrangement — a secrets manager, a backup held somewhere that is
neither this repository nor the same host as the database, and a written rotation
procedure. The rotation *code* exists; the operational half does not.

### 3.5 Rate limiting on the routes that matter

`checkRateLimit` exists and is used on uploads and login. It is not on the AI route, the
message routes, or intake. It is also in-memory, so it resets on deploy and does not work
across instances.

### 3.6 Automated tests, beyond the five checks

The five `check:*` scripts are genuinely good and they cover **policy**, not **flow**.
There is no test that a client can complete an engagement end to end. Every phase has
found a break by driving the flow by hand; that is a test waiting to be written.

### 3.7 Two things counsel may force, worth designing for now

- **If questions 16–18 come back badly, the consumer directory must be withdrawn.**
  `PROJECT-PLAN.md` describes the B2B shape that survives that. It would be cheap now to
  keep the directory behind one feature flag so withdrawal is a config change rather than
  a release.
- **The AI enforces its rules in English only** while the platform ships Sinhala and
  Tamil. A question in either bypasses the pre-generation check entirely. Counsel question
  5(h) asks whether that is defensible in the interim; if it is not, the honest interim fix
  is to close the non-English locales of the assistant rather than run it unguarded.

---

## 4. What is genuinely good, and should not be "cleaned up"

Worth writing down so a future refactor does not helpfully undo it.

- **The four policy files** (`firms/access.ts`, `ai/policy.ts`, `firms/billing.ts`,
  `privacy/policy.ts`) with a runnable check each. This is the right shape and it has
  caught real defects.
- **The absences that are guardrails** — no commission column, no lawyer relation on
  `AdCampaign`, no directory ad placements in the enum, no content column on
  `DataAccessLog`. Each looks like an oversight and is the opposite. They are all
  commented; leave the comments.
- **Snapshotting** the engagement letter and the fee note instead of joining at read time.
- **The migration discipline** — every migration in this project has been tested against a
  database seeded with the data that would break it. That habit has caught more real bugs
  than the type checker.
- **The comments explaining *why*.** They are unusually long, and they are the reason a
  new session can pick this codebase up. They are documentation that cannot drift from the
  code, because it is in the code.

---

## 5. If you only do five things

1. **Build the privacy screens** (3.1). Rights that exist and cannot be exercised are the
   largest single gap.
2. **Delete the permissions system** (1.1). It is where guardrail violations hide.
3. **Schedule the purge jobs** (3.2). A retention policy nobody runs is not one.
4. **Sort out key custody** (3.4). This risk was created deliberately in Phase 7 and the
   operational half is missing.
5. **Rename `Booking` to `Matter`** (2.2). Boring, and it removes the most common source
   of confusion in the codebase.
