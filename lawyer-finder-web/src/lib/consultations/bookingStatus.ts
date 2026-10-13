import type { BookingStatus } from '@prisma/client';

/**
 * The engagement request state machine (Phase 1).
 *
 *   REQUESTED -> CONFLICT_CHECK -> QUOTED -> ACCEPTED -> SCHEDULED -> COMPLETED
 *                      |             |           |
 *                  DECLINED   QUOTE_EXPIRED  CANCELLED_*
 *                             CLIENT_DECLINED
 *
 * Keeping the transitions in one place stops the two competing state machines
 * that existed before Phase 1 (`accept`/`decline` and `approve`/`reject` were
 * separate paths out of the same state, doing different things).
 *
 * See docs/restructure/ROADMAP.md (Phase 1).
 */

/** Statuses that release the time slot back to the calendar. */
export const SLOT_RELEASING_STATUSES: BookingStatus[] = [
  'DECLINED',
  'QUOTE_EXPIRED',
  'CLIENT_DECLINED',
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_FIRM',
];

/** Statuses where the slot is still spoken for and must not be double-booked. */
export const SLOT_BLOCKING_STATUSES: BookingStatus[] = [
  'REQUESTED',
  'CONFLICT_CHECK',
  'QUOTED',
  'ACCEPTED',
  'SCHEDULED',
  'RESCHEDULE_REQUESTED',
  'COMPLETED',
  'NO_SHOW',
  'DISPUTED',
];

/** Nothing further can happen to a booking in one of these states. */
export const TERMINAL_STATUSES: BookingStatus[] = [
  'DECLINED',
  'QUOTE_EXPIRED',
  'CLIENT_DECLINED',
  'COMPLETED',
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_FIRM',
  'NO_SHOW',
];

/** Statuses where the engagement is agreed and the consultation will go ahead. */
export const CONFIRMED_STATUSES: BookingStatus[] = [
  'SCHEDULED',
  'COMPLETED',
];

/** Statuses awaiting action from the firm (its triage queue). */
export const AWAITING_FIRM_STATUSES: BookingStatus[] = [
  'REQUESTED',
  'CONFLICT_CHECK',
];

/** Statuses awaiting action from the client. */
export const AWAITING_CLIENT_STATUSES: BookingStatus[] = [
  'QUOTED',
  'ACCEPTED',
  'RESCHEDULE_REQUESTED',
];

/** Allowed transitions. Anything not listed here is rejected. */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ['CONFLICT_CHECK', 'DECLINED', 'CANCELLED_BY_CLIENT'],
  CONFLICT_CHECK: ['QUOTED', 'DECLINED', 'CANCELLED_BY_CLIENT'],
  QUOTED: ['ACCEPTED', 'CLIENT_DECLINED', 'QUOTE_EXPIRED', 'QUOTED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_FIRM'],
  ACCEPTED: ['SCHEDULED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_FIRM'],
  SCHEDULED: ['COMPLETED', 'RESCHEDULE_REQUESTED', 'NO_SHOW', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_FIRM', 'DISPUTED'],
  RESCHEDULE_REQUESTED: ['SCHEDULED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_FIRM'],
  DISPUTED: ['COMPLETED', 'CANCELLED_BY_FIRM'],

  // Terminal
  DECLINED: [],
  QUOTE_EXPIRED: [],
  CLIENT_DECLINED: [],
  COMPLETED: [],
  CANCELLED_BY_CLIENT: [],
  CANCELLED_BY_FIRM: [],
  NO_SHOW: [],
};

/**
 * Requests on which the firm may no longer open a conversation with the client.
 *
 * The firm's attorney may message a client about a request the CLIENT sent —
 * the client made contact first, so it is not soliciting them. Once the firm
 * has said it cannot act, or either side has walked away, a new message from
 * the firm is the firm approaching someone who is no longer its prospective
 * client. An existing thread stays readable; this only governs opening one.
 */
export const CHAT_CLOSED_STATUSES: BookingStatus[] = [
  'DECLINED',
  'CLIENT_DECLINED',
  'QUOTE_EXPIRED',
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_FIRM',
];

export function firmMayMessageClient(status: BookingStatus): boolean {
  return !CHAT_CLOSED_STATUSES.includes(status);
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: BookingStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Client-facing labels. Deliberately avoids "booking"/"purchase" language. */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  REQUESTED: 'Request submitted',
  CONFLICT_CHECK: 'Under review',
  DECLINED: 'Not accepted',
  QUOTED: 'Fee proposal received',
  QUOTE_EXPIRED: 'Proposal expired',
  CLIENT_DECLINED: 'Proposal declined',
  ACCEPTED: 'Terms accepted',
  SCHEDULED: 'Scheduled',
  RESCHEDULE_REQUESTED: 'New time proposed',
  COMPLETED: 'Completed',
  CANCELLED_BY_CLIENT: 'Cancelled by you',
  CANCELLED_BY_FIRM: 'Cancelled by the firm',
  NO_SHOW: 'Missed',
  DISPUTED: 'Disputed',
};
