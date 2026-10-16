/**
 * The admin "create booking" tool — OFF (2026-10-13).
 *
 * Platform staff picked the attorney for a client (rule 4: the platform never
 * chooses the lawyer) and typed in the client's legal problem (rule 5: platform
 * staff never read it), and the matter went straight to SCHEDULED, skipping the
 * conflict check. Replaced by the practice opening the request itself, which the
 * client confirms — see src/lib/firms/clientIntake.ts.
 *
 * A switch, not a deletion. Plain module: the admin page imports it too.
 */
export const ADMIN_CREATE_BOOKING_ENABLED = false;

export const ADMIN_CREATE_BOOKING_OFF_REASON =
  'Bookings are no longer created by platform staff. A practice opens a request for its own client ' +
  'from its dashboard (Consultation bookings → New request), and the client confirms it.';
