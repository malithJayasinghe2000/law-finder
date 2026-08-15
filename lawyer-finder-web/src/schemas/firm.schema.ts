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

  // Tax identity, printed on the fee notes the firm issues to its own clients.
  // The firm supplies the legal service, so the firm is the taxable person; we
  // are not in that transaction and take no share of the fee.
  taxIdentificationNumber: optionalText(40),
  vatNumber: optionalText(40),
  isVatRegistered: z.boolean().optional().default(false),
  vatRatePercent: z
    .number()
    .int('Enter a whole percentage.')
    .min(0, 'A VAT rate cannot be negative.')
    .max(100, 'Enter the rate as a percentage, e.g. 18.')
    .nullable()
    .optional(),
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

// ─────────────────────────────────────────────────────────────────────────────
// Registering a practice, and inviting people into it
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registering a real firm.
 *
 * The founder must already be a verified Attorney-at-Law, because in Sri Lanka
 * a law firm is a group of attorneys practising together — there is no lawful
 * form in which a non-attorney founds a legal practice. That is enforced in the
 * route, not here, because it is a fact about the caller rather than the input.
 *
 * See docs/restructure/HOW-IT-WORKS.md Part 1.
 */
export const RegisterFirmSchema = z.object({
  name: text(160).refine((v) => v.trim().length >= 2, {
    message: 'Enter the name of the practice.',
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

  contactEmail: z.string().email('Enter a valid email address.').optional().or(z.literal('')),
  contactPhone: z
    .string()
    .regex(SRI_LANKA_PHONE, 'Enter a valid Sri Lankan phone number.')
    .optional()
    .or(z.literal('')),
  websiteUrl: z.string().url('Enter a full URL, including https://').optional().or(z.literal('')),
  officeHours: optionalText(200),

  /** The head office. A practice has a place of business. */
  office: z.object({
    label: text(120).default('Head office'),
    address: text(400).refine((v) => v.trim().length >= 5, {
      message: 'Enter the address of the practice.',
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
  }),

  /**
   * The people to invite. Nobody is added directly — see `FirmInvitation` in
   * schema.prisma for why joining a practice has to be something a person
   * agrees to rather than something done to them.
   */
  invitations: z
    .array(
      z.object({
        email: z.string().email('Enter a valid email address.'),
        role: FirmRoleEnum,
        title: optionalText(80),
      })
    )
    .max(50, 'Invite up to 50 people at a time.')
    .default([]),

  /**
   * The founder confirming what they are registering.
   *
   * Not a dark-pattern checkbox: registering a practice tells clients that a
   * firm exists at an address with named attorneys in it, and the person
   * asserting that has to be doing so knowingly.
   */
  declarationAccepted: z.literal(true, {
    message: 'Confirm the declaration before registering the practice.',
  }),
});

export type RegisterFirmValues = z.infer<typeof RegisterFirmSchema>;

/** Inviting someone into an existing firm. */
export const CreateFirmInvitationSchema = z.object({
  email: z.string().email("Enter the person's email address."),
  role: FirmRoleEnum,
  title: optionalText(80),
});

export const RespondToFirmInvitationSchema = z.object({
  token: z.string().min(16, 'That invitation link is not valid.'),
  action: z.enum(['accept', 'decline']),
});

export const RevokeFirmInvitationSchema = z.object({
  invitationId: z.string().uuid(),
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
