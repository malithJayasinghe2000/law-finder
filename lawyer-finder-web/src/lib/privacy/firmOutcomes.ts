/**
 * Which answers a law firm may give to which data-subject request.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Every outcome used to be offered for every request, and that allowed two false
 * answers to a statutory request:
 *
 *   - **"Erased" is not something a firm can do here.** There is no tool for a
 *     firm to delete a matter, and the platform's purge structurally cannot touch
 *     matter data. A firm choosing it would tell the person their file was gone
 *     while we still held it. Offered nowhere until a deletion tool exists.
 *
 *   - **A copy request answered with "kept".** Having to retain a file is a reason
 *     not to DELETE it; it is not a reason to refuse someone a COPY. Perera's
 *     seeded answer to an access request did exactly that.
 *
 * Only ACCESS, PORTABILITY and ERASURE are referred to firms (`needsFirmReferral`).
 * Plain module, no database: the firm's page imports it, and the server enforces
 * the same list in `recordFirmResponse`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type FirmOutcome = 'RELEASED' | 'ERASED' | 'REFUSED_RETAINED' | 'PARTIAL' | 'NO_DATA';

export type OutcomeOption = { value: FirmOutcome; label: string; help: string };

const COPY_OPTIONS: OutcomeOption[] = [
  { value: 'RELEASED', label: 'Gave them a copy', help: 'Say how and when, e.g. emailed on 2 March.' },
  { value: 'PARTIAL', label: 'Gave part of it', help: 'Say what you held back and the legal ground for it.' },
  {
    value: 'REFUSED_RETAINED',
    label: 'Refused',
    help: 'Name the legal ground. Having to keep a file is not a reason to refuse a copy.',
  },
  { value: 'NO_DATA', label: 'We hold nothing', help: 'No matter data for this person.' },
];

const ERASURE_OPTIONS: OutcomeOption[] = [
  {
    value: 'REFUSED_RETAINED',
    label: 'Kept - a duty requires it',
    help: 'Name the duty. The person is shown your reason.',
  },
  { value: 'NO_DATA', label: 'We hold nothing', help: 'No matter data for this person.' },
];

export function outcomeOptions(type: string): OutcomeOption[] {
  if (type === 'ERASURE') return ERASURE_OPTIONS;
  if (type === 'ACCESS' || type === 'PORTABILITY') return COPY_OPTIONS;
  return [];
}

export function isOutcomeAllowed(type: string, outcome: string): boolean {
  return outcomeOptions(type).some((o) => o.value === outcome);
}

/** Label for an answer already given, including outcomes no longer offered. */
export function outcomeLabel(type: string, outcome: string): string {
  return (
    outcomeOptions(type).find((o) => o.value === outcome)?.label ??
    { ERASED: 'Erased', REFUSED_RETAINED: 'Kept', PARTIAL: 'Partly done', RELEASED: 'Released', NO_DATA: 'We hold nothing' }[outcome] ??
    outcome
  );
}

/**
 * Shown on an erasure request. A firm that wants the file deleted has no way to
 * do it from here yet, and must not be pushed into an answer that says it did.
 */
export const ERASURE_NOT_AVAILABLE_NOTE =
  'Deleting a matter file from the platform cannot be done from this screen yet. If you have no ' +
  'duty to keep it and want it deleted, contact us before you answer.';
