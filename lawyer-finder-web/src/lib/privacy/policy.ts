/**
 * The data-protection rule. One file, like `firms/access.ts` and `ai/policy.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Personal Data Protection Act No. 9 of 2022.
 *
 * Read `docs/restructure/DATA-INVENTORY.md` first — it says what personal data
 * this platform holds and under whose authority. This file turns that document
 * into decisions that code can make: how long a thing lives, what an erasure
 * request may actually erase, which purposes rest on consent, and what has to be
 * written to the access log.
 *
 * THE ONE IDEA THIS FILE EXISTS TO ENFORCE.
 *
 * We are a **controller** for our own data and a **processor** for the firm's
 * matter data, at the same time. Those roles carry different duties, and almost
 * every mistake available here comes from applying one role's rule to the other
 * role's data:
 *
 *   - purging matter data on our schedule (it is not ours to delete)
 *   - honouring "delete everything about me" against a file a firm is
 *     professionally required to keep
 *   - calling matter processing "consent", which implies it is withdrawable
 *
 * So every rule below is tagged with who controls the data, and the purge
 * refuses outright to touch anything a firm controls.
 *
 * Run `npm run check:pdpa` after changing this file. A green `npm run build`
 * proves none of it — it compiles just as happily on a purge that deletes a
 * firm's conflict-check records.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { ConsentPurpose, SubjectRequestType } from '@prisma/client';
import { AI_CONVERSATION_RETENTION_DAYS } from '@/lib/ai/policy';

// ─────────────────────────────────────────────────────────────────────────────
// The privacy notice
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The version of the privacy notice currently shown.
 *
 * Stamped onto every `ConsentRecord`. Without it, "they consented" is a claim
 * about a document nobody can produce — which is not demonstrable consent.
 * Bump this whenever the notice text changes materially.
 */
export const PRIVACY_NOTICE_VERSION = '2026-08-03';

// ─────────────────────────────────────────────────────────────────────────────
// Who controls what
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PLATFORM — we decided to collect it, we answer for it, we may delete it.
 * FIRM     — the firm decided; we hold it as processor and act on instruction.
 */
export type Controller = 'PLATFORM' | 'FIRM';

/**
 * Prisma model names holding data the FIRM controls.
 *
 * The purge and the erasure planner both consult this. Adding a model here is
 * how you say "we may not delete this on our own authority"; it is not a
 * convenience list and must match `DATA-INVENTORY.md` §3.
 */
export const FIRM_CONTROLLED_MODELS = [
  'booking',
  'conflictCheck',
  'quote',
  'engagementLetter',
  'feeNote',
  'bookingPayment',
  'conversation',
  'conversationParticipant',
  'message',
] as const;

export type FirmControlledModel = (typeof FIRM_CONTROLLED_MODELS)[number];

export function controllerOf(model: string): Controller {
  return (FIRM_CONTROLLED_MODELS as readonly string[]).includes(model)
    ? 'FIRM'
    : 'PLATFORM';
}

// ─────────────────────────────────────────────────────────────────────────────
// Retention
// ─────────────────────────────────────────────────────────────────────────────

export type RetentionRule = {
  /** Prisma model name, as `prisma.<model>` */
  model: string;
  /** Days from `timestampField` until the row may be deleted. */
  days: number;
  /**
   * Which timestamp the clock runs from.
   *
   * `updatedAt` where a thing is still in use — deleting a conversation
   * someone is mid-way through would be a bug wearing a policy's clothes.
   * `createdAt` where the record is inert once written.
   */
  timestampField: 'createdAt' | 'updatedAt' | 'expiresAt';
  controller: Controller;
  /** Why this number and not another. Reviewed, not guessed. */
  reason: string;
};

/**
 * The retention schedule.
 *
 * Every period here is a **platform-controlled** one. That is not an oversight:
 * the two periods that matter most — how long a matter file and a conflict-check
 * record must be kept — belong to the firm and depend on professional duties we
 * do not get to set. They are **counsel question 7(c)**, unanswered, so nothing
 * in §3 of the inventory is on an automatic schedule. See
 * `firmRetentionIsUndecided()` below.
 */
