import { z } from 'zod';
import { sanitizeString } from '@/lib/security';

/**
 * Advertiser validation.
 *
 * Advertising is sold to non-legal organisations only. The schema cannot express
 * "not a law firm" — that judgement is a human one, recorded on
 * `Advertiser.nonLegalConfirmed` by a named ADMIN — so what this file does is
 * make sure enough is captured for that judgement to be possible: who they
 * legally are, what they trade in, and how to reach them.
 *
 * See src/lib/ads/eligibility.ts and
 * docs/restructure/LEGAL-GUARDRAILS.md (rule 3).
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

export const AdvertiserCategoryEnum = z.enum([
  'BANKING_FINANCE',
  'INSURANCE',
  'EDUCATION',
  'PUBLISHING_MEDIA',
  'TECHNOLOGY',
  'HEALTHCARE',
  'REAL_ESTATE',
  'GOVERNMENT_NGO',
  'RETAIL_CONSUMER',
  'PROFESSIONAL_SERVICES',
  'OTHER',
]);

export const ADVERTISER_CATEGORY_LABELS: Record<
  z.infer<typeof AdvertiserCategoryEnum>,
  string
> = {
  BANKING_FINANCE: 'Banking & finance',
  INSURANCE: 'Insurance',
  EDUCATION: 'Education',
  PUBLISHING_MEDIA: 'Publishing & media',
  TECHNOLOGY: 'Technology',
  HEALTHCARE: 'Healthcare',
  REAL_ESTATE: 'Real estate',
  GOVERNMENT_NGO: 'Government & NGO',
  RETAIL_CONSUMER: 'Retail & consumer',
  PROFESSIONAL_SERVICES: 'Professional services (non-legal)',
  OTHER: 'Other',
};

export const CreateAdvertiserSchema = z.object({
  name: text(160).refine((v) => v.trim().length >= 2, {
    message: 'Enter the advertiser name.',
  }),
  legalName: optionalText(200),
  registrationNumber: optionalText(60),
  category: AdvertiserCategoryEnum,
  contactName: optionalText(120),
  contactEmail: z.string().email('Enter a valid contact email address.'),
  contactPhone: optionalText(30),
  websiteUrl: z
    .string()
    .url('Enter a full URL, including https://')
    .optional()
    .or(z.literal('')),
  logoUrl: optionalText(500),
});

export const UpdateAdvertiserSchema = CreateAdvertiserSchema.partial().extend({
  advertiserId: z.string().uuid(),
  isActive: z.boolean().optional(),
});

/**
 * The review decision.
 *
 * `nonLegalConfirmed` cannot be set to true without a decision of ACTIVE, and
 * the reviewer must say what they checked. This is the gate that keeps an
 * attorney — or a legal consultancy calling itself something else — out of the
 * ad system, so it is deliberately harder to click through than a status change.
 */
export const ReviewAdvertiserSchema = z
  .object({
    advertiserId: z.string().uuid(),
    decision: z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING_REVIEW']),
    nonLegalConfirmed: z.boolean(),
    reviewNotes: optionalText(1000),
  })
  .refine((d) => !(d.decision === 'ACTIVE' && !d.nonLegalConfirmed), {
    message:
      'An advertiser cannot be approved until you have confirmed they do not practise law or sell legal services.',
    path: ['nonLegalConfirmed'],
  })
  .refine((d) => !(d.decision === 'REJECTED' && !d.reviewNotes), {
    message: 'Give a reason when refusing an advertiser.',
    path: ['reviewNotes'],
  });

export type CreateAdvertiserValues = z.infer<typeof CreateAdvertiserSchema>;
