import { z } from 'zod';

/**
 * Fee note validation.
 *
 * Note what is absent and must stay absent: there is no platform fee, no
 * commission, and no percentage of any kind. A fee note is arithmetic between a
 * firm and its client. See docs/restructure/LEGAL-GUARDRAILS.md (rule 1) and
 * src/lib/consultations/feeNote.ts.
 */

export const FeeNoteLineSchema = z.object({
  description: z
    .string()
    .trim()
    .min(3, 'Describe what is being charged for.')
    .max(500, 'Keep each line under 500 characters.'),
  /**
   * Whole rupees. Integers only, because LKR has been treated as whole rupees
   * everywhere since Phase 0 — the one place that treated it as cents charged a
   * client LKR 150 for a LKR 15,000 consultation.
   */
  amount: z
    .number()
    .int('Amounts are in whole rupees.')
    .min(0, 'An amount cannot be negative.')
    .max(1_000_000_000, 'That amount looks wrong. Check it before issuing.'),
});

export const FeeNoteCreateSchema = z.object({
  lines: z
    .array(FeeNoteLineSchema)
    .min(1, 'A fee note needs at least one line.')
    .max(50, 'A fee note cannot have more than 50 lines.'),
  dueDate: z.string().datetime().optional().nullable(),
  quoteId: z.string().uuid().optional().nullable(),
});

export const FeeNoteActionSchema = z.object({
  feeNoteId: z.string().uuid(),
  action: z.enum(['issue', 'settle', 'cancel']),
  /** Free text for settlement or cancellation. */
  note: z.string().trim().max(1000).optional().nullable(),
});

export type FeeNoteCreateInput = z.infer<typeof FeeNoteCreateSchema>;
export type FeeNoteActionInput = z.infer<typeof FeeNoteActionSchema>;
