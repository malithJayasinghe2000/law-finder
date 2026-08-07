import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AD_PLACEMENTS, AD_PLACEMENT_LABELS, PLACEMENT_DETAILS, type AdPlacementValue, type AdTypeValue } from '@/schemas/ad.schema';
import { z } from 'zod';

// Default configs for seeding
const DEFAULT_CONFIGS: Record<AdPlacementValue, {
  pricePerDay: number;
  isSlider: boolean;
  sliderInterval: number;
  maxAdsPerSlot: number;
  recommendedWidth: number | null;
  recommendedHeight: number | null;
  allowedAdTypes: AdTypeValue[];
}> = {
  HOMEPAGE_BELOW_HERO: {
    pricePerDay: 2000,
    isSlider: true,
    sliderInterval: 3000,
    maxAdsPerSlot: 3,
    recommendedWidth: 1200,
    recommendedHeight: 400,
    allowedAdTypes: ['BANNER_IMAGE', 'PROFILE_CARD'],
  },
  CHAT_RIGHT_SIDEBAR: {
    pricePerDay: 1500,
    isSlider: true,
    sliderInterval: 3000,
    maxAdsPerSlot: 3,
    recommendedWidth: 300,
    recommendedHeight: 250,
    allowedAdTypes: ['SIDEBAR_CARD'],
  },
  BLOG_TOP_BANNER: {
    pricePerDay: 1500,
    isSlider: true,
    sliderInterval: 3000,
    maxAdsPerSlot: 3,
    recommendedWidth: 728,
    recommendedHeight: 90,
    allowedAdTypes: ['BANNER_IMAGE'],
  },
  BLOG_RIGHT_SIDEBAR: {
    pricePerDay: 1200,
    isSlider: true,
    sliderInterval: 3000,
    maxAdsPerSlot: 5,
    recommendedWidth: 300,
    recommendedHeight: 250,
    allowedAdTypes: ['SIDEBAR_CARD'],
  },
  BLOG_BOTTOM_STICKY: {
    pricePerDay: 1000,
    isSlider: false,
    sliderInterval: 5000,
    maxAdsPerSlot: 1,
    recommendedWidth: 728,
    recommendedHeight: 90,
    allowedAdTypes: ['STICKY_BAR'],
  },
  BLOG_POST_SIDEBAR: {
    pricePerDay: 1000,
    isSlider: true,
    sliderInterval: 3000,
    maxAdsPerSlot: 3,
    recommendedWidth: 300,
    recommendedHeight: 250,
    allowedAdTypes: ['SIDEBAR_CARD'],
  },
  BLOG_POST_BOTTOM: {
    pricePerDay: 800,
    isSlider: false,
    sliderInterval: 3000,
    maxAdsPerSlot: 1,
    recommendedWidth: 728,
    recommendedHeight: 90,
    allowedAdTypes: ['BANNER_IMAGE'],
  },
  LEGAL_LIBRARY_SIDEBAR: {
    pricePerDay: 2500,
    isSlider: true,
    sliderInterval: 6000,
    maxAdsPerSlot: 1,
    recommendedWidth: 300,
    recommendedHeight: 250,
    allowedAdTypes: ['SIDEBAR_CARD'],
  },
};

// GET /api/admin/ad-config — Get all placement configs (seed defaults if empty)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let configs = await prisma.adPlacementConfig.findMany({
      orderBy: { placement: 'asc' },
    });

    // Seed defaults if no configs exist
    if (configs.length === 0) {
      const seedData = AD_PLACEMENTS.map((placement) => {
        const defaults = DEFAULT_CONFIGS[placement];
        return {
          placement,
          displayName: AD_PLACEMENT_LABELS[placement],
          description: PLACEMENT_DETAILS[placement].description,
          ...defaults,
        };
      });

      await prisma.adPlacementConfig.createMany({ data: seedData });
      configs = await prisma.adPlacementConfig.findMany({
        orderBy: { placement: 'asc' },
      });
    }

    return NextResponse.json({ configs });
  } catch (error: any) {
    console.error('[AD_CONFIG_GET]', error);
    return NextResponse.json({ error: error.message || String(error), stack: error.stack }, { status: 500 });
  }
}

// PUT /api/admin/ad-config — Update a placement config
const UpdateConfigSchema = z.object({
  placement: z.enum(AD_PLACEMENTS),
  pricePerDay: z.coerce.number().int().min(0).optional(),
  isSlider: z.boolean().optional(),
  sliderInterval: z.coerce.number().int().min(1000).max(30000).optional(),
  maxAdsPerSlot: z.coerce.number().int().min(1).max(20).optional(),
  recommendedWidth: z.coerce.number().int().min(0).optional().nullable(),
  recommendedHeight: z.coerce.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  allowedAdTypes: z.array(z.enum(['BANNER_IMAGE', 'PROFILE_CARD', 'SIDEBAR_CARD', 'STICKY_BAR'])).optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid config data.' },
        { status: 400 }
      );
    }

    const { placement, ...updateData } = parsed.data;

    const config = await prisma.adPlacementConfig.upsert({
      where: { placement },
      update: updateData,
      create: {
        placement,
        displayName: updateData.displayName || AD_PLACEMENT_LABELS[placement],
        description: updateData.description ?? PLACEMENT_DETAILS[placement].description,
        pricePerDay: updateData.pricePerDay ?? DEFAULT_CONFIGS[placement].pricePerDay,
        isSlider: updateData.isSlider ?? DEFAULT_CONFIGS[placement].isSlider,
        sliderInterval: updateData.sliderInterval ?? DEFAULT_CONFIGS[placement].sliderInterval,
        maxAdsPerSlot: updateData.maxAdsPerSlot ?? DEFAULT_CONFIGS[placement].maxAdsPerSlot,
        recommendedWidth: updateData.recommendedWidth ?? DEFAULT_CONFIGS[placement].recommendedWidth,
        recommendedHeight: updateData.recommendedHeight ?? DEFAULT_CONFIGS[placement].recommendedHeight,
        isActive: updateData.isActive ?? true,
        allowedAdTypes: updateData.allowedAdTypes ?? DEFAULT_CONFIGS[placement].allowedAdTypes,
      },
    });

    return NextResponse.json({ config, message: 'Config updated.' });
  } catch (error) {
    console.error('[AD_CONFIG_PUT]', error);
    return NextResponse.json({ error: 'Failed to update config.' }, { status: 500 });
  }
}
