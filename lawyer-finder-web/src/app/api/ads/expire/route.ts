import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/ads/expire — Auto-expire campaigns past their end date
// This can be triggered by a cron job (e.g., Vercel Cron) or manually by admin
export async function POST(req: Request) {
  try {
    // Optional: Add a secret token check for cron security
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    // Simple token-based auth for cron (set CRON_SECRET in .env)
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Adjust to Sri Lankan timezone (GMT +5:30) to get matching local calendar date
    const now = new Date();
    const lkrOffset = 5.5 * 60 * 60 * 1000;
    const lkrNow = new Date(now.getTime() + lkrOffset);
    const lkrTodayMidnight = new Date(Date.UTC(lkrNow.getUTCFullYear(), lkrNow.getUTCMonth(), lkrNow.getUTCDate()));

    // Find all active/approved campaigns that have passed their end date
    const expiredCampaigns = await prisma.adCampaign.updateMany({
      where: {
        status: { in: ['ACTIVE', 'APPROVED'] },
        endDate: { lt: lkrTodayMidnight }, // Expire only when the day has completely passed
      },
      data: {
        status: 'EXPIRED',
      },
    });

    // Also auto-activate approved campaigns whose start date has arrived
    const activatedCampaigns = await prisma.adCampaign.updateMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: lkrTodayMidnight },
        endDate: { gte: lkrTodayMidnight }, // Ensure it activates even on the final day
      },
      data: {
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      message: 'Campaign lifecycle check complete.',
      expired: expiredCampaigns.count,
      activated: activatedCampaigns.count,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[ADS_EXPIRE]', error);
    return NextResponse.json({ error: 'Failed to process campaign lifecycle.' }, { status: 500 });
  }
}
