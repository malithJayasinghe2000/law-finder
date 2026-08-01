import { z } from 'zod';
import { sanitizeString } from '@/lib/security';
import { DISTRICTS, PRACTICE_AREAS, LANGUAGES } from '@/schemas/profile.schema';

/**
 * Law firm validation, shared by client and server.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The firm profile fields below are the Rule 40 content limit expressed as a
 * schema: name, qualifications, office hours, contact, and factual practice
 * information. There is deliberately no field for a fee range, a rating, a
 * tagline, an award, or anything else that would read as advertising — and if
 * someone adds one, this is the file where it has to be argued for.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md — "The Rule 40 content limit".
 * ─────────────────────────────────────────────────────────────────────────────
 */

const text = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? sanitizeString(v, max) : v),
    z.string().max(max)
  );

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? sanitizeString(v, max) : v),
    z.string().max(max).optional().or(z.literal(''))
  );

const SRI_LANKA_PHONE = /^(?:0|(?:\+94))(?:7[0-9]{8}|[1-9][0-9]{8})$/;

export const FirmRoleEnum = z.enum([
  'FIRM_OWNER',
  'FIRM_ADMIN',
  'ATTORNEY',
  'PARALEGAL',
]);

export const FirmTypeEnum = z.enum(['SOLE_PRACTITIONER', 'PARTNERSHIP']);

/** Editing the firm's own profile. */
export const UpdateFirmSchema = z.object({
  name: text(160).refine((v) => v.trim().length >= 2, {
    message: 'Enter the firm name.',
  }),
  firmType: FirmTypeEnum,
  registrationNumber: optionalText(60),
  establishedYear: z
    .number()
    .int()
    .min(1800, 'Enter a four-digit year.')
    .max(new Date().getFullYear(), 'That year is in the future.')
    .nullable()
    .optional(),

  // Factual practice information. Neutral, client-relevant, and the basis on
  // which a client makes their own choice.
  description: optionalText(1200),
  practiceAreas: z
    .array(z.enum(PRACTICE_AREAS as unknown as [string, ...string[]]))
    .max(12, 'You may list up to 12 practice areas.')
    .default([]),
  languages: z
    .array(z.enum(LANGUAGES as unknown as [string, ...string[]]))
    .default([]),
  courts: z.array(text(80)).max(20).default([]),
  district: z
    .enum(DISTRICTS as unknown as [string, ...string[]])
    .optional()
    .or(z.literal('')),

  // Contact and office hours — both expressly permitted by Rule 40.
  contactEmail: z
    .string()
    .email('Enter a valid email address.')
    .optional()
    .or(z.literal('')),
  contactPhone: z
    .string()
    .regex(SRI_LANKA_PHONE, 'Enter a valid Sri Lankan phone number.')
    .optional()
    .or(z.literal('')),
  websiteUrl: z
    .string()
    .url('Enter a full URL, including https://')
    .optional()
    .or(z.literal('')),
  officeHours: optionalText(200),
  logoUrl: optionalText(500),
});

export type UpdateFirmValues = z.infer<typeof UpdateFirmSchema>;

/**
 * The firm's own client account.
 *
 * Recorded only so a quote can be pre-filled with the firm's bank details. The
 * platform never holds, routes, or verifies money into this account — the client
 * pays the firm directly. See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
 */
export const UpdateFirmBankDetailsSchema = z.object({
  bankName: optionalText(120),
  accountName: optionalText(160),
  accountNumber: optionalText(40),
  bankBranch: optionalText(120),
});

export const FirmOfficeSchema = z.object({
  label: text(120).refine((v) => v.trim().length >= 2, {
    message: 'Give this office a name, e.g. "Colombo (head office)".',
  }),
  address: text(400).refine((v) => v.trim().length >= 5, {
    message: 'Enter the office address.',
  }),
  district: z
    .enum(DISTRICTS as unknown as [string, ...string[]])
    .optional()
    .or(z.literal('')),
  contactPhone: z
    .string()
    .regex(SRI_LANKA_PHONE, 'Enter a valid Sri Lankan phone number.')
    .optional()
    .or(z.literal('')),
  isPrimary: z.boolean().default(false),
});

/** Adding an existing platform user to the firm. */
export const AddFirmMemberSchema = z.object({
  email: z.string().email('Enter the person\'s email address.'),
  role: FirmRoleEnum,
  title: optionalText(80),
});

export const UpdateFirmMemberSchema = z.object({
  memberId: z.string().uuid(),
  role: FirmRoleEnum.optional(),
  title: optionalText(80),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
});

/** Reassigning a matter to another attorney at the same firm. */
export const AssignMatterSchema = z.object({
  attorneyProfileId: z.string().uuid('Choose an attorney.'),
  note: optionalText(500),
});

/** Platform-side verification of a firm. */
export const VerifyFirmSchema = z.object({
  firmId: z.string().uuid(),
  decision: z.enum(['VERIFIED', 'REJECTED', 'PENDING']),
  notes: optionalText(1000),
});
