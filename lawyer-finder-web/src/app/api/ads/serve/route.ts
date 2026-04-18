import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/ads/serve?placement=HOMEPAGE_HERO&district=Colombo&practiceArea=Criminal+Law
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

    const now = new Date();

    // Fetch active campaigns for the requested placement
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        placement: placement as any,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        lawyer: {
          select: {
            id: true,
            fullName: true,
            profileImageUrl: true,
            district: true,
            practiceAreas: true,
            baseFeeRange: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Filter by targeting (post-query for flexibility)
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

    // Return only what the client needs (no internal fields)
    const ads = filtered.map((c) => ({
      id: c.id,
      type: c.type,
      placement: c.placement,
      title: c.title,
      description: c.description,
      imageUrl: c.imageUrl,
      targetUrl: c.targetUrl || `/lawyers/${c.lawyer.id}`,
      ctaText: c.ctaText,
      lawyer: c.lawyer,
    }));

    return NextResponse.json({ ads });
  } catch (error) {
    console.error('[ADS_SERVE]', error);
    return NextResponse.json({ ads: [] });
  }
}
