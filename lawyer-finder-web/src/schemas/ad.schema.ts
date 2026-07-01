import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

export const AD_TYPES = ['BANNER', 'SPONSORED_LISTING', 'FEATURED_PROFILE', 'IN_FEED', 'SIDEBAR'] as const;
export const AD_PLACEMENTS = [
  'HOMEPAGE_HERO',
  'HOMEPAGE_MID',
  'DIRECTORY_TOP',
  'DIRECTORY_INLINE',
  'BLOG_SIDEBAR',
  'BLOG_FEED',
  'BLOG_POST_BOTTOM',
] as const;

export type AdTypeValue = (typeof AD_TYPES)[number];
export type AdPlacementValue = (typeof AD_PLACEMENTS)[number];

export const AD_TYPE_PLACEMENTS: Record<AdTypeValue, readonly AdPlacementValue[]> = {
  BANNER: ['HOMEPAGE_HERO', 'HOMEPAGE_MID', 'BLOG_SIDEBAR', 'BLOG_FEED', 'BLOG_POST_BOTTOM'],
  SPONSORED_LISTING: ['DIRECTORY_TOP', 'DIRECTORY_INLINE'],
  FEATURED_PROFILE: ['DIRECTORY_TOP', 'DIRECTORY_INLINE', 'HOMEPAGE_MID'],
  IN_FEED: ['BLOG_FEED', 'BLOG_POST_BOTTOM'],
  SIDEBAR: ['BLOG_SIDEBAR', 'HOMEPAGE_MID'],
};

export const PLACEMENT_DETAILS: Record<AdPlacementValue, { description: string; dimensions: string }> = {
  HOMEPAGE_HERO: {
    description: 'Full-width hero banner at the top of the homepage',
    dimensions: '1200x400px',
  },
  HOMEPAGE_MID: {
    description: 'Mid-page banner or featured card on homepage',
    dimensions: '728x90px',
  },
  DIRECTORY_TOP: {
    description: 'Pinned at the top of lawyer search results',
    dimensions: 'Profile card',
  },
  DIRECTORY_INLINE: {
    description: 'Interspersed within lawyer search results',
    dimensions: 'Profile card',
  },
  BLOG_SIDEBAR: {
    description: 'Sidebar ad alongside blog posts',
    dimensions: '300x250px',
  },
  BLOG_FEED: {
    description: 'Inline ad within blog article list',
    dimensions: '728x90px',
  },
  BLOG_POST_BOTTOM: {
    description: 'Below a blog article',
    dimensions: '728x90px',
  },
};

export const IMAGE_REQUIRED_TYPES: readonly AdTypeValue[] = ['BANNER', 'SIDEBAR'];

export const AdTypeSchema = z.enum(AD_TYPES);
export const AdPlacementSchema = z.enum(AD_PLACEMENTS);
export const AdStatusSchema = z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED']);

const optionalText = z.string().trim().optional()
  .transform((val) => {
    const res = val === '' || val === null ? undefined : val;
    return res ? sanitizeString(res) : res;
  });
const optionalPositiveInt = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.coerce.number().int('Must be a whole number').positive('Must be greater than 0').optional()
);
const requiredPositiveInt = z.coerce.number().int('Must be a whole number').positive('Must be greater than 0');

export const AdCampaignBaseSchema = z.object({
  name: z.string().trim()
    .min(3, 'Campaign name must be at least 3 characters')
    .max(100, 'Campaign name must be 100 characters or fewer')
    .transform((val) => sanitizeString(val)),
  type: AdTypeSchema,
  placement: AdPlacementSchema,
  title: optionalText,
  description: optionalText,
  imageUrl: optionalText,
  targetUrl: optionalText,
  ctaText: z.string().trim().default('View Profile').transform((val) => sanitizeString(val)),
  targetDistricts: z.array(z.string()).default([]),
  targetPracticeAreas: z.array(z.string()).default([]),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  totalBudget: optionalPositiveInt,
  dailyBudget: optionalPositiveInt,
});

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getTodayDateInput() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export function calculateCampaignDays(startDate: string, endDate: string) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || end <= start) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function isPlacementCompatible(type: string, placement: string) {
  if (!isAdType(type) || !isAdPlacement(placement)) return false;
  return AD_TYPE_PLACEMENTS[type].includes(placement);
}

