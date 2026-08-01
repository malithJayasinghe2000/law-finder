import { NextResponse } from 'next/server';
import type { AdPlacement } from '@prisma/client';
import prisma from '@/lib/db';

// GET /api/ads/serve?placement=HOMEPAGE_BELOW_HERO&district=Colombo&practiceArea=Criminal+Law
// Public endpoint: serves active ads for a specific placement zone
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placement = searchParams.get('placement');
    const district = searchParams.get('district');
    const practiceArea = searchParams.get('practiceArea');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!placement) {
      return NextResponse.json({ error: 'Placement is required.' }, { status: 400 });
    }

    // Adjust to Sri Lankan timezone (GMT +5:30) to get matching local calendar date
    const now = new Date();
    const lkrOffset = 5.5 * 60 * 60 * 1000;
    const lkrNow = new Date(now.getTime() + lkrOffset);
    const lkrTodayMidnight = new Date(Date.UTC(lkrNow.getUTCFullYear(), lkrNow.getUTCMonth(), lkrNow.getUTCDate()));

    // Fetch active campaigns for the requested placement
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        placement: placement as AdPlacement,
        status: 'ACTIVE',
        startDate: { lte: lkrTodayMidnight },
        endDate: { gte: lkrTodayMidnight },
      },
      include: {
        lawyer: {
          select: {
            id: true,
            fullName: true,
            profileImageUrl: true,
            district: true,
            practiceAreas: true,
            // baseFeeRange removed: publishing an attorney's fee indication is
            // beyond the Rule 40 content limit, and doing it inside an ad unit is
            // the worst place for it.
            // See docs/restructure/LEGAL-GUARDRAILS.md (rule 3, Rule 40 limit).
            bio: true,
            user: {
              select: {
                profileImageUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Filter by targeting
    let filtered = campaigns;

    if (district) {
      filtered = filtered.filter(
        (c) => c.targetDistricts.length === 0 || c.targetDistricts.includes(district)
      );
    }

    if (practiceArea) {
      filtered = filtered.filter(
        (c) => c.targetPracticeAreas.length === 0 || c.targetPracticeAreas.includes(practiceArea)
      );
    }

    // Map properties for final view layer
    const ads = filtered.map((c) => {
      const { user, ...lawyer } = c.lawyer;

      return {
        id: c.id,
        type: c.type,
        placement: c.placement,
        title: c.title,
        description: c.description,
        imageUrl: c.imageUrl,
        targetUrl: c.targetUrl || `/lawyers/${c.lawyer.id}`,
        ctaText: c.ctaText,
        lawyer: {
          ...lawyer,
          profileImageUrl: lawyer.profileImageUrl || user.profileImageUrl,
        },
      };
    });

    return NextResponse.json({ ads });
  } catch (error) {
    console.error('[ADS_SERVE]', error);
    return NextResponse.json({ ads: [] });
  }
}
