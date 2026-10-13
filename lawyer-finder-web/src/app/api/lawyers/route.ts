import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { inDailyOrder } from '@/lib/directory';
import { isPublicDirectoryEnabled, LISTED_ATTORNEY_WHERE } from '@/lib/directory';

/**
 * Public attorney directory.
 *
 * Every field returned here is bound by the Rule 40 content limit: name,
 * qualifications, and factual practice information only. No fee indication, no
 * rating, no review count, no subscription signal, and no ordering derived from
 * anything an attorney pays us. Ordering is the daily order (src/lib/directory.ts) and is disclosed.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md — "The Rule 40 content limit".
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

    const where: Record<string, unknown> = { ...LISTED_ATTORNEY_WHERE };

    if (district) {
      where.district = district;
    }
    if (practiceArea) {
      where.practiceAreas = { has: practiceArea };
    }
    if (language) {
      where.languages = { has: language };
    }
    if (search) {
      where.fullName = { contains: search, mode: 'insensitive' };
    }

    const lawyers = await prisma.lawyerProfile.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        profileImageUrl: true,
        // No bio: attorneys' own text is self-promotion ("Expert in…") and
        // Rule 49 bars publishing particulars of one's practice. It stays on the
        // attorney's own page only. See src/components/lawyer/LawyerCard.tsx.
        practiceAreas: true,
        languages: true,
        district: true,
        courts: true,
        yearsOfExperience: true,
        isNotary: true,
        isVerified: true,
        firm: { select: { name: true, slug: true, firmType: true } },
      },
    });

    return NextResponse.json(inDailyOrder(lawyers), { status: 200 });
  } catch (error) {
    console.error('[LAWYERS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch lawyers.' }, { status: 500 });
  }
}
