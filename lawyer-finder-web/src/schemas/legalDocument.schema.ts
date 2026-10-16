import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

/** Admin edits to a library document's details and visibility. */

const text = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? sanitizeString(v) : v),
    z.string().max(max)
  );
const optionalText = (max: number) => text(max).nullable().optional();

export const LegalDocumentUpdateSchema = z
  .object({
    title: text(200).pipe(z.string().min(3, 'Title must be at least 3 characters.')).optional(),
    description: optionalText(1000),
    actNumber: optionalText(50),
    year: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
    courtName: optionalText(100),
    caseNumber: optionalText(50),
    gazetteNumber: optionalText(50),
    // Shown in the library, or archived (hidden). PROCESSING and FAILED are set
    // only by indexing, never by hand.
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  })
  .strict();

export type LegalDocumentUpdateInput = z.infer<typeof LegalDocumentUpdateSchema>;