export const RETENTION_SCHEDULE: RetentionRule[] = [
  {
    model: 'aiConversation',
    days: AI_CONVERSATION_RETENTION_DAYS,
    timestampField: 'updatedAt',
    controller: 'PLATFORM',
    reason:
      'People describe real legal situations here. We keep it only so a signed-in ' +
      'user finds their history where they left it, so the period is the shortest ' +
      'that delivers that, counted from last use rather than creation.',
  },
  {
    model: 'inquiry',
    days: 365,
    timestampField: 'createdAt',
    controller: 'PLATFORM',
    reason:
      'An enquiry that never became a matter is a description of a legal problem ' +
      'with no retainer behind it and no reason to outlive the year it was sent.',
  },
  {
    model: 'slotHold',
    days: 7,
    timestampField: 'expiresAt',
    controller: 'PLATFORM',
    reason:
      'A lapsed hold records which attorney a person was considering — an interest ' +
      'signal about their legal affairs — and serves no purpose once expired.',
  },
  {
    model: 'verificationToken',
    days: 30,
    timestampField: 'expiresAt',
    controller: 'PLATFORM',
    reason: 'A spent credential is only a liability.',
  },
  {
    model: 'dataAccessLog',
    days: 730,
    timestampField: 'createdAt',
    controller: 'PLATFORM',
    reason:
      'Long enough to investigate a complaint about who read a matter; short ' +
      'enough that the accountability record does not itself become a permanent ' +
      'surveillance history of a firm’s working habits.',
  },
  {
    model: 'report',
    days: 365,
    timestampField: 'updatedAt',
    controller: 'PLATFORM',
    reason: 'Moderation history stops being useful once the account behaviour has settled.',
  },
  {
    model: 'adAnalytics',
    days: 730,
    timestampField: 'createdAt',
    controller: 'PLATFORM',
    reason:
      'Aggregate impressions and clicks per campaign per day. No user identifier, ' +
      'so this is a housekeeping period rather than a privacy one.',
  },
];

/** The cutoff instant for a rule: anything older may go. */
export function retentionCutoff(days: number, now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

/**
 * May the purge delete rows of this model?
 *
 * Refuses firm-controlled data outright. A retention job that quietly deleted a
 * firm's conflict-check records would destroy evidence the firm is required to
 * hold, and we would have done it on our own authority as their processor.
 * This is the check that makes `privacy:purge` safe to schedule.
 */
export function assertPurgeable(model: string): { ok: true } | { ok: false; reason: string } {
  if (controllerOf(model) === 'FIRM') {
    return {
      ok: false,
      reason:
        `${model} holds matter data the FIRM controls. We hold it as processor and ` +
        `may not delete it on our own schedule — the firm's professional retention ` +
        `duty decides, and that is counsel question 7(c), still unanswered.`,
    };
  }

  if (!RETENTION_SCHEDULE.some((r) => r.model === model)) {
    return {
      ok: false,
      reason: `${model} has no entry in RETENTION_SCHEDULE. Add one deliberately rather than defaulting to "keep forever".`,
    };
  }

  return { ok: true };
}

/**
 * True while the firm-side retention periods remain unanswered by counsel.
 *
 * Deliberately a function and not a comment: the purge reports it every run, so
 * the gap stays visible instead of being forgotten once the script is green.
 */
export function firmRetentionIsUndecided(): boolean {
  return true; // Flip when counsel question 7(c) is answered, and add the rules.
}

// ─────────────────────────────────────────────────────────────────────────────
// Consent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The purposes we rely on consent for — and this is the complete list.
 *
 * Matter data is absent on purpose. It is processed to perform the retainer and
 * to meet the firm's professional obligations, which are different lawful bases
 * with no withdrawal right attached. Presenting it as consent would promise a
 * client that they can withdraw it, and we would then have to break that promise
 * against a firm that is required to keep the file. Treating everything as
 * consent is the common and expensive PDPA error.
 */
export const CONSENT_PURPOSES: Record<
  ConsentPurpose,
  { label: string; description: string; onWithdrawal: string }
> = {
  MARKETING_EMAIL: {
    label: 'Product news and offers',
    description:
      'Occasional email about new features and legal-information content. Never a ' +
      'condition of using anything on the platform.',
    onWithdrawal: 'We stop sending. Nothing else changes.',
  },
  PRODUCT_ANALYTICS: {
    label: 'Usage analytics',
    description:
      'Non-essential measurement of which screens are used, to decide what to build. ' +
      'Never applied to anything you wrote about a legal problem.',
    onWithdrawal: 'We stop collecting. Existing aggregates hold no identifier.',
  },
  AI_HISTORY_RETENTION: {
    label: 'Keep my AI chat history',
    description:
      'Keeps your conversations with the legal assistant so you can return to them. ' +
      `Kept for ${AI_CONVERSATION_RETENTION_DAYS} days from last use either way.`,
    onWithdrawal:
      'Your existing conversations are deleted, not merely hidden — withdrawal that ' +
      'leaves the data in place is not withdrawal.',
  },
};

/**
 * Guard against the error this whole section exists to prevent.
 *
 * Returns false for anything the firm controls: you cannot obtain consent for
 * processing you do not control and cannot stop.
 */
export function mayRelyOnConsentFor(model: string): boolean {
  return controllerOf(model) === 'PLATFORM';
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject requests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Days to answer a data-subject request.
 *
 * 21 days is our own service standard, set below any statutory maximum on
 * purpose so that a slipping request is visible here before it is late in law.
 */
export const SUBJECT_REQUEST_DUE_DAYS = 21;

export function subjectRequestDueDate(from: Date = new Date()): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + SUBJECT_REQUEST_DUE_DAYS);
  return due;
}

