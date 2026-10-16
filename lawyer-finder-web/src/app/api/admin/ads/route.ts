import { NextResponse } from 'next/server';
import type { AdPlacement, AdStatus, AdType, Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AdminCreateAdSchema, formatZodFieldErrors, getComputedTotalBudget, AdTypeSchema, AdPlacementSchema, AdStatusSchema } from '@/schemas/ad.schema';
import { isValidUUID, validatePaginationParams } from '@/lib/security';
import { canAdvertiserRunCampaigns, isPermittedPlacement } from '@/lib/ads/eligibility';
import { z } from 'zod';

// Admin Update Ad Schema
const AdminUpdateAdSchema = z.object({
  id: z.string().uuid('Invalid campaign ID'),
  name: z.string().trim().min(3).max(100).optional(),
  type: AdTypeSchema.optional(),
  placement: AdPlacementSchema.optional(),
  title: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  targetUrl: z.string().trim().max(500).optional().nullable(),
  ctaText: z.string().trim().max(50).optional(),
  targetDistricts: z.array(z.string().max(50)).max(25).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalBudget: z.coerce.number().int().positive().optional().nullable(),
  dailyBudget: z.coerce.number().int().positive().optional().nullable(),
  pricePerDay: z.coerce.number().int().positive().optional().nullable(),
  status: AdStatusSchema.optional(),
});

// Helper to validate slot availability and book dates
async function validateAndBookSlots(
  campaignId: string,
  placement: AdPlacement,
  startDate: Date,
  endDate: Date,
  config: { maxAdsPerSlot: number }
) {
  const dates: Date[] = [];
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  
  const tempDate = new Date(start);
  while (tempDate <= end) {
    dates.push(new Date(tempDate));
    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
  }

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

  await prisma.adSlotBooking.deleteMany({
    where: { campaignId },
  });

  const bookingsData = dates.map((date) => ({
    campaignId,
    placement,
    date,
  }));

  await prisma.adSlotBooking.createMany({
    data: bookingsData,
  });
}

