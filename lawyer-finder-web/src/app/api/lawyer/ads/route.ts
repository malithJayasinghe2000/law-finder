import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { LawyerCreateAdSchema, formatZodFieldErrors } from '@/schemas/ad.schema';

// GET /api/lawyer/ads — Get lawyer's own campaigns
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the lawyer profile for this user
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

    // Calculate summary stats
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

    const parsed = LawyerCreateAdSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please fix the highlighted fields.', fieldErrors: formatZodFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    const {
      name, type, placement, title, description, imageUrl,
      targetUrl, ctaText, targetDistricts, targetPracticeAreas,
      startDate, endDate, totalBudget,
    } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const campaign = await prisma.adCampaign.create({
      data: {
        lawyerId: profile.id,
        name,
        type,
        placement,
        status: 'PENDING_REVIEW', // Lawyers always submit for review
        title: title || null,
        description: description || null,
        imageUrl: imageUrl || null,
        targetUrl: targetUrl || null,
        ctaText: ctaText || 'View Profile',
        targetDistricts: targetDistricts || [],
        targetPracticeAreas: targetPracticeAreas || [],
        startDate: start,
        endDate: end,
        totalBudget,
        pricePerDay: null,
      },
    });

    return NextResponse.json({ campaign, message: 'Campaign submitted for review!' }, { status: 201 });
  } catch (error) {
    console.error('[LAWYER_ADS_POST]', error);
    return NextResponse.json({ error: 'Failed to create campaign.' }, { status: 500 });
  }
}

// PATCH /api/lawyer/ads — Lawyer can pause their own active campaign or edit a draft
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
    const { id, ...updateData } = body;
    delete updateData.pausedBy;

    if (!id) {
      return NextResponse.json({ error: 'Campaign ID is required.' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.adCampaign.findFirst({
      where: { id, lawyerId: profile.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    }

    // Lawyers can only pause active campaigns or edit drafts/rejected
    if (updateData.status) {
      const allowed: Record<string, string[]> = {
        ACTIVE: ['PAUSED'],
        PAUSED: ['ACTIVE'],
        DRAFT: ['PENDING_REVIEW'],
        REJECTED: ['PENDING_REVIEW'],
      };

      const validTransitions = allowed[existing.status] || [];
      if (!validTransitions.includes(updateData.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${updateData.status}.` },
          { status: 400 }
        );
      }

      if (existing.status === 'PAUSED' && updateData.status === 'ACTIVE' && existing.pausedBy !== 'LAWYER') {
        return NextResponse.json(
          { error: 'This campaign was paused by an admin and can only be resumed by an admin.' },
          { status: 403 }
        );
      }

      if (existing.status === 'ACTIVE' && updateData.status === 'PAUSED') {
        updateData.pausedBy = 'LAWYER';
      }

      if (existing.status === 'PAUSED' && updateData.status === 'ACTIVE') {
        updateData.pausedBy = null;
      }
    }

    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ campaign, message: 'Campaign updated.' });
  } catch (error) {
    console.error('[LAWYER_ADS_PATCH]', error);
    return NextResponse.json({ error: 'Failed to update campaign.' }, { status: 500 });
  }
}
