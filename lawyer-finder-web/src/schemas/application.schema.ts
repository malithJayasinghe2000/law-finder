import { z } from 'zod';
import { rejectSelfPromotion } from '@/lib/selfPromotion';
import { PRACTICE_AREAS, LANGUAGES, DISTRICTS } from '@/schemas/profile.schema';
import { sanitizeString } from '@/lib/sanitize';
import { IDENTITY_DOCUMENT_URL_PREFIX } from '@/lib/identityDocumentUrl';

// ── Step 1: Basic Profile & Contact ──────────────────────────────────────────

export const applicationStep1Schema = z.object({
  fullName: z.string()
    .min(3, 'Full name must be at least 3 characters.')
    .max(120, 'Full name must not exceed 120 characters.')
    .regex(/^[a-zA-Z\s.\-']+$/, 'Full name may only contain letters, spaces, hyphens, apostrophes, and periods.')
    .transform((val) => sanitizeString(val)),
  gender: z.enum(['MALE', 'FEMALE', ''], {
    message: 'Please select a valid gender option.',
  }).optional().or(z.literal('')),
  languages: z.array(z.enum(['Sinhala', 'Tamil', 'English'] as unknown as [string, ...string[]]))
    .min(1, 'Please select at least one language.'),
  bio: z.string()
    .max(2000, 'Bio must not exceed 2,000 characters.')
    .optional()
    .or(z.literal(''))
    .transform((val) => val ? sanitizeString(val) : val)
    .superRefine(rejectSelfPromotion),
  phone: z.string()
    .min(1, 'Mobile number is required.')
    .regex(/^(?:0|(?:\+94))7[0-9]{8}$/, 'Enter a valid Sri Lankan mobile number (e.g. 07XXXXXXXX or +947XXXXXXXX).'),
  address: z.string()
    .min(10, 'Office address must be at least 10 characters for accuracy.')
    .max(300, 'Address must not exceed 300 characters.')
    .transform((val) => sanitizeString(val))
    .refine((val) => val.length >= 10, 'Office address must be at least 10 characters for accuracy.'),
  district: z.enum(DISTRICTS as unknown as [string, ...string[]], {
    message: 'Please select a valid district.',
  }),
  latitude: z.string().optional().or(z.literal('')),
  longitude: z.string().optional().or(z.literal('')),
});

// ── Step 2: Professional Credentials ─────────────────────────────────────────

const COURT_OPTIONS = [
  'Supreme Court', 'Court of Appeal', 'High Court', 'District Court',
  "Magistrate's Court", 'Labour Tribunal', 'Family Court',
  'Commercial High Court', 'Intellectual Property Court',
  'Civil Court', 'Criminal Court', 'Other',
] as const;

export const applicationStep2Schema = z.object({
  baslNumber: z.string()
    .min(1, 'BASL registration number is required.')
    .regex(/^BASL[-\s]?\d{3,6}$/i, 'BASL number must follow the format BASL-XXXX (e.g. BASL-3498).'),
  yearsOfExperience: z.string()
    .min(1, 'Years of experience is required.')
    .refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0 && num <= 70 && Number.isInteger(num);
      },
      { message: 'Enter a valid number between 0 and 70.' }
    ),
  practiceType: z.enum(['Independent', 'Law Firm'], {
    message: 'Please select a practice type.',
  }),
  courts: z.enum(COURT_OPTIONS as unknown as [string, ...string[]], {
    message: 'Please select a court.',
  }),
  isNotary: z.boolean(),
});

// ── Step 3: Specializations ──────────────────────────────────────────────────

export const applicationStep3Schema = z.object({
  practiceAreas: z.array(z.enum(PRACTICE_AREAS as unknown as [string, ...string[]]))
    .min(1, 'Please select at least one specialization.')
    .max(6, 'You may select up to 6 specializations.'),
});

// ── Step 4: Verification ─────────────────────────────────────────────────────

/**
 * An uploaded identity document.
 *
 * Must be a URL produced by `POST /api/upload`, never the image itself.
 *
 * Until Phase 7 the wizard put a base64 `data:` URL straight into the draft —
 * `FileReader.readAsDataURL` for the practising certificate and
 * `canvas.toDataURL` for the face snapshot. So `LawyerApplication.draftData`
 * held up to two multi-megabyte images inline in a JSON column, and those exact
 * strings were then copied into `LawyerProfile.licenseImageUrl` and
 * `identityImageUrl`, which are named "Url" and were not URLs. It also meant the
 * documents skipped `/api/upload` entirely and with it the magic-byte check, the
 * MIME allow-list, the size limit and the rate limit.
 *
 * See docs/restructure/DATA-INVENTORY.md §7 finding D.
 */
