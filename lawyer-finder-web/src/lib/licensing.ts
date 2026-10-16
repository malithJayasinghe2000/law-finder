/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Software licences and pricing are HIDDEN for launch (owner's decision,
 * 2026-10-14). They come back after launch by setting this to true. A switch,
 * not a deletion, like the other launch switches (src/lib/directoryLinks.ts).
 *
 * While it is off:
 *   - the lawyer dashboard does not show the practice's licence line
 *   - there is no seat limit (`canAddFirmMember`): any practice may invite as
 *     many colleagues as it needs, free (owner's choice, 2026-10-14)
 *
 *   - the Payments menu (Invoices, Payment History), every page under
 *     /dashboard/lawyer/payments and /dashboard/lawyer/invoices, and /pricing show
 *     "Licences are not sold yet"; the top bar has no Pricing link and the user menu
 *     no subscription line
 *   - creating an invoice, submitting a payment and renewing are refused (410)
 *   - admin Invoices (menu link, pages, list and review API) is hidden; the
 *     review API answers 410 (2026-10-16)
 *
 * BEFORE SWITCHING THIS ON: check what each plan offers. Paid promotion and
 * "receive client inquiries" were removed on 2026-10-15 (rules 1 and 3); plans
 * must differ only on software and seats. The pricing page's Permissions list
 * was empty for every plan at that date — check it renders.
 *
 * Plain module, no database: client components import it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const LICENSING_ENABLED = false;
