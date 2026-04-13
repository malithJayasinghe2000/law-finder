import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/ai-chat/suggest-lawyers — find subscribed lawyers matching practice areas
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { practiceAreas, district } = body;

    if (!practiceAreas || !Array.isArray(practiceAreas) || practiceAreas.length === 0) {
      return NextResponse.json([]);
    }

    // Find lawyers with ACTIVE subscriptions matching any of the practice areas
    const lawyers = await prisma.lawyerProfile.findMany({
      where: {
        isVerified: true,
        // Only lawyers with at least one ACTIVE subscription
        Subscription: {
          some: {
            status: 'ACTIVE',
          },
        },
        // Match any of the detected practice areas
        OR: practiceAreas.map((area: string) => ({
          practiceAreas: {
            has: area,
          },
        })),
      },
      include: {
        reviews: {
          where: { isApproved: true },
          select: { rating: true },
        },
        Subscription: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          take: 1,
        },
      },
      take: 5,
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
        practiceAreas: lawyer.practiceAreas,
        district: lawyer.district,
        averageRating: Math.round(avgRating * 10) / 10,
        reviewCount: lawyer.reviews.length,
        subscriptionTier: lawyer.Subscription[0]?.plan?.name || null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[SUGGEST_LAWYERS_ERROR]', error);
    return NextResponse.json([], { status: 200 });
  }
}
