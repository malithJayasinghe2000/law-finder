import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

// ─── Ad Types ─────────────────────────────────────────────────────
// PROFILE_CARD ("Lawyer profile card showing photo, name, and practice areas")
// is still a value of the AdType database enum, but the app no longer offers or
// accepts it: an advert shaped like a profile is the anti-pattern Phase 4
// removed, and it had no placement left (2026-10-16).
export const AD_TYPES = ['BANNER_IMAGE', 'SIDEBAR_CARD', 'STICKY_BAR'] as const;
export type AdTypeValue = (typeof AD_TYPES)[number];

export const AD_TYPE_LABELS: Record<AdTypeValue, string> = {
  BANNER_IMAGE: 'Banner Image',
  SIDEBAR_CARD: 'Sidebar Card',
  STICKY_BAR: 'Sticky Bar',
};

export const AD_TYPE_DESCRIPTIONS: Record<AdTypeValue, string> = {
  BANNER_IMAGE: 'Full-width image banner with overlay text. Best for hero areas and top banners.',
  SIDEBAR_CARD: 'Compact card for sidebar areas with image and brief info.',
  STICKY_BAR: 'Thin horizontal bar that stays visible as users scroll.',
};

// ─── Ad Placements ────────────────────────────────────────────────
export const AD_PLACEMENTS = [
  'HOMEPAGE_BELOW_HERO',
  'CHAT_RIGHT_SIDEBAR',
  'BLOG_TOP_BANNER',
  'BLOG_RIGHT_SIDEBAR',
  'BLOG_BOTTOM_STICKY',
  'BLOG_POST_SIDEBAR',
  'BLOG_POST_BOTTOM',
  'LEGAL_LIBRARY_SIDEBAR',
  // DIRECTORY_TOP and DIRECTORY_INLINE were removed in Phase 4 along with
  // attorney advertising. Advertising belongs on editorial surfaces; an advert
  // inside a list of practitioners blurs a paid placement into a listing.
  // See docs/restructure/LEGAL-GUARDRAILS.md (rules 3 and 4).
] as const;
export type AdPlacementValue = (typeof AD_PLACEMENTS)[number];

export const AD_PLACEMENT_LABELS: Record<AdPlacementValue, string> = {
  HOMEPAGE_BELOW_HERO: 'Homepage — Below Hero Section',
  CHAT_RIGHT_SIDEBAR: 'AI Chat — Right Sidebar',
  BLOG_TOP_BANNER: 'Blog — Top Banner',
  BLOG_RIGHT_SIDEBAR: 'Blog — Right Sidebar (Sticky)',
  BLOG_BOTTOM_STICKY: 'Blog — Bottom Sticky Bar',
  BLOG_POST_SIDEBAR: 'Blog Post — Right Sidebar',
  BLOG_POST_BOTTOM: 'Blog Post — Below Article',
  LEGAL_LIBRARY_SIDEBAR: 'Legal Library — Right Sidebar',
};

export const PLACEMENT_DETAILS: Record<AdPlacementValue, {
  description: string;
  dimensions: string;
  page: string;
  position: string;
}> = {
  HOMEPAGE_BELOW_HERO: {
    description: 'Slider banner below the hero, above "The Legal Advisory Is" section',
    dimensions: '1200×400px',
    page: 'Homepage',
    position: 'Below hero section',
  },
  CHAT_RIGHT_SIDEBAR: {
    description: 'Right sidebar ads alongside the AI chat interface',
    dimensions: '300×250px',
    page: '/en/chat',
    position: 'Right sidebar',
  },
  BLOG_TOP_BANNER: {
    description: 'Slider banner above category cards on the blog listing page',
    dimensions: '728×90px',
    page: '/en/blog',
    position: 'Above categories',
  },
  BLOG_RIGHT_SIDEBAR: {
    description: 'Sticky sidebar ads that stay visible while scrolling blog posts',
    dimensions: '300×250px',
    page: '/en/blog',
    position: 'Right sidebar (sticky)',
  },
  BLOG_BOTTOM_STICKY: {
    description: 'Fixed bar at the bottom of the blog page, stays visible while scrolling',
    dimensions: '728×90px',
    page: '/en/blog',
    position: 'Bottom fixed bar',
  },
  BLOG_POST_SIDEBAR: {
    description: 'Sidebar ads alongside individual blog post content',
    dimensions: '300×250px',
    page: '/en/blog/[slug]',
    position: 'Right sidebar',
  },
  BLOG_POST_BOTTOM: {
    description: 'Banner below the blog article content',
    dimensions: '728×90px',
    page: '/en/blog/[slug]',
    position: 'Below article',
  },
  LEGAL_LIBRARY_SIDEBAR: {
    description: 'Sidebar of the legal library',
    dimensions: '300×250px',
    page: '/en/legal-library',
    position: 'Right sidebar',
  },
};

