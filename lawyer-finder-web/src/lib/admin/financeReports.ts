/**
 * Admin Financial Reports — OFF (2026-10-16).
 *
 * The page reports money the platform has received. For launch there is none it
 * can see: licence billing is off (src/lib/licensing.ts) and advertisers are
 * billed outside the app, so every figure is zero or would mislead. It also
 * breaks income down per attorney, but a licence belongs to the firm — rebuild
 * it per firm when billing comes back.
 *
 * A switch, not a deletion. Plain module: the sidebar and the page import it too.
 */
export const ADMIN_FINANCE_REPORTS_ENABLED = false;

export const ADMIN_FINANCE_REPORTS_OFF_REASON =
  'Financial reports are hidden for launch: licence billing is off and advertisers are billed outside the app.';
