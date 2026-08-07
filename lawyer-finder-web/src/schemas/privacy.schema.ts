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

export type SubjectRequestCreateInput = z.infer<typeof SubjectRequestCreateSchema>;
export type ConsentUpdateInput = z.infer<typeof ConsentUpdateSchema>;
export type RectificationInput = z.infer<typeof RectificationSchema>;
