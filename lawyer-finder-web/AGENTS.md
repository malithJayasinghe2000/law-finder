<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# lawyer-finder-web

Sri Lankan legal-services platform. Next.js 16.2 · React 19 · Prisma 7 / PostgreSQL ·
next-intl (en/si/ta) · socket.io. Roles: `ADMIN`, `LAWYER`, `CLIENT`.

## ⚠️ This project is under a legal restructure — read before coding

The platform is being repositioned from a **legal-services marketplace** (which it
cannot legally be in Sri Lanka) into **software that law firms run on**. Booking,
payments, advertising, and AI output are all mid-restructure.

**Lost the thread, or new here? Read `docs/THE-PROJECT.md` first** — what this is, how a
matter flows, who may read what, and what state everything is in. Then `docs/DIRECTION.md`
for what happens next, and `docs/OPEN-ITEMS.md` for everything outstanding.

> ⚠️ The four planning documents at the **repository root** describe the pre-restructure
> marketplace (sponsored listings, commission on fees, reviews, lead generation). They are
> marked superseded. **Do not build from them.**

**Before writing any code that touches booking, payments, advertising, ranking, or
the AI chatbot, read in this order:**

0. `docs/restructure/HOW-IT-WORKS.md` — **plain-language explainer: what a law firm
   is, what each rule means and why, how a matter flows. Start here if you are new**
1. `docs/restructure/README.md` — what the project is and why it is changing
2. `docs/restructure/LEGAL-GUARDRAILS.md` — hard constraints; violating one blocks the merge
3. `docs/restructure/PROGRESS.md` — **live status: what is done, what is next**
4. `docs/restructure/ROADMAP.md` — the phase plan
5. `docs/restructure/QUESTIONS-FOR-COUNSEL.md` — open legal questions
6. `docs/restructure/DATA-INVENTORY.md` — what personal data we hold, whose it is,
   and whether we are its controller or the firm's processor
7. `docs/restructure/COUNSEL-MEETING-BRIEF.md` — the five questions to put to an
   attorney, in plain language
8. `docs/restructure/SYSTEM-REVIEW.md` — a whole-codebase review: what to remove,
   restructure and add, and what is good and must not be "cleaned up"

Phases 0–8 are complete. **See `docs/restructure/PROGRESS.md` for what is next** — the
largest open items are an authenticated file-serving route for identity documents, and
provisioning the encryption-key custody and scheduled jobs that Phase 8 documented but did
not build.

### The seven hard rules (full detail in LEGAL-GUARDRAILS.md)

1. Never take a share of a legal fee — no commission, in either direction
2. Never hold client money — no escrow, balances, or withdrawals
3. Never sell position, visibility, or leads to a lawyer
4. Never let the platform choose the lawyer — neutral, disclosed ranking only
5. Protect privilege — platform staff, including `ADMIN`, cannot read matter descriptions
6. Never present the platform as giving legal advice — disclaimers + citations on all AI
7. The **firm** is the service provider; we are software

Two instruments added in Phase 2 that raise the stakes: touting is a **criminal**
offence under the **Intermeddlers with Suitors Ordinance No. 11 of 1894** and it
reaches the *platform operator*, not only the attorney; and **Supreme Court Rule
40** limits what may be displayed about an attorney to name, professional
qualifications, academic qualifications and office hours. Every profile surface is
bound by that limit — no fee ranges, no ratings, no promotional copy.

## Engineering conventions

- API routes only under `src/app/api/{feature}/route.ts`. No API logic in components
- Zod validation on **both** client and server. Schemas in `src/schemas/`
- Prisma for all DB access. Soft delete via status fields — no hard deletes
- **Schema changes ship as migrations** — `npm run db:migrate -- --name <name>`,
  and commit `prisma/migrations/` with the schema change. Never `prisma db push`
  on a shared database. See `docs/database-migrations.md`
- shadcn/ui + Tailwind only. Mobile-first, responsive at all breakpoints, WCAG 2.1 AA
- Tables: server-side pagination, filters, search, status toggles
- Run `npm run build` after every change set and fix all errors
- Run `npm run check:privilege` after touching `src/lib/firms/access.ts` — a green
  build does not prove a paralegal cannot read a client's legal problem
- Run `npm run check:ai` after touching `src/lib/ai/policy.ts` — a green build does
  not prove the assistant refuses to advise on someone's own case. **Every AI answer
  is generated server-side through `/api/ai/ask` and passes that policy file. The
  browser must never call a model service directly**
- Run `npm run check:billing` after touching `src/lib/consultations/feeNote.ts` or
  `src/lib/firms/billing.ts` — a green build does not prove a fee note is free of a
  platform fee. **The licence belongs to the `LawFirm`; a seat is a person who can
  sign in. Never meter clients, matters, enquiries, messages or conversations**
- Run `npm run check:pdpa` after touching `src/lib/privacy/` — a green build does not
  prove that an "erasure" erases anything. **We are controller for our own data and
  processor for the firm's matter data at once: never delete, export, or seek consent
  for anything under `Booking`. And never add a content column to `DataAccessLog`**
- **A published privacy notice is never edited or deleted.** Publishing writes a NEW
  version (`src/lib/privacy/notice.ts`); consent records point at the exact wording a
  person was shown, and editing in place destroys that evidence silently. Recording a
  consent *grant* fails closed when no notice is published — a *withdrawal* never does
- **If you build a right, build the screen.** Phase 6 shipped the whole PDPA rights engine
  with no caller and the compliance position was unchanged. The same applies to the firm
  side: a referral endpoint a firm cannot answer leaves the request open for ever
- **Authority inside a firm comes from an ACTIVE `FirmMember` row, never the platform
  role.** A practice manager's role is `CLIENT`. This has now been got wrong in five
  separate layers — access resolution, route guards, the lawyer layout, the middleware and
  the sidebar — so check membership, not role
- Run `npm run check:firm` after touching `src/lib/firms/invitations.ts` — a green build
  does not prove that an unverified attorney cannot become a partner, or that an attorney
  cannot carry a client's live matter into a different practice
- **Privileged matter fields are encrypted at rest** (`src/lib/privacy/encryption.ts`).
  Never read `Booking.description`, `ConflictCheck.notes`, `Quote.scopeOfWork`,
  `EngagementLetter.body` or `Message.content` directly — go through `disclose*()` in
  `src/lib/firms/access.ts`. **A disclosure path must never return ciphertext:** the
  outcomes are the plaintext or a marker, and a fallback that returns the stored value
  hands a withheld reader an offline-attackable copy of a client's legal problem
- **Never break a working flow to make a legal fix** — replace before removing
- Update `docs/restructure/PROGRESS.md` at the end of every session
