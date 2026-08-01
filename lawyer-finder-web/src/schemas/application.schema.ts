import { z } from 'zod';
import { PRACTICE_AREAS, LANGUAGES, DISTRICTS } from '@/schemas/profile.schema';
import { sanitizeString } from '@/lib/sanitize';

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
    .transform((val) => val ? sanitizeString(val) : val),
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

export const applicationStep4Schema = z.object({
  licenseImage: z.string().min(1, 'Attorney license document upload is required.'),
  identityImage: z.string().min(1, 'Face identity verification is required.'),
});

// ── Full application schema (for final submission) ───────────────────────────

export const fullApplicationSchema = z.object({
  step1: applicationStep1Schema,
  step2: applicationStep2Schema,
  step3: applicationStep3Schema,
  step4: applicationStep4Schema,
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
