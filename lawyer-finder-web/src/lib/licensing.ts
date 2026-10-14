/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Software licences and pricing are HIDDEN for launch (owner's decision,
 * 2026-10-14). They come back after launch by setting this to true. A switch,
 * not a deletion, like the other launch switches (src/lib/directoryLinks.ts).
 *
 * While it is off:
 *   - the lawyer dashboard does not show the practice's licence line
 *
 * Still to be wired to it, as each section is reviewed: the pricing page, the
 * Payments menu (Invoices, Payment History) and the seat limit in
 * src/lib/firms/billing.ts, which still refuses a practice with no licence.
 *
 * Plain module, no database: client components import it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const LICENSING_ENABLED = false;
