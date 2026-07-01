import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { AdPlacement } from '@prisma/client';

// GET /api/ads/availability?placement=HOMEPAGE_BELOW_HERO&month=2026-07
// Returns booked counts per date, fully blocked dates, and configuration details
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placement = searchParams.get('placement');
    const monthStr = searchParams.get('month'); // e.g. "2026-07"

    if (!placement || !monthStr) {
      return NextResponse.json({ error: 'Placement and month are required.' }, { status: 400 });
    }

    // Get config for slot limits
    const config = await prisma.adPlacementConfig.findUnique({
      where: { placement: placement as AdPlacement },
    });

    if (!config) {
      return NextResponse.json({ error: 'Placement configuration not found.' }, { status: 404 });
    }

    if (!config.isActive) {
      return NextResponse.json({ error: 'This placement is currently inactive.', isInactive: true });
    }

    // Parse month start and end dates
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Get bookings in this date range
    const bookings = await prisma.adSlotBooking.findMany({
      where: {
        placement: placement as AdPlacement,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        campaignId: true,
      },
    });

    // Group bookings by date string (YYYY-MM-DD)
    const bookingsByDate: Record<string, string[]> = {};
    bookings.forEach((b) => {
      const dateKey = b.date.toISOString().slice(0, 10);
      if (!bookingsByDate[dateKey]) {
        bookingsByDate[dateKey] = [];
      }
      bookingsByDate[dateKey].push(b.campaignId);
    });

    // Determine which dates are fully blocked
    const blockedDates: string[] = [];
    const bookingDetails: Record<string, { bookedCount: number; maxSlots: number; isBlocked: boolean }> = {};

    // Generate all dates in the month to provide a complete status mapping
    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      const dateKey = tempDate.toISOString().slice(0, 10);
      const bookedCount = bookingsByDate[dateKey]?.length || 0;
      const isBlocked = bookedCount >= config.maxAdsPerSlot;

      if (isBlocked) {
        blockedDates.push(dateKey);
      }

      bookingDetails[dateKey] = {
        bookedCount,
        maxSlots: config.maxAdsPerSlot,
        isBlocked,
      };

      tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    }

    return NextResponse.json({
      placement,
      pricePerDay: config.pricePerDay,
      maxAdsPerSlot: config.maxAdsPerSlot,
      isSlider: config.isSlider,
      sliderInterval: config.sliderInterval,
      allowedAdTypes: config.allowedAdTypes,
      recommendedWidth: config.recommendedWidth,
      recommendedHeight: config.recommendedHeight,
      blockedDates,
      bookingDetails,
    });
  } catch (error) {
    console.error('[ADS_AVAILABILITY_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch availability.' }, { status: 500 });
  }
}
