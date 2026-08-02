import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * Public attorney directory.
 *
 * Every field returned here is bound by the Rule 40 content limit: name,
 * qualifications, and factual practice information only. No fee indication, no
 * rating, no review count, no subscription signal, and no ordering derived from
 * anything an attorney pays us. Ordering is alphabetical and disclosed.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md — "The Rule 40 content limit".
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const district = searchParams.get('district');
    const practiceArea = searchParams.get('practiceArea');
    const language = searchParams.get('language');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { isVerified: true };

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
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
      ];
    }

    const lawyers = await prisma.lawyerProfile.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        profileImageUrl: true,
        // The attorney's own professional description. Retained because removing
        // it would gut the directory card, but it is the one field here that is
        // arguably beyond Rule 40's list — counsel question 16(b).
        bio: true,
        practiceAreas: true,
        languages: true,
        district: true,
        courts: true,
        yearsOfExperience: true,
        isNotary: true,
        isVerified: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json(lawyers, { status: 200 });
  } catch (error) {
    console.error('[LAWYERS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch lawyers.' }, { status: 500 });
  }
}
