/**
 * The admin Refunds view — OFF (2026-10-16).
 *
 * It listed every refund a practice owes its clients: client names and emails,
 * amounts, cancel reasons. The client paid the practice, the practice returns the
 * money and records it (decision 16, rules 2 and 7), and staff had nothing to do
 * with the list except read it — a firm's record of its own clients that no staff
 * task needs. Practices keep their own Refunds page.
 *
 * A switch, not a deletion. Plain module: the sidebar and the page import it too.
 */
export const ADMIN_REFUNDS_VIEW_ENABLED = false;

export const ADMIN_REFUNDS_VIEW_OFF_REASON =
  'Refunds are between a practice and its client. Each practice records them on its own Refunds page.';