// GET /api/admin/ads — List all campaigns with filters
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const placement = searchParams.get('placement');
    const { page, limit } = validatePaginationParams(
      searchParams.get('page'),
      searchParams.get('limit')
    );

    const where: Prisma.AdCampaignWhereInput = {};
    if (status) where.status = status as AdStatus;
    if (type) where.type = type as AdType;
    if (placement) where.placement = placement as AdPlacement;

    const [campaigns, total] = await Promise.all([
      prisma.adCampaign.findMany({
        where,
        include: {
          advertiser: {
            select: {
              id: true,
              name: true,
              category: true,
              status: true,
              nonLegalConfirmed: true,
              logoUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adCampaign.count({ where }),
    ]);

    const stats = await prisma.adCampaign.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statsMap: Record<string, number> = {};
    stats.forEach((s) => {
      statsMap[s.status] = s._count.id;
    });

    return NextResponse.json({
      campaigns,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total,
        active: statsMap['ACTIVE'] || 0,
        pending: statsMap['PENDING_REVIEW'] || 0,
        draft: statsMap['DRAFT'] || 0,
        paused: statsMap['PAUSED'] || 0,
        expired: statsMap['EXPIRED'] || 0,
        rejected: statsMap['REJECTED'] || 0,
      },
    });
  } catch (error) {
    console.error('[ADMIN_ADS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns.' }, { status: 500 });
  }
}

// POST /api/admin/ads — Create a campaign on behalf of a lawyer
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const json = await req.json();
    const parsed = AdminCreateAdSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please fix the highlighted fields.', fieldErrors: formatZodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    const {
      advertiserId,
      name,
      type,
      placement,
      title,
      description,
      imageUrl,
      targetUrl,
      ctaText,
      targetDistricts,
      startDate,
      endDate,
      pricePerDay,
      status,
    } = parsed.data;

    // The advertiser must exist AND have been confirmed non-legal by a named
    // ADMIN. That confirmation is the single thing standing between this and
    // guardrail rule 3, so it is checked here as well as at serve time.
    const advertiser = await prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: { id: true, status: true, isActive: true, nonLegalConfirmed: true },
    });

    if (!advertiser) {
      return NextResponse.json({ error: 'Advertiser not found.' }, { status: 404 });
    }

    const eligibility = canAdvertiserRunCampaigns(advertiser);
    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.reason }, { status: 400 });
    }

    if (!isPermittedPlacement(placement as AdPlacement)) {
      return NextResponse.json(
        { error: 'Advertising is not permitted on that surface.' },
        { status: 400 }
      );
    }

    const config = await prisma.adPlacementConfig.findUnique({
      where: { placement: placement as AdPlacement },
    });

    if (!config) {
      return NextResponse.json({ error: 'Placement configuration not found.' }, { status: 404 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const computedTotal = pricePerDay ? getComputedTotalBudget(pricePerDay, startDate, endDate) : getComputedTotalBudget(config.pricePerDay, startDate, endDate);

    const campaign = await prisma.adCampaign.create({
      data: {
        advertiserId,
        name,
        type: type as AdType,
        placement: placement as AdPlacement,
        title: title || null,
        description: description || null,
        imageUrl: imageUrl || null,
        targetUrl: targetUrl || null,
        ctaText: ctaText || 'Learn more',
        targetDistricts: targetDistricts || [],
        targetPracticeAreas: [],
        startDate: start,
        endDate: end,
        totalBudget: computedTotal,
        pricePerDay: pricePerDay || config.pricePerDay,
        status: status || 'DRAFT',
      },
    });

    // Book slots immediately if created in ACTIVE, APPROVED, or PENDING_REVIEW status
    if (['ACTIVE', 'APPROVED', 'PENDING_REVIEW'].includes(campaign.status)) {
      try {
        await validateAndBookSlots(campaign.id, placement as AdPlacement, start, end, config);
      } catch (bookingError: any) {
        await prisma.adCampaign.delete({ where: { id: campaign.id } });
        return NextResponse.json({ error: bookingError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ campaign, message: 'Campaign created successfully.' }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_ADS_POST]', error);
    return NextResponse.json({ error: 'Failed to create campaign.' }, { status: 500 });
  }
}

// PATCH /api/admin/ads — Update/approve/reject campaigns
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = AdminUpdateAdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid update data.' },
        { status: 400 }
      );
    }

    const { id, ...validatedData } = parsed.data;

    const existing = await prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.placement !== undefined) updateData.placement = validatedData.placement;
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.imageUrl !== undefined) updateData.imageUrl = validatedData.imageUrl;
    if (validatedData.targetUrl !== undefined) updateData.targetUrl = validatedData.targetUrl;
    if (validatedData.ctaText !== undefined) updateData.ctaText = validatedData.ctaText;
    if (validatedData.targetDistricts !== undefined) updateData.targetDistricts = validatedData.targetDistricts;
    
    let start = existing.startDate;
    let end = existing.endDate;
    let placement = existing.placement;

    if (validatedData.startDate) {
      start = new Date(validatedData.startDate);
      updateData.startDate = start;
    }
    if (validatedData.endDate) {
      end = new Date(validatedData.endDate);
      updateData.endDate = end;
    }
    if (validatedData.placement) {
      placement = validatedData.placement as AdPlacement;
      updateData.placement = placement;
    }

    // Auto-calculate budget if price details change
    if (validatedData.startDate || validatedData.endDate || validatedData.placement || validatedData.pricePerDay) {
      const activePlacement = placement;
      const rate = validatedData.pricePerDay !== undefined ? validatedData.pricePerDay : existing.pricePerDay;
      if (rate) {
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        updateData.pricePerDay = rate;
        updateData.totalBudget = rate * Math.max(1, days);
      }
    }

    if (validatedData.status) {
      updateData.status = validatedData.status;
      if (validatedData.status === 'PAUSED') updateData.pausedBy = 'ADMIN';
      
      if (validatedData.status === 'ACTIVE') {
        updateData.pausedBy = null;
        if (existing.invoiceId) {
          const linkedInvoice = await prisma.invoice.findUnique({
            where: { id: existing.invoiceId }
          });
          if (linkedInvoice && linkedInvoice.status !== 'PAID') {
            return NextResponse.json({ error: 'Cannot activate campaign. Linked invoice must be PAID.' }, { status: 400 });
          }
        }
      }

      // Ad invoicing was removed in Phase 4.
      //
      // It created an `Invoice` against the campaign owner's LawyerProfile,
      // which no longer exists — campaigns belong to non-legal advertisers now.
      // The `Invoice` model is keyed to a lawyer because it exists for firm
      // subscriptions; billing an advertiser is a different commercial
      // relationship and must not be forced through it.
      //
      // Until an advertiser billing module exists, a campaign records its
      // `pricePerDay` and `totalBudget` and the advertiser is invoiced outside
      // the platform.

      // Handle bookings cleanup for released statuses
      if (['DRAFT', 'REJECTED', 'EXPIRED'].includes(validatedData.status)) {
        await prisma.adSlotBooking.deleteMany({ where: { campaignId: id } });
      }
    }

    // Verify bookings when slots are modified or campaign is activated
    const finalStatus = validatedData.status || existing.status;
    if (
      !['DRAFT', 'REJECTED', 'EXPIRED'].includes(finalStatus) &&
      (validatedData.startDate || validatedData.endDate || validatedData.placement || validatedData.status === 'ACTIVE' || validatedData.status === 'APPROVED')
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
      data: updateData,
      include: {
        advertiser: { select: { name: true, category: true } },
      },
    });

    return NextResponse.json({ campaign, message: 'Campaign updated.' });
  } catch (error) {
    console.error('[ADMIN_ADS_PATCH]', error);
    return NextResponse.json({ error: 'Failed to update campaign.' }, { status: 500 });
  }
}

// DELETE /api/admin/ads?id=xyz — Delete campaign and bookings
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: 'A valid campaign ID is required.' }, { status: 400 });
    }

    await prisma.adSlotBooking.deleteMany({ where: { campaignId: id } });
    await prisma.adCampaign.delete({ where: { id } });
    return NextResponse.json({ message: 'Campaign deleted.' });
  } catch (error) {
    console.error('[ADMIN_ADS_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete campaign.' }, { status: 500 });
  }
}
