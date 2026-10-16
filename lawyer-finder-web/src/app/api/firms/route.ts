import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { inDailyOrder, LISTED_FIRM_WHERE } from '@/lib/directory';
import { isPublicDirectoryEnabled } from '@/lib/directory';

/**
 * Public firm directory.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Every field returned here is bound by the Rule 40 content limit: firm name,
 * the principal's qualifications, office hours, contact details, and factual
 * practice information. There is no fee indication, no rating, no review count,
 * no subscription signal, and no ordering that anyone can buy.
 *
 * Ordering is the daily order (src/lib/directory.ts), disclosed on the page. Filtering is on
 * criteria the client supplies — district, practice area, language — never on
 * anything we decide about a firm.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md — "The Rule 40 content limit", and
 * counsel questions 16–18 on whether this surface may exist at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: Request) {
  // Withdrawn by an administrator — see src/lib/directory.ts.
  if (!(await isPublicDirectoryEnabled())) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const district = searchParams.get('district');
    const practiceArea = searchParams.get('practiceArea');
    const language = searchParams.get('language');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { ...LISTED_FIRM_WHERE };

    if (district) where.district = district;
    if (practiceArea) where.practiceAreas = { has: practiceArea };
    if (language) where.languages = { has: language };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const firms = await prisma.lawFirm.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        firmType: true,
        practiceAreas: true,
        languages: true,
        courts: true,
        district: true,
        officeHours: true,
        contactPhone: true,
        contactEmail: true,
        websiteUrl: true,
        logoUrl: true,
        establishedYear: true,
        _count: { select: { lawyers: true } },
      },
    });

    return NextResponse.json(
      inDailyOrder(firms).map((f) => ({
        ...f,
        attorneyCount: f._count.lawyers,
        _count: undefined,
      })),
      { status: 200 }
    );
  } catch (error) {
    console.error('[FIRMS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch firms.' }, { status: 500 });
  }
}