/**
 * Does this request need the firm to decide part of it?
 *
 * Access, portability and erasure all reach into matter data, which the firm
 * controls. Rectification of a person's own contact details does not.
 */
export function needsFirmReferral(type: SubjectRequestType): boolean {
  return type === 'ACCESS' || type === 'ERASURE' || type === 'PORTABILITY';
}

// ─────────────────────────────────────────────────────────────────────────────
// Erasure
// ─────────────────────────────────────────────────────────────────────────────

export type ErasureAction =
  /** Rows are deleted. */
  | 'DELETE'
  /** The row survives; identifying fields are overwritten in place. */
  | 'ANONYMISE'
  /** Nothing happens, and we must be able to say which duty required that. */
  | 'RETAIN';

export type ErasureStep = {
  model: string;
  action: ErasureAction;
  controller: Controller;
  /** Shown to the person. A refusal they cannot understand is not an answer. */
  explanation: string;
};

/**
 * What "delete everything about me" actually does, model by model.
 *
 * The honest shape of this is *partial* fulfilment, and the interface must say
 * so plainly rather than reporting a clean success. Three things make a complete
 * erasure impossible, and none of them is a technical limitation:
 *
 *  1. A firm may be professionally required to keep the matter file.
 *  2. A fee note is a tax document with its own statutory retention.
 *  3. A conflict-check record names OTHER people; erasing it on this client's
 *     request would degrade the firm's ability to screen for conflicts
 *     affecting someone else entirely.
 *
 * So the `User` row is anonymised rather than deleted: matters reference the
 * client for years, and removing the row would either cascade into a firm's
 * records or orphan them.
 */
