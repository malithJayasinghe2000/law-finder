import { z } from 'zod';

/**
 * Validation for the data-protection surfaces. Zod on both client and server,
 * per the project convention.
 */

export const SubjectRequestTypeEnum = z.enum([
  'ACCESS',
  'RECTIFICATION',
  'ERASURE',
  'PORTABILITY',
  'OBJECTION',
]);

export const SubjectRequestCreateSchema = z.object({
  type: SubjectRequestTypeEnum,
  requestNote: z.string().trim().max(2000).optional(),
  /**
   * Required for ERASURE only. The action is irreversible and only partial —
   * a firm's matter file survives it — so the person must confirm after seeing
   * the preview rather than discovering the limits afterwards.
   */
  confirm: z.boolean().optional(),
});

export const ConsentPurposeEnum = z.enum([
  'MARKETING_EMAIL',
  'PRODUCT_ANALYTICS',
  'AI_HISTORY_RETENTION',
]);

export const ConsentUpdateSchema = z.object({
  purpose: ConsentPurposeEnum,
  granted: z.boolean(),
});

/**
 * Rectification, restricted to the fields a person may correct about
 * themselves. Deliberately narrow: `role`, `status` and anything on a matter
 * are not self-service, and a schema that allowed them would be the whole
 * vulnerability.
 */
export const RectificationSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  profileImageUrl: z.string().url().max(2000).nullable().optional(),
});

/**
 * A privacy-notice draft.
 *
 * `version` is only accepted on creation. There is deliberately no way to
 * change the label of an existing row: consent records point at it, and
 * renaming the target does not repair a dangling reference, it moves one.
 */
export const PrivacyNoticeCreateSchema = z.object({
  version: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,8})?$/,
      'Use a date, e.g. 2026-08-03 - with a short suffix (2026-08-03-b) if you publish twice in one day.'
    ),
  title: z.string().trim().min(3).max(200).optional(),
  body: z.string().min(200, 'A privacy notice this short is a placeholder, not a notice.'),
  changeSummary: z.string().trim().max(2000).optional(),
});

export const PrivacyNoticeUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  body: z.string().min(200).optional(),
  changeSummary: z.string().trim().max(2000).nullable().optional(),
});

/**
 * A law firm's answer to the part of a subject request that is theirs.
 *
 * `reason` has a floor rather than being optional, because the outcome that
 * matters most here is a refusal — and a refusal that does not name the duty
 * requiring retention is not a defensible refusal. The person is shown these
 * words verbatim as the firm's answer.
 */
export const FirmSubjectResponseSchema = z.object({
  requestId: z.string().uuid(),
  outcome: z.enum(['RELEASED', 'ERASED', 'REFUSED_RETAINED', 'PARTIAL', 'NO_DATA']),
  reason: z.string().trim().min(20).max(4000),
});

export type SubjectRequestCreateInput = z.infer<typeof SubjectRequestCreateSchema>;
export type FirmSubjectResponseInput = z.infer<typeof FirmSubjectResponseSchema>;
export type PrivacyNoticeCreateInput = z.infer<typeof PrivacyNoticeCreateSchema>;
export type PrivacyNoticeUpdateInput = z.infer<typeof PrivacyNoticeUpdateSchema>;
export type ConsentUpdateInput = z.infer<typeof ConsentUpdateSchema>;
export type RectificationInput = z.infer<typeof RectificationSchema>;
