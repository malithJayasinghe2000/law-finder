import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET: Admin fetches all pending lawyers, pending reviews, and stats
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const [
      pendingLawyers,
      pendingReviews,
      totalVerified,
      totalInquiries,
      totalArticles,
    ] = await Promise.all([
      prisma.lawyerProfile.findMany({
        where: { isVerified: false },
        orderBy: { user: { createdAt: 'desc' } },
        include: { user: { select: { email: true, createdAt: true } } },
      }),
      prisma.review.findMany({
        where: { isApproved: false },
        include: { lawyer: { select: { fullName: true } } },
      }),
      prisma.lawyerProfile.count({ where: { isVerified: true } }),
      prisma.inquiry.count(),
      prisma.article.count({ where: { status: 'PUBLISHED' } }),
    ]);

    return NextResponse.json({
      pendingLawyers,
      pendingReviews,
      stats: {
        totalVerified,
        pendingApprovals: pendingLawyers.length,
        totalInquiries,
        totalArticles,
        pendingReviewCount: pendingReviews.length,
      },
    }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// PATCH: Admin action - verify lawyer or approve review
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, id } = body as { action: string; id: string };

    if (!action || !id) {
      return NextResponse.json({ error: 'Action and ID are required.' }, { status: 400 });
    }

    if (action === 'verify-lawyer') {
      await prisma.lawyerProfile.update({
        where: { id },
        data: { isVerified: true },
      });
      return NextResponse.json({ success: true, message: 'Lawyer verified.' });
    }

    if (action === 'approve-review') {
      await prisma.review.update({
        where: { id },
        data: { isApproved: true },
      });
      return NextResponse.json({ success: true, message: 'Review approved.' });
    }

    if (action === 'reject-lawyer') {
      await prisma.lawyerProfile.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Lawyer rejected and removed.' });
    }

    if (action === 'reject-review') {
      await prisma.review.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Review rejected and removed.' });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
