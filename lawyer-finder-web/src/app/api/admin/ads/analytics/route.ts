import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/admin/ads/analytics — Platform-wide ad analytics
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const days = parseInt(searchParams.get('days') || '30');

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    if (campaignId) {
      // Single campaign analytics
      const analytics = await prisma.adAnalytics.findMany({
        where: {
          campaignId,
          date: { gte: fromDate },
        },
        orderBy: { date: 'asc' },
      });

      const campaign = await prisma.adCampaign.findUnique({
        where: { id: campaignId },
        include: { lawyer: { select: { fullName: true, baslNumber: true } } },
      });

      return NextResponse.json({ campaign, analytics });
    }

    // Platform-wide stats
    const [totals, topCampaigns, dailyTrend] = await Promise.all([
      // Overall totals
      prisma.adCampaign.aggregate({
        _sum: { impressions: true, clicks: true },
        _count: { id: true },
      }),

      // Top performing campaigns by clicks
      prisma.adCampaign.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { clicks: 'desc' },
        take: 10,
        include: { lawyer: { select: { fullName: true } } },
      }),

      // Daily trend (last N days)
      prisma.adAnalytics.groupBy({
        by: ['date'],
        _sum: { impressions: true, clicks: true },
        where: { date: { gte: fromDate } },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Revenue estimate (sum of pricePerDay * active days for active campaigns)
    const activeCampaigns = await prisma.adCampaign.findMany({
      where: { status: 'ACTIVE', pricePerDay: { not: null } },
    });

    let estimatedRevenue = 0;
    activeCampaigns.forEach((c) => {
      if (c.pricePerDay) {
        const activeDays = Math.ceil(
          (Date.now() - new Date(c.startDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        estimatedRevenue += c.pricePerDay * Math.max(1, activeDays);
      }
    });

    return NextResponse.json({
      totals: {
        totalCampaigns: totals._count.id,
        totalImpressions: totals._sum.impressions || 0,
        totalClicks: totals._sum.clicks || 0,
        avgCtr: (totals._sum.impressions || 0) > 0
          ? (((totals._sum.clicks || 0) / (totals._sum.impressions || 1)) * 100).toFixed(2)
          : '0.00',
        estimatedRevenue,
      },
      topCampaigns: topCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        lawyer: c.lawyer.fullName,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00',
      })),
      dailyTrend: dailyTrend.map((d) => ({
        date: d.date,
        impressions: d._sum.impressions || 0,
        clicks: d._sum.clicks || 0,
      })),
    });
  } catch (error) {
    console.error('[ADMIN_ADS_ANALYTICS]', error);
    return NextResponse.json({ error: 'Failed to fetch analytics.' }, { status: 500 });
  }
}
