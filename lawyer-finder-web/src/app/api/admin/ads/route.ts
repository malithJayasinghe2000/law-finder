import { NextResponse } from 'next/server';
import type { AdPlacement, AdStatus, AdType, Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AdminCreateAdSchema, formatZodFieldErrors, getComputedTotalBudget, AdTypeSchema, AdPlacementSchema, AdStatusSchema } from '@/schemas/ad.schema';
import { isValidUUID, validatePaginationParams } from '@/lib/security';
import { z } from 'zod';

// ── Admin Update Ad Schema ────────────────────────────────────────────────
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
  targetPracticeAreas: z.array(z.string().max(100)).max(12).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalBudget: z.coerce.number().int().positive().optional().nullable(),
  dailyBudget: z.coerce.number().int().positive().optional().nullable(),
  pricePerDay: z.coerce.number().int().positive().optional().nullable(),
  status: AdStatusSchema.optional(),
});

// GET /api/admin/ads — List all campaigns with optional filters
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
          lawyer: {
            select: {
              id: true,
              fullName: true,
              baslNumber: true,
              district: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adCampaign.count({ where }),
    ]);

    // Get aggregate stats
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
    console.error('[ADMIN_ADS_GET]', error instanceof Error ? error.message : 'Failed');
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

    const parsed = AdminCreateAdSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please fix the highlighted fields.', fieldErrors: formatZodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    const {
      lawyerId,
      name,
      type,
      placement,
      title,
      description,
      imageUrl,
      targetUrl,
      ctaText,
      targetDistricts,
      targetPracticeAreas,
      startDate,
      endDate,
      totalBudget,
      dailyBudget,
      pricePerDay,
      status,
    } = parsed.data;

    // Verify the lawyer exists
    const lawyer = await prisma.lawyerProfile.findUnique({ where: { id: lawyerId } });
    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer not found.' }, { status: 404 });
    }

    const campaign = await prisma.adCampaign.create({
      data: {
        lawyerId,
        name,
        type,
        placement,
        title: title || null,
        description: description || null,
        imageUrl: imageUrl || null,
        targetUrl: targetUrl || null,
        ctaText: ctaText || 'View Profile',
        targetDistricts: targetDistricts || [],
        targetPracticeAreas: targetPracticeAreas || [],
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalBudget: totalBudget || getComputedTotalBudget(pricePerDay, startDate, endDate),
        dailyBudget: dailyBudget || null,
        pricePerDay,
        status: status || 'DRAFT',
      },
      include: {
        lawyer: { select: { fullName: true, baslNumber: true } },
      },
    });

    return NextResponse.json({ campaign, message: 'Campaign created successfully.' }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_ADS_POST]', error instanceof Error ? error.message : 'Failed');
    return NextResponse.json({ error: 'Failed to create campaign.' }, { status: 500 });
  }
}

// PATCH /api/admin/ads — Update a campaign (approve, reject, pause, activate, edit)
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

    // Build safe update data from validated fields only
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
    if (validatedData.targetPracticeAreas !== undefined) updateData.targetPracticeAreas = validatedData.targetPracticeAreas;
    if (validatedData.startDate) updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate) updateData.endDate = new Date(validatedData.endDate);
    if (validatedData.totalBudget !== undefined) updateData.totalBudget = validatedData.totalBudget;
    if (validatedData.dailyBudget !== undefined) updateData.dailyBudget = validatedData.dailyBudget;
    if (validatedData.pricePerDay !== undefined) updateData.pricePerDay = validatedData.pricePerDay;
    if (validatedData.status) {
      updateData.status = validatedData.status;
      if (validatedData.status === 'PAUSED') updateData.pausedBy = 'ADMIN';
      if (validatedData.status === 'ACTIVE') updateData.pausedBy = null;
    }

    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: updateData,
      include: {
        lawyer: { select: { fullName: true, baslNumber: true } },
      },
    });

    return NextResponse.json({ campaign, message: 'Campaign updated.' });
  } catch (error) {
    console.error('[ADMIN_ADS_PATCH]', error instanceof Error ? error.message : 'Failed');
    return NextResponse.json({ error: 'Failed to update campaign.' }, { status: 500 });
  }
}

// DELETE /api/admin/ads?id=xyz — Delete a campaign
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

    await prisma.adCampaign.delete({ where: { id } });
    return NextResponse.json({ message: 'Campaign deleted.' });
  } catch (error) {
    console.error('[ADMIN_ADS_DELETE]', error instanceof Error ? error.message : 'Failed');
    return NextResponse.json({ error: 'Failed to delete campaign.' }, { status: 500 });
  }
}


