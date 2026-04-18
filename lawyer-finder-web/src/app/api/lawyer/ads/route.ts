import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/lawyer/ads — Get lawyer's own campaigns
export async function GET(req: Request) {
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

    const body = await req.json();
    const {
      name, type, placement, title, description, imageUrl,
      targetUrl, ctaText, targetDistricts, targetPracticeAreas,
      startDate, endDate, totalBudget, pricePerDay,
    } = body;

    if (!name || !type || !placement || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Name, type, placement, start date, and end date are required.' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return NextResponse.json({ error: 'End date must be after start date.' }, { status: 400 });
    }

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
        totalBudget: totalBudget ? parseInt(totalBudget) : null,
        pricePerDay: pricePerDay ? parseInt(pricePerDay) : null,
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