export const ERASURE_PLAN: ErasureStep[] = [
  {
    model: 'user',
    action: 'ANONYMISE',
    controller: 'PLATFORM',
    explanation:
      'Your name, email, photo and sign-in credentials are overwritten and the account ' +
      'is closed. The record itself remains so that any matter a law firm holds stays ' +
      'intact — deleting it would damage the firm’s file, not just ours.',
  },
  {
    model: 'aiConversation',
    action: 'DELETE',
    controller: 'PLATFORM',
    explanation: 'Your conversations with the legal assistant are deleted outright.',
  },
  {
    model: 'inquiry',
    action: 'DELETE',
    controller: 'PLATFORM',
    explanation: 'Enquiries you sent to attorneys that never became a matter are deleted.',
  },
  {
    model: 'consentRecord',
    action: 'RETAIN',
    controller: 'PLATFORM',
    explanation:
      'The record of what you agreed to, and when, is kept. It is the evidence that we ' +
      'handled your data lawfully, and deleting it would remove your own proof.',
  },
  {
    model: 'post',
    action: 'ANONYMISE',
    controller: 'PLATFORM',
    explanation:
      'Community posts and comments are detached from your name. The text stays, because ' +
      'other people’s replies depend on it.',
  },
  {
    model: 'vote',
    action: 'DELETE',
    controller: 'PLATFORM',
    explanation: 'Your votes are deleted.',
  },
  {
    model: 'booking',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'Your matter file belongs to the law firm you engaged, not to us. We hold it on ' +
      'their behalf. Your request has been passed to them, and they will decide — an ' +
      'attorney may be professionally required to keep it.',
  },
  {
    model: 'conflictCheck',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'Conflict-of-interest records name other parties as well as you, and the firm needs ' +
      'them to check for conflicts affecting other clients in future. They cannot be ' +
      'erased on one party’s request.',
  },
  {
    model: 'quote',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'The fee quotes the firm sent you are part of the record of what was agreed, and ' +
      'are kept with the matter file.',
  },
  {
    model: 'feeNote',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'A fee note is a tax document. The firm is required to keep it for the statutory ' +
      'period regardless of any request.',
  },
  {
    model: 'bookingPayment',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'Records of payments you made to the firm are financial records the firm must keep, ' +
      'and they are also your evidence that you paid.',
  },
  {
    model: 'conversation',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'The message threads between you and the firm are part of its matter file.',
  },
  {
    model: 'conversationParticipant',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'Who took part in a message thread is part of the firm’s record of that thread.',
  },
  {
    model: 'engagementLetter',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'The engagement letter is the record of the terms you agreed with the firm, and ' +
      'protects you as much as them.',
  },
  {
    model: 'message',
    action: 'RETAIN',
    controller: 'FIRM',
    explanation:
      'Messages between you and your attorney form part of the firm’s matter file, and ' +
      'are privileged. The firm decides.',
  },
];

/**
 * The value written over an erased user's email.
 *
 * Unique per user (the column is unique) and in `.invalid`, which RFC 2606
 * reserves so it can never resolve to a real mailbox.
 */
export function erasedEmailFor(userId: string): string {
  return `erased-${userId}@erased.invalid`;
}

export type ErasurePlanSummary = {
  deleted: ErasureStep[];
  anonymised: ErasureStep[];
  retained: ErasureStep[];
  /** True whenever anything is retained — which is always, today. */
  partial: boolean;
};

/** Group the plan for presentation. The interface must show all three groups. */
export function summariseErasure(): ErasurePlanSummary {
  const deleted = ERASURE_PLAN.filter((s) => s.action === 'DELETE');
  const anonymised = ERASURE_PLAN.filter((s) => s.action === 'ANONYMISE');
  const retained = ERASURE_PLAN.filter((s) => s.action === 'RETAIN');
  return { deleted, anonymised, retained, partial: retained.length > 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// What must be audited
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reading the client's own account of their legal problem is the event worth
 * recording. Seeing that a matter exists in a list is not — logging every list
 * render would bury the one entry anybody would ever look for.
 *
 * Note what is NOT part of auditing: the log holds no content. See the comment
 * on `DataAccessLog` in schema.prisma — a log that copies the description into
 * itself is a second privileged store.
 */
export function mustAuditDetailRead(): boolean {
  return true;
}

/**
 * A client reading their own matter is not an access worth logging — they wrote
 * it. The log exists to record when someone *else* read it.
 */
export function shouldAudit(params: {
  actorUserId: string;
  clientUserId: string;
}): boolean {
  return params.actorUserId !== params.clientUserId;
}
