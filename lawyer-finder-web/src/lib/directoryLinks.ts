/**
 * Where links into the public directory point.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The directory has two tabs: Practices (/firms) and People (/lawyers). The
 * People tab is HIDDEN for launch (owner's decision, 2026-10-13): clients browse
 * practices, and see a practice's attorneys on the practice's own page. It is a
 * switch, not a deletion, so it can return after launch by setting this to true.
 *
 * While it is off:
 *   - /lawyers redirects to /firms (keeping the filters), /api/lawyers is 404
 *   - the Practices / People toggle is not shown
 *   - every link that pointed at /lawyers points at /firms instead
 *   - an attorney's own page (/lawyers/[id]) still works — the firm page links to it
 *
 * Plain module, no database: client components import it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const PEOPLE_TAB_ENABLED = false;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Requests go to the PRACTICE only, for launch (owner's decision, 2026-10-13).
 * The client engages the practice; the practice assigns the attorney. A switch,
 * not a deletion: the attorney-first booking flow returns by setting this true.
 *
 * While it is off:
 *   - an attorney page's "Request Consultation" goes to their practice's engage page
 *   - /lawyers/[id]/book redirects there too
 *   - POST /api/consultations/bookings refuses a request that names an attorney
 *     (hiding the button alone would leave the API taking them)
 *   - requests made before the switch are untouched
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const ATTORNEY_BOOKING_ENABLED = false;

/** Where a client goes to send a request to a practice. */
export function engagePath(locale: string, firmSlug: string): string {
  return `/${locale}/firms/${firmSlug}/engage`;
}

/** The directory's landing list, with an optional query string ("practiceArea=Civil"). */
export function directoryPath(locale: string, query = ''): string {
  const base = PEOPLE_TAB_ENABLED ? 'lawyers' : 'firms';
  return `/${locale}/${base}${query ? `?${query}` : ''}`;
}
