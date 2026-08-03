import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  CreateAdvertiserSchema,
  UpdateAdvertiserSchema,
  ReviewAdvertiserSchema,
} from '@/schemas/advertiser.schema';
import { screenAdvertiserText } from '@/lib/ads/eligibility';

/**
 * Advertiser administration.
 *
 * Advertising on this platform is sold to non-legal organisations only. An
 * attorney may not advertise, and if we sell them visibility we become the
 * mechanism of their breach — and, under the Intermeddlers with Suitors
 * Ordinance No. 11 of 1894, an intermediary who touts commits an offence.
 *
 * The load-bearing step here is the review: a named ADMIN confirms that this
 * organisation neither practises law nor sells legal services, and that
 * confirmation is stored with their id and the date against it. No campaign can
 * run without it — checked here, in the campaign create route, and again at
 * serve time.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 3) and
 * src/lib/ads/eligibility.ts.
 */

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return {
      error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }),
    };
  }
  return { session };
}

/** GET: list advertisers, filterable by review status. */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [advertisers, total] = await Promise.all([
      prisma.advertiser.findMany({
        where,
        select: {
          id: true,
          name: true,
          legalName: true,
          registrationNumber: true,
          category: true,
          status: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          websiteUrl: true,
          logoUrl: true,
          nonLegalConfirmed: true,
          nonLegalConfirmedAt: true,
          reviewNotes: true,
          isActive: true,
          createdAt: true,
          _count: { select: { campaigns: true } },
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.advertiser.count({ where }),
    ]);

    return NextResponse.json({
      advertisers: advertisers.map((a) => ({
        ...a,
        campaignCount: a._count.campaigns,
        _count: undefined,
        createdAt: a.createdAt.toISOString(),
        nonLegalConfirmedAt: a.nonLegalConfirmedAt?.toISOString() ?? null,
        // Surfaced so the reviewer sees what a plain text screen picked up in
        // the advertiser's own words. An aid to their judgement, not a
        // replacement for it.
        flaggedTerms: screenAdvertiserText(a.name, a.legalName, a.websiteUrl),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[ADMIN_ADVERTISERS_GET]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/** POST: register a new advertiser. Always starts in PENDING_REVIEW. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const validated = CreateAdvertiserSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const d = validated.data;

    const advertiser = await prisma.advertiser.create({
      data: {
        name: d.name,
        legalName: d.legalName || null,
        registrationNumber: d.registrationNumber || null,
        category: d.category,
        contactName: d.contactName || null,
        contactEmail: d.contactEmail,
        contactPhone: d.contactPhone || null,
        websiteUrl: d.websiteUrl || null,
        logoUrl: d.logoUrl || null,
        // Never created pre-approved. Someone has to look.
        status: 'PENDING_REVIEW',
        nonLegalConfirmed: false,
      },
      select: { id: true, name: true, status: true },
    });

    return NextResponse.json({ success: true, advertiser }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_ADVERTISERS_POST]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/** PATCH: edit details, or record a review decision. */
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();

    // --- Review decision ---
    if (body?.action === 'review') {
      const validated = ReviewAdvertiserSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
      }

      const { advertiserId, decision, nonLegalConfirmed, reviewNotes } = validated.data;

      await prisma.advertiser.update({
        where: { id: advertiserId },
        data: {
          status: decision,
          nonLegalConfirmed,
          nonLegalConfirmedAt: nonLegalConfirmed ? new Date() : null,
          nonLegalConfirmedById: nonLegalConfirmed ? auth.session.userId : null,
          reviewNotes: reviewNotes || null,
        },
      });

      // Withdrawing the confirmation stops the adverts, rather than leaving
      // live campaigns running against an advertiser we no longer vouch for.
      if (!nonLegalConfirmed || decision !== 'ACTIVE') {
        await prisma.adCampaign.updateMany({
          where: { advertiserId, status: 'ACTIVE' },
          data: { status: 'PAUSED', pausedBy: 'ADMIN' },
        });
      }

      return NextResponse.json({ success: true });
    }

    // --- Edit details ---
    const validated = UpdateAdvertiserSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { advertiserId, ...d } = validated.data;

    // Changing who an advertiser says it is invalidates the check of who it is.
    const identityChanged =
      d.name !== undefined || d.legalName !== undefined || d.category !== undefined;

    await prisma.advertiser.update({
      where: { id: advertiserId },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.legalName !== undefined ? { legalName: d.legalName || null } : {}),
        ...(d.registrationNumber !== undefined
          ? { registrationNumber: d.registrationNumber || null }
          : {}),
        ...(d.category !== undefined ? { category: d.category } : {}),
        ...(d.contactName !== undefined ? { contactName: d.contactName || null } : {}),
        ...(d.contactEmail !== undefined ? { contactEmail: d.contactEmail } : {}),
        ...(d.contactPhone !== undefined ? { contactPhone: d.contactPhone || null } : {}),
        ...(d.websiteUrl !== undefined ? { websiteUrl: d.websiteUrl || null } : {}),
        ...(d.logoUrl !== undefined ? { logoUrl: d.logoUrl || null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(identityChanged
          ? {
              status: 'PENDING_REVIEW' as const,
              nonLegalConfirmed: false,
              nonLegalConfirmedAt: null,
              reviewNotes:
                'Re-review required: the advertiser changed its name, legal name or category.',
            }
          : {}),
      },
    });

    if (identityChanged) {
      await prisma.adCampaign.updateMany({
        where: { advertiserId, status: 'ACTIVE' },
        data: { status: 'PAUSED', pausedBy: 'ADMIN' },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN_ADVERTISERS_PATCH]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
