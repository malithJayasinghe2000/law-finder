import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/ads/track — Record impression or click
// Body: { campaignId: string, event: 'impression' | 'click' }
export async function POST(req: Request) {
  try {
    const { campaignId, event } = await req.json();

    if (!campaignId || !['impression', 'click'].includes(event)) {
      return NextResponse.json({ error: 'Invalid tracking data.' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert daily analytics row
    await prisma.adAnalytics.upsert({
      where: {
        campaignId_date: { campaignId, date: today },
      },
      update: {
        [event === 'impression' ? 'impressions' : 'clicks']: { increment: 1 },
      },
      create: {
        campaignId,
        date: today,
        impressions: event === 'impression' ? 1 : 0,
        clicks: event === 'click' ? 1 : 0,
      },
    });

    // Also update the denormalized counters on the campaign itself for fast reads
    await prisma.adCampaign.update({
      where: { id: campaignId },
      data: {
        [event === 'impression' ? 'impressions' : 'clicks']: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Tracking should never break the user experience — fail silently
    console.error('[ADS_TRACK]', error);
    return NextResponse.json({ success: false });
  }
}