const uploadedDocumentUrl = (missing: string) =>
  z
    .string({ message: missing })
    .min(1, missing)
    .max(500, 'That does not look like an upload reference.')
    // Only the private store (src/lib/identityDocuments.ts). A Cloudinary or
    // public/ address could be opened by anyone holding the link.
    .refine(
      (v) => v.startsWith(IDENTITY_DOCUMENT_URL_PREFIX),
      'Please upload the photo again using the button on this page.'
    );

export const applicationStep4Schema = z.object({
  /** A photo of the front of the Attorney-at-Law ID card. */
  licenseImage: uploadedDocumentUrl('Upload a photo of your Attorney-at-Law ID card.'),
  /** A photo of the applicant taken with the camera during the application. */
  identityImage: uploadedDocumentUrl('Take the photo of yourself.'),
});

// ── Full application schema (for final submission) ───────────────────────────

export const fullApplicationSchema = z.object({
  step1: applicationStep1Schema,
  step2: applicationStep2Schema,
  step3: applicationStep3Schema,
  step4: applicationStep4Schema,
});

/**
 * The shape of `LawyerApplication.draftData`, and the ONLY thing that may be
 * written to it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS. `draftData` was an untyped `Json` column, and the draft route
 * validated only the steps BEFORE the current one and then persisted
 * `req.body.draftData` verbatim rather than the parsed result. Two consequences:
 * the final step was never validated at all, and any key the caller invented was
 * stored forever. An inventory cannot honestly describe data nobody has looked
 * at, and a subject-access export cannot safely include it.
 *
 * Every step is `.strict()`, so an unknown key is a 400 rather than a silent
 * write. Every step is optional, because a draft is by definition incomplete —
 * completeness is enforced at submission and again at approval, not here.
 * ─────────────────────────────────────────────────────────────────────────────
 */
/**
 * In a draft, an empty box means "not filled in yet". The form sends every step's
 * fields from step 1 on, so without this an empty BASL number on step 2 made the
 * step-1 save fail and nobody could get past step 1 (proven 2026-10-16).
 * Empty strings and empty lists are dropped before the strict, partial parse;
 * what IS filled in is still checked, and completeness is checked per step.
 */
const withoutEmpties = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(
        Object.entries(v).filter(([, x]) => x !== '' && !(Array.isArray(x) && x.length === 0))
      )
    : v;

const draftStep = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(withoutEmpties, schema).optional();

export const ApplicationDraftSchema = z
  .object({
    step1: draftStep(applicationStep1Schema.strict().partial()),
    step2: draftStep(applicationStep2Schema.strict().partial()),
    step3: draftStep(applicationStep3Schema.strict().partial()),
    step4: draftStep(applicationStep4Schema.strict().partial()),
  })
  .strict();

export type ApplicationDraft = z.infer<typeof ApplicationDraftSchema>;

/**
 * What `draftData` is replaced with once an application is APPROVED.
 *
 * Everything it held now lives on the `LawyerProfile`, and two copies of a
 * person's identity documents is one copy too many. A rejected application keeps
 * its data for the retention period so the decision can be explained; an
 * approved one does not need to.
 */
export const APPROVED_DRAFT_STUB = {
  reduced: true,
  reducedReason:
    'Approved. The application details were written to the attorney profile and ' +
    'removed from here, so the identity documents are held once rather than twice.',
} as const;

/**
 * An admin's rejection. The reason is emailed to the applicant and kept on the
 * application, so a rejection without one cannot be explained to anybody.
 */
export const RejectApplicationSchema = z.object({
  reason: z.string({ message: 'Give the applicant a reason.' })
    .transform((val) => sanitizeString(val))
    .pipe(z.string()
      .min(10, 'Give the applicant a reason (at least 10 characters).')
      .max(1000, 'Keep the reason under 1,000 characters.')),
});

// ── Type exports ─────────────────────────────────────────────────────────────

export type ApplicationStep1Values = z.infer<typeof applicationStep1Schema>;
export type ApplicationStep2Values = z.infer<typeof applicationStep2Schema>;
export type ApplicationStep3Values = z.infer<typeof applicationStep3Schema>;
export type ApplicationStep4Values = z.infer<typeof applicationStep4Schema>;
export type FullApplicationValues = z.infer<typeof fullApplicationSchema>;

// ── Step-to-schema mapping helper ────────────────────────────────────────────

export const stepSchemas = {
  1: applicationStep1Schema,
  2: applicationStep2Schema,
  3: applicationStep3Schema,
  4: applicationStep4Schema,
} as const;

export { COURT_OPTIONS };