export function isImageRequiredType(type: string) {
  return isAdType(type) && IMAGE_REQUIRED_TYPES.includes(type);
}

export function getPlacementsForType(type: string) {
  return isAdType(type) ? AD_TYPE_PLACEMENTS[type] : AD_PLACEMENTS;
}

export function getComputedTotalBudget(pricePerDay: string | number | undefined, startDate: string, endDate: string) {
  const price = Number(pricePerDay || 0);
  const days = calculateCampaignDays(startDate, endDate);
  return price > 0 && days > 0 ? price * days : 0;
}

function isAdType(value: string): value is AdTypeValue {
  return AD_TYPES.includes(value as AdTypeValue);
}

function isAdPlacement(value: string): value is AdPlacementValue {
  return AD_PLACEMENTS.includes(value as AdPlacementValue);
}

function validateSharedCampaignRules(
  value: z.infer<typeof AdCampaignBaseSchema> & { pricePerDay?: number },
  ctx: z.RefinementCtx,
  options: { requireFutureStart: boolean; requireLawyerBudget: boolean }
) {
  if (!AD_TYPE_PLACEMENTS[value.type].includes(value.placement)) {
    ctx.addIssue({
      code: 'custom',
      path: ['placement'],
      message: 'Choose a placement compatible with this ad type',
    });
  }

  if (isImageRequiredType(value.type) && !value.imageUrl) {
    ctx.addIssue({
      code: 'custom',
      path: ['imageUrl'],
      message: 'A banner image is required for this ad type',
    });
  }

  if (value.type === 'BANNER' && !value.title) {
    ctx.addIssue({
      code: 'custom',
      path: ['title'],
      message: 'Banner ads need a headline',
    });
  }

  const start = parseDateOnly(value.startDate);
  const end = parseDateOnly(value.endDate);

  if (!start) {
    ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Enter a valid start date' });
  }

  if (!end) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Enter a valid end date' });
  }

  if (start && end) {
    if (end <= start) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be after start date' });
    }

    if (calculateCampaignDays(value.startDate, value.endDate) > 365) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Campaign duration cannot exceed 365 days' });
    }

    if (options.requireFutureStart && value.startDate < getTodayDateInput()) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Start date must be today or later' });
    }
  }

  if (options.requireLawyerBudget && (!value.totalBudget || value.totalBudget < 500)) {
    ctx.addIssue({ code: 'custom', path: ['totalBudget'], message: 'Budget must be at least LKR 500' });
  }
}

export const AdminCreateAdSchema = AdCampaignBaseSchema.extend({
  lawyerId: z.string().min(1, 'Lawyer is required'),
  pricePerDay: requiredPositiveInt,
  status: AdStatusSchema.default('DRAFT'),
}).superRefine((value, ctx) => {
  validateSharedCampaignRules(value, ctx, { requireFutureStart: false, requireLawyerBudget: false });
});

export const LawyerCreateAdBaseSchema = AdCampaignBaseSchema.omit({ dailyBudget: true }).extend({
  pricePerDay: optionalPositiveInt,
});

export const LawyerCreateAdSchema = LawyerCreateAdBaseSchema.superRefine((value, ctx) => {
  validateSharedCampaignRules(value, ctx, { requireFutureStart: true, requireLawyerBudget: true });
});

export type AdminCreateAdInput = z.infer<typeof AdminCreateAdSchema>;
export type LawyerCreateAdInput = z.infer<typeof LawyerCreateAdSchema>;

export type AdFieldErrors = Record<string, string>;

export function formatZodFieldErrors(error: z.ZodError): AdFieldErrors {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flattened)
      .filter(([, messages]) => messages && messages.length > 0)
      .map(([field, messages]) => [field, messages?.[0] || 'Invalid value'])
  );
}
