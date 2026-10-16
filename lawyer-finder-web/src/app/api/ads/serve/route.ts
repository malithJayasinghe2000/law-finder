import { NextResponse } from 'next/server';
import type { AdPlacement } from '@prisma/client';
import prisma from '@/lib/db';
import { isPermittedPlacement } from '@/lib/ads/eligibility';

/**
 * Serve adverts for a placement.
 *
 * GET /api/ads/serve?placement=BLOG_TOP_BANNER&district=Colombo
 *
 * Everything served here belongs to a non-legal `Advertiser`. Until Phase 4 this
 * endpoint served attorneys who had bought promotion — including beside the AI
 * chat, where a person describes their legal problem — which is selling
 * visibility to a lawyer (guardrail rule 3).
 *
 * Three protections, all of which have to hold:
 *
 *  1. The campaign belongs to an Advertiser. There is no relation from
 *     AdCampaign to LawyerProfile any more, so an attorney cannot be served.
 *  2. The advertiser must be ACTIVE with `nonLegalConfirmed` — a named ADMIN has
 *     confirmed they neither practise law nor sell legal services.
 *  3. The placement must be an editorial surface. Directory and profile pages
 *     cannot be sold at any price.
 *
 * Targeting uses the PAGE the advert appears on, never anything about the
 * person reading it. Nothing derived from a client's account of their legal
 * problem may ever reach this endpoint — that is privileged material, and using
 * it to sell adverts would breach rule 5 and the PDPA at once.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 3 and 5), and
 * src/lib/ads/eligibility.ts.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placement = searchParams.get('placement');
    const district = searchParams.get('district');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!placement) {
      return NextResponse.json({ error: 'Placement is required.' }, { status: 400 });
    }

    // Fails closed: an unknown or forbidden placement serves nothing rather than
    // falling through to a default.
    if (!isPermittedPlacement(placement as AdPlacement)) {
      return NextResponse.json({ ads: [] });
    }

    // Adjust to Sri Lankan timezone (GMT +5:30) to get matching local calendar date
    const now = new Date();
    const lkrOffset = 5.5 * 60 * 60 * 1000;
    const lkrNow = new Date(now.getTime() + lkrOffset);
    const lkrTodayMidnight = new Date(Date.UTC(lkrNow.getUTCFullYear(), lkrNow.getUTCMonth(), lkrNow.getUTCDate()));

    const campaigns = await prisma.adCampaign.findMany({
      where: {
        placement: placement as AdPlacement,
        status: 'ACTIVE',
        startDate: { lte: lkrTodayMidnight },
        endDate: { gte: lkrTodayMidnight },
        // Enforced in the query, not after it — an advertiser who has not been
        // confirmed non-legal is never even loaded.
        advertiser: {
          isActive: true,
          status: 'ACTIVE',
          nonLegalConfirmed: true,
        },
      },
      select: {
        id: true,
        type: true,
        placement: true,
        title: true,
        description: true,
        imageUrl: true,
        targetUrl: true,
        ctaText: true,
        targetDistricts: true,
        advertiser: {
          select: {
            id: true,
            name: true,
            category: true,
            logoUrl: true,
            websiteUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Page-level targeting by district only. There is no practice-area
    // targeting: an advert targets the page, never a legal subject, and
    // nothing here may be derived from a client's matter.
    let filtered = campaigns;

    if (district) {
      filtered = filtered.filter(
        (c) => c.targetDistricts.length === 0 || c.targetDistricts.includes(district)
      );
    }

    const ads = filtered.map((c) => ({
      id: c.id,
      type: c.type,
      placement: c.placement,
      title: c.title || c.advertiser.name,
      description: c.description,
      imageUrl: c.imageUrl || c.advertiser.logoUrl,
      // Always an outbound link to the advertiser's own site. There is no
      // internal fallback, because the only internal thing an advert could point
      // at is an attorney.
      targetUrl: c.targetUrl || c.advertiser.websiteUrl || null,
      ctaText: c.ctaText,
      advertiser: {
        name: c.advertiser.name,
        category: c.advertiser.category,
        logoUrl: c.advertiser.logoUrl,
      },
    }));

    // An advert with nowhere to go is not shown.
    return NextResponse.json({ ads: ads.filter((a) => !!a.targetUrl) });
  } catch (error) {
    console.error('[ADS_SERVE]', error);
    return NextResponse.json({ ads: [] });
  }
}
