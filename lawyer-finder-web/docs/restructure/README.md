# Legal Restructure — Start Here

> **If you are an AI agent or a new contributor: read this file first, then
> [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md). Do not write code that touches
> booking, payments, advertising, or the AI chatbot until you have read both.**

## What this project is

`lawyer-finder-web` is a Sri Lankan legal-services platform (Next.js 16.2, React 19,
Prisma 7 / PostgreSQL, next-intl for en/si/ta). It has three roles — `ADMIN`,
`LAWYER`, `CLIENT` — and these subsystems:

| Subsystem | Location | State |
| --- | --- | --- |
| Consultation booking | `src/app/api/consultations/**` | **Being restructured** |
| Lawyer subscriptions + RBAC | `src/app/api/subscriptions/**`, `admin/roles` | Stable |
| Advertising / paid promos | `src/app/api/ads/**`, `admin/ad-config` | **Restructure pending (Phase 4)** |
| Community hub (posts/votes/moderation) | `src/app/api/{posts,comments,communities}` | Stable |
| RAG legal chatbot + legal library | `src/app/api/ai-chat/**`, `legal-documents/**` | **Compliance work pending (Phase 5)** |
| Realtime chat (socket.io) | `src/app/api/chat/**`, `server.js` | Stable |

## Why it is being restructured

The platform was built as a **legal-services marketplace**: it took a 15% commission
on consultation fees, held client money in escrow, paid lawyers out via withdrawal
requests, and sold ranking/visibility to lawyers.

In Sri Lanka an attorney-at-law may not share fees with a non-lawyer, may not
advertise or solicit, and may not pay for referrals; client money must sit in the
attorney's own client account. A commission-taking marketplace is the one shape this
product cannot legally take.

**The restructure repositions the platform from a marketplace into the software that
law firms run on.**

```
BEFORE                             AFTER
Client -> Platform -> Lawyer       Client -> Law Firm
          takes 15%                          runs on our software
          holds the money                    holds its own client money
          picks the lawyer                   pays us a flat licence fee
```

Revenue moves from *a share of legal fees* to *a flat software licence*, which is
both legal and a better business.

Full reasoning: [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md).
Questions awaiting a lawyer's answer: [QUESTIONS-FOR-COUNSEL.md](./QUESTIONS-FOR-COUNSEL.md).
Starting Phase 2 in a fresh session? [PHASE-2-BRIEF.md](./PHASE-2-BRIEF.md).

## Where we are right now

**See [PROGRESS.md](./PROGRESS.md) for the live status.** That file is the single
source of truth for what is done and what is next. Update it at the end of every
work session.

Phase plan lives in [ROADMAP.md](./ROADMAP.md).

## Ground rules for anyone working on this

1. **Read [LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md) before touching money,
   booking, ads, or AI output.** The guardrails are not style preferences; breaking
   one exposes real attorneys to disciplinary action.
2. **Never break a working flow to make a legal fix.** Every phase ships behind a
   migration path. If a feature must die, replace it before removing it.
3. **This is Next.js 16.2 with breaking changes.** Read the relevant guide in
   `node_modules/next/dist/docs/` before writing route handlers or server
   components — do not rely on training-data assumptions.
4. **Validate with Zod on both client and server.** API routes live only under
   `src/app/api/`. Use Prisma for all DB access. Soft-delete via status fields, no
   hard deletes.
5. **Run `npm run build` after every change set** and fix all errors before moving on.
6. **Update [PROGRESS.md](./PROGRESS.md)** with what changed and what is next.

## Legal disclaimer

Nothing in these documents is legal advice. They record a good-faith engineering
interpretation of Sri Lankan professional-conduct rules, written to make the product
defensible by design. **Every phase must be reviewed by a BASL-member attorney
before it ships to production.** Open questions requiring counsel are tracked in
[LEGAL-GUARDRAILS.md](./LEGAL-GUARDRAILS.md#open-questions-for-counsel).
