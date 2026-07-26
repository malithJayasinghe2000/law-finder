import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { LawyerCreateAdSchema, LawyerCreateAdBaseSchema, formatZodFieldErrors, AdStatusSchema } from '@/schemas/ad.schema';
import { isValidUUID } from '@/lib/security';
import type { AdPlacement, AdType } from '@prisma/client';

const LawyerUpdateAdSchema = LawyerCreateAdBaseSchema.extend({
  status: AdStatusSchema.optional(),
}).partial();

// Helper to validate slot availability and book dates
async function validateAndBookSlots(
  campaignId: string,
  placement: AdPlacement,
  startDate: Date,
  endDate: Date,
  config: { maxAdsPerSlot: number }
) {
  // Generate all dates between startDate and endDate in UTC
  const dates: Date[] = [];
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  
  const tempDate = new Date(start);
  while (tempDate <= end) {
    dates.push(new Date(tempDate));
    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
  }

  // Check bookings for each date (excluding this campaign's own bookings)
  for (const date of dates) {
    const bookedCount = await prisma.adSlotBooking.count({
      where: {
        placement,
        date,
        campaignId: { not: campaignId },
      },
    });

    if (bookedCount >= config.maxAdsPerSlot) {
      const dateStr = date.toISOString().slice(0, 10);
      throw new Error(`The placement is fully booked on ${dateStr}. Please select different dates.`);
    }
  }

  // Clear existing bookings for this campaign
  await prisma.adSlotBooking.deleteMany({
    where: { campaignId },
  });

  // Create new bookings
  const bookingsData = dates.map((date) => ({
    campaignId,
    placement,
    date,
  }));

  await prisma.adSlotBooking.createMany({
    data: bookingsData,
  });
}

// GET /api/lawyer/ads — Get lawyer's own campaigns
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Lawyer profile not found.' }, { status: 404 });
    }

    const campaigns = await prisma.adCampaign.findMany({
      where: { lawyerId: profile.id },
      include: {
        analytics: {
          orderBy: { date: 'desc' },
          take: 30, // Last 30 days
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE').length;

    return NextResponse.json({
      campaigns,
      stats: {
        total: campaigns.length,
        active: activeCampaigns,
        totalImpressions,
        totalClicks,
        avgCtr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00',
      },
    });
  } catch (error) {
    console.error('[LAWYER_ADS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns.' }, { status: 500 });
  }
}

// POST /api/lawyer/ads — Lawyer creates a new campaign (goes to PENDING_REVIEW)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Lawyer profile not found.' }, { status: 404 });
    }

    const json = await req.json();
    const parsed = LawyerCreateAdSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please fix the highlighted fields.', fieldErrors: formatZodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    const {
      name, type, placement, title, description, imageUrl,
      targetUrl, ctaText, targetDistricts, targetPracticeAreas,
      startDate, endDate,
    } = parsed.data;

    // Get config for slot limit & price
    const config = await prisma.adPlacementConfig.findUnique({
      where: { placement: placement as AdPlacement },
    });

    if (!config) {
      return NextResponse.json({ error: 'Placement configuration not found.' }, { status: 404 });
    }

    if (!config.isActive) {
      return NextResponse.json({ error: 'This placement is currently disabled.' }, { status: 400 });
    }

    // Auto-calculate budget from dates and config
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const computedTotal = config.pricePerDay * Math.max(1, days);

    // Create the campaign in PENDING_REVIEW
    const campaign = await prisma.adCampaign.create({
      data: {
        lawyerId: profile.id,
        name,
        type: type as AdType,
        placement: placement as AdPlacement,
        status: 'PENDING_REVIEW',
        title: title || null,
        description: description || null,
        imageUrl: imageUrl || null,
        targetUrl: targetUrl || null,
        ctaText: ctaText || 'View Profile',
        targetDistricts: targetDistricts || [],
        targetPracticeAreas: targetPracticeAreas || [],
        startDate: start,
        endDate: end,
        totalBudget: computedTotal,
        pricePerDay: config.pricePerDay,
      },
    });

    // Check slot availability and book dates
    try {
      await validateAndBookSlots(campaign.id, placement as AdPlacement, start, end, config);
    } catch (bookingError: any) {
      // Rollback campaign creation if bookings conflict
      await prisma.adCampaign.delete({ where: { id: campaign.id } });
      return NextResponse.json({ error: bookingError.message }, { status: 400 });
    }

    return NextResponse.json({ campaign, message: 'Campaign submitted for review!' }, { status: 201 });
  } catch (error) {
    console.error('[LAWYER_ADS_POST]', error);
    return NextResponse.json({ error: 'Failed to create campaign.' }, { status: 500 });
  }
}

