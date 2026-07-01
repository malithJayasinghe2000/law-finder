import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/ads/config — Public endpoint for placement configs (used by ad components and lawyer form)
// Returns only active placement configs
export async function GET() {
  try {
    const configs = await prisma.adPlacementConfig.findMany({
      where: { isActive: true },
      select: {
        placement: true,
        displayName: true,
        description: true,
        pricePerDay: true,
        isSlider: true,
        sliderInterval: true,
        maxAdsPerSlot: true,
        recommendedWidth: true,
        recommendedHeight: true,
        isActive: true,
        allowedAdTypes: true,
      },
      orderBy: { placement: 'asc' },
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('[ADS_CONFIG_PUBLIC]', error);
    return NextResponse.json({ configs: [] });
  }
}
