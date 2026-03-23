import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

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
      include: {
        reviews: { where: { isApproved: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const result = lawyers.map((lawyer) => {
      const avgRating =
        lawyer.reviews.length > 0
          ? lawyer.reviews.reduce((sum, r) => sum + r.rating, 0) / lawyer.reviews.length
          : 0;
      return {
        id: lawyer.id,
        fullName: lawyer.fullName,
        profileImageUrl: lawyer.profileImageUrl,
        bio: lawyer.bio,
        practiceAreas: lawyer.practiceAreas,
        languages: lawyer.languages,
        district: lawyer.district,
        baseFeeRange: lawyer.baseFeeRange,
        isVerified: lawyer.isVerified,
        reviewCount: lawyer.reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[LAWYERS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch lawyers.' }, { status: 500 });
  }
}
