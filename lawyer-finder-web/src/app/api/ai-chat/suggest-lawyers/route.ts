import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * POST /api/ai-chat/suggest-lawyers
 *
 * Returns verified attorneys whose practice areas match the user's question.
 *
 * Neutrality rules — see docs/restructure/LEGAL-GUARDRAILS.md (rules 3 and 4):
 *  - Results are NOT ordered or filtered by subscription tier, spend, or rating.
 *    The platform must never steer a client toward a lawyer based on what that
 *    lawyer pays us.
 *  - Subscription tier is not returned at all, so no client-side code can
 *    reintroduce it as a ranking signal.
 *  - Matching is on practice area and, where given, district — criteria relevant
 *    to the client rather than to us.
 *  - Ordering is alphabetical: neutral, stable, and easy to disclose.
 *
 * This is a directory filter, not a referral. The client chooses.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { practiceAreas, district } = body;

    if (!practiceAreas || !Array.isArray(practiceAreas) || practiceAreas.length === 0) {
      return NextResponse.json([]);
    }

    const lawyers = await prisma.lawyerProfile.findMany({
      where: {
        isVerified: true,
        OR: practiceAreas.map((area: string) => ({
          practiceAreas: { has: area },
        })),
        ...(typeof district === 'string' && district ? { district } : {}),
      },
      select: {
        id: true,
        fullName: true,
        profileImageUrl: true,
        practiceAreas: true,
        district: true,
        languages: true,
        yearsOfExperience: true,
      },
      orderBy: { fullName: 'asc' },
      take: 5,
    });

    return NextResponse.json(lawyers);
  } catch (error) {
    console.error('[SUGGEST_LAWYERS_ERROR]', error);
    return NextResponse.json([], { status: 200 });
  }
}
