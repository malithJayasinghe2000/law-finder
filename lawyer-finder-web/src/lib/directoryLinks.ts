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

/** The directory's landing list, with an optional query string ("practiceArea=Civil"). */
export function directoryPath(locale: string, query = ''): string {
  const base = PEOPLE_TAB_ENABLED ? 'lawyers' : 'firms';
  return `/${locale}/${base}${query ? `?${query}` : ''}`;
}
