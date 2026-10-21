import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';
import { DOCUMENT_TYPES, SUBJECTS } from '@/lib/legalLibrary';

/** Admin edits to a library document's details and visibility. */

const text = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? sanitizeString(v) : v),
    z.string().max(max)
  );
const optionalText = (max: number) => text(max).nullable().optional();
const blankToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

const documentType = z.enum(DOCUMENT_TYPES.map((t) => t.value) as [string, ...string[]], {
  message: 'Choose what kind of document this is.',
});
const subjects = z.array(z.enum(SUBJECTS.map((s) => s.value) as [string, ...string[]])).max(4, 'Choose up to four subjects.');
const year = z.preprocess(blankToNull, z.coerce.number().int().min(1800, 'Year must be after 1800').max(2100, 'Year must be before 2100').nullable());
const id = z.preprocess(blankToNull, z.string().uuid().nullable());
// A source address must be a web address a reader can open, never a script.
const sourceUrl = z.preprocess(
  blankToNull,
  z.string().max(500).url('The source must be a web address.').refine((u) => /^https?:\/\//i.test(u), 'The source must be a web address.').nullable()
);

export const LegalDocumentUpdateSchema = z
  .object({
    title: text(200).pipe(z.string().min(3, 'Title must be at least 3 characters.')).optional(),
    category: documentType.optional(),
    subjects: subjects.optional(),
    description: optionalText(1000),
    actNumber: optionalText(50),
    year: year.optional(),
    consolidatedToYear: year.optional(),
    courtName: optionalText(100),
    caseNumber: optionalText(50),
    gazetteNumber: optionalText(50),
    amendsId: id.optional(),
    sourceName: optionalText(120),
    sourceUrl: sourceUrl.optional(),
    // "I checked: nothing newer exists" - stamps lastCheckedAt with today.
    markChecked: z.literal(true).optional(),
    // Shown in the library, or archived (hidden). PROCESSING, FAILED and
    // AWAITING_ORIGINAL are set by the system, never by hand.
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  })
  .strict();

export type LegalDocumentUpdateInput = z.infer<typeof LegalDocumentUpdateSchema>;

/**
 * An upload. The form posts multipart, so arrays arrive as one comma-joined
 * `subjects` field and numbers as strings.
 */
export const LegalDocumentUploadSchema = z.object({
  title: text(200).pipe(z.string().min(3, 'Title must be at least 3 characters.')),
  category: documentType,
  subjects: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v ?? []),
    subjects
  ),
  description: z.preprocess(blankToNull, text(1000).nullable()),
  actNumber: z.preprocess(blankToNull, text(50).nullable()),
  year,
  consolidatedToYear: year,
  courtName: z.preprocess(blankToNull, text(100).nullable()),
  caseNumber: z.preprocess(blankToNull, text(50).nullable()),
  gazetteNumber: z.preprocess(blankToNull, text(50).nullable()),
  amendsId: id,
  sourceName: z.preprocess(blankToNull, text(120).nullable()),
  sourceUrl,
  // Set when this file is the missing original of a law already listed
  // (status AWAITING_ORIGINAL): that entry is filled in, not a new one made.
  originalForId: id,
});

export type LegalDocumentUploadInput = z.infer<typeof LegalDocumentUploadSchema>;

/** Approving an Act from Parliament's listing. */
export const ParliamentApproveSchema = z
  .object({
    // The law it amends: an existing library entry, or a new entry listed
    // without its original text (e.g. the Penal Code, which predates Parliament).
    amendsId: id.optional(),
    newLaw: z
      .object({
        title: text(200).pipe(z.string().min(3, 'Give the law its full name, e.g. "Penal Code".')),
        category: z.enum(['ACT', 'ORDINANCE', 'CONSTITUTION']),
      })
      .optional(),
    subjects: subjects.optional().default([]),
  })
  .strict()
  .refine((v) => !(v.amendsId && v.newLaw), 'Choose an existing law or a new one, not both.');

export type ParliamentApproveInput = z.infer<typeof ParliamentApproveSchema>;
