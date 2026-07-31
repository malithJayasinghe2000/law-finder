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

**Before writing any code that touches booking, payments, advertising, ranking, or
the AI chatbot, read in this order:**

1. `docs/restructure/README.md` — what the project is and why it is changing
2. `docs/restructure/LEGAL-GUARDRAILS.md` — hard constraints; violating one blocks the merge
3. `docs/restructure/PROGRESS.md` — **live status: what is done, what is next**
4. `docs/restructure/ROADMAP.md` — the phase plan

### The seven hard rules (full detail in LEGAL-GUARDRAILS.md)

1. Never take a share of a legal fee — no commission, in either direction
2. Never hold client money — no escrow, balances, or withdrawals
3. Never sell position, visibility, or leads to a lawyer
4. Never let the platform choose the lawyer — neutral, disclosed ranking only
5. Protect privilege — platform staff, including `ADMIN`, cannot read matter descriptions
6. Never present the platform as giving legal advice — disclaimers + citations on all AI
7. The **firm** is the service provider; we are software

## Engineering conventions

- API routes only under `src/app/api/{feature}/route.ts`. No API logic in components
- Zod validation on **both** client and server. Schemas in `src/schemas/`
- Prisma for all DB access. Soft delete via status fields — no hard deletes
- shadcn/ui + Tailwind only. Mobile-first, responsive at all breakpoints, WCAG 2.1 AA
- Tables: server-side pagination, filters, search, status toggles
- Run `npm run build` after every change set and fix all errors
- **Never break a working flow to make a legal fix** — replace before removing
- Update `docs/restructure/PROGRESS.md` at the end of every session