// PATCH /api/lawyer/ads — Lawyer pauses/resumes their campaign or updates a draft
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Lawyer profile not found.' }, { status: 404 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== 'string' || !isValidUUID(id)) {
      return NextResponse.json({ error: 'A valid campaign ID is required.' }, { status: 400 });
    }

    const updateData = { ...body };
    delete updateData.id;
    delete updateData.pausedBy;

    const parsed = LawyerUpdateAdSchema.safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please fix the validation errors.', fieldErrors: formatZodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    const validatedData = parsed.data;

    // Verify ownership
    const existing = await prisma.adCampaign.findFirst({
      where: { id, lawyerId: profile.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    }

    const dbUpdateData: Record<string, any> = {};
    const whitelistFields = [
      'name', 'type', 'placement', 'title', 'description', 'imageUrl',
      'targetUrl', 'ctaText', 'targetDistricts', 'targetPracticeAreas',
      'status'
    ];

    for (const key of whitelistFields) {
      if (validatedData[key as keyof typeof validatedData] !== undefined) {
        dbUpdateData[key] = validatedData[key as keyof typeof validatedData];
      }
    }

    let start = existing.startDate;
    let end = existing.endDate;
    let placement = existing.placement;

    if (validatedData.startDate) {
      start = new Date(validatedData.startDate);
      dbUpdateData.startDate = start;
    }
    if (validatedData.endDate) {
      end = new Date(validatedData.endDate);
      dbUpdateData.endDate = end;
    }
    if (validatedData.placement) {
      placement = validatedData.placement as AdPlacement;
      dbUpdateData.placement = placement;
    }

    // Auto-calculate budget if dates/placement changes
    if (validatedData.startDate || validatedData.endDate || validatedData.placement) {
      const config = await prisma.adPlacementConfig.findUnique({
        where: { placement },
      });
      if (config) {
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        dbUpdateData.pricePerDay = config.pricePerDay;
        dbUpdateData.totalBudget = config.pricePerDay * Math.max(1, days);
      }
    }

    // Lawyers can only pause active campaigns or edit drafts/rejected
    if (validatedData.status) {
      const allowed: Record<string, string[]> = {
        ACTIVE: ['PAUSED'],
        PAUSED: ['ACTIVE'],
        DRAFT: ['PENDING_REVIEW'],
        REJECTED: ['PENDING_REVIEW'],
      };

      const validTransitions = allowed[existing.status] || [];
      if (!validTransitions.includes(validatedData.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${validatedData.status}.` },
          { status: 400 }
        );
      }

      if (existing.status === 'PAUSED' && validatedData.status === 'ACTIVE' && existing.pausedBy !== 'LAWYER') {
        return NextResponse.json(
          { error: 'This campaign was paused by an admin and can only be resumed by an admin.' },
          { status: 403 }
        );
      }

      if (existing.status === 'ACTIVE' && validatedData.status === 'PAUSED') {
        dbUpdateData.pausedBy = 'LAWYER';
      }

      if (existing.status === 'PAUSED' && validatedData.status === 'ACTIVE') {
        dbUpdateData.pausedBy = null;
      }

      // If status transitions to DRAFT or REJECTED, release bookings
      if (['DRAFT', 'REJECTED'].includes(validatedData.status)) {
        await prisma.adSlotBooking.deleteMany({ where: { campaignId: id } });
      }
    }

    // If active dates/placement changes, validate and update bookings
    if (
      (validatedData.startDate || validatedData.endDate || validatedData.placement) &&
      !['DRAFT', 'REJECTED'].includes(validatedData.status || existing.status)
    ) {
      const config = await prisma.adPlacementConfig.findUnique({
        where: { placement },
      });
      if (config) {
        try {
          await validateAndBookSlots(id, placement, start, end, config);
        } catch (bookingError: any) {
          return NextResponse.json({ error: bookingError.message }, { status: 400 });
        }
      }
    }

    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: dbUpdateData,
    });

    return NextResponse.json({ campaign, message: 'Campaign updated.' });
  } catch (error) {
    console.error('[LAWYER_ADS_PATCH]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to update campaign.' }, { status: 500 });
  }
}