// ─── Type → Placement compatibility ──────────────────────────────
export const AD_TYPE_PLACEMENTS: Record<AdTypeValue, readonly AdPlacementValue[]> = {
  BANNER_IMAGE: [
    'HOMEPAGE_BELOW_HERO',
    'BLOG_TOP_BANNER',
    'BLOG_POST_BOTTOM',
  ],
  SIDEBAR_CARD: [
    'CHAT_RIGHT_SIDEBAR',
    'BLOG_RIGHT_SIDEBAR',
    'BLOG_POST_SIDEBAR',
  ],
  STICKY_BAR: [
    'BLOG_BOTTOM_STICKY',
  ],
};

export const IMAGE_REQUIRED_TYPES: readonly AdTypeValue[] = ['BANNER_IMAGE'];

// ─── Placement preview wireframe info ─────────────────────────────
export const PLACEMENT_PREVIEW: Record<AdPlacementValue, {
  previewLabel: string;
  previewColor: string;  // Tailwind color for the highlighted zone
  skeletonLayout: 'full-width' | 'sidebar' | 'sticky-bottom' | 'card-grid';
}> = {
  HOMEPAGE_BELOW_HERO: {
    previewLabel: 'Your ad appears here — below the hero, above "The Legal Advisory Is" section',
    previewColor: 'bg-blue-100 border-blue-400',
    skeletonLayout: 'full-width',
  },
  CHAT_RIGHT_SIDEBAR: {
    previewLabel: 'Your ad appears in the right sidebar of the AI Chat page',
    previewColor: 'bg-purple-100 border-purple-400',
    skeletonLayout: 'sidebar',
  },
  BLOG_TOP_BANNER: {
    previewLabel: 'Your ad appears above blog category cards',
    previewColor: 'bg-emerald-100 border-emerald-400',
    skeletonLayout: 'full-width',
  },
  BLOG_RIGHT_SIDEBAR: {
    previewLabel: 'Your ad stays visible in the blog sidebar as users scroll',
    previewColor: 'bg-amber-100 border-amber-400',
    skeletonLayout: 'sidebar',
  },
  BLOG_BOTTOM_STICKY: {
    previewLabel: 'Your ad is pinned at the bottom of the blog page',
    previewColor: 'bg-rose-100 border-rose-400',
    skeletonLayout: 'sticky-bottom',
  },
  BLOG_POST_SIDEBAR: {
    previewLabel: 'Your ad appears alongside blog post content',
    previewColor: 'bg-indigo-100 border-indigo-400',
    skeletonLayout: 'sidebar',
  },
  BLOG_POST_BOTTOM: {
    previewLabel: 'Your ad appears below the blog article',
    previewColor: 'bg-teal-100 border-teal-400',
    skeletonLayout: 'full-width',
  },
  LEGAL_LIBRARY_SIDEBAR: {
    previewLabel: 'Your advert appears in the legal library sidebar',
    previewColor: 'bg-orange-100 border-orange-400',
    skeletonLayout: 'sidebar',
  },
};

// ─── Zod Schemas ──────────────────────────────────────────────────
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

export function formatAdLabel(str: string) {
  // Convert enum-style strings like HOMEPAGE_BELOW_HERO to a readable label
  const labels: Record<string, string> = {
    ...AD_TYPE_LABELS,
    ...AD_PLACEMENT_LABELS,
  };
  return labels[str] || str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function validateSharedCampaignRules(
  value: z.infer<typeof AdCampaignBaseSchema> & { pricePerDay?: number },
  ctx: z.RefinementCtx,
  options: { requireFutureStart: boolean }
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

  if (value.type === 'BANNER_IMAGE' && !value.title) {
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
}

// ─── Admin schema — full control ──────────────────────────────────
export const AdminCreateAdSchema = AdCampaignBaseSchema.extend({
  // An advertiser, never a lawyer. See src/lib/ads/eligibility.ts.
  advertiserId: z.string().min(1, 'Choose an advertiser'),
  pricePerDay: requiredPositiveInt,
  totalBudget: optionalPositiveInt,
  dailyBudget: optionalPositiveInt,
  status: AdStatusSchema.default('DRAFT'),
}).superRefine((value, ctx) => {
  validateSharedCampaignRules(value, ctx, { requireFutureStart: false });
});

// The lawyer-facing campaign schema was removed in Phase 4 with the rest of
// attorney advertising. There is no lawyer path into the ad system any more.
// See docs/restructure/LEGAL-GUARDRAILS.md (rule 3).

export type AdminCreateAdInput = z.infer<typeof AdminCreateAdSchema>;

export type AdFieldErrors = Record<string, string>;

export function formatZodFieldErrors(error: z.ZodError): AdFieldErrors {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flattened)
      .filter(([, messages]) => messages && messages.length > 0)
      .map(([field, messages]) => [field, messages?.[0] || 'Invalid value'])
  );
}

// ─── Placement config type for client-side use ────────────────────
export interface PlacementConfigClient {
  placement: AdPlacementValue;
  displayName: string;
  description: string | null;
  pricePerDay: number;
  isSlider: boolean;
  sliderInterval: number;
  maxAdsPerSlot: number;
  recommendedWidth: number | null;
  recommendedHeight: number | null;
  isActive: boolean;
  allowedAdTypes: AdTypeValue[];
}
