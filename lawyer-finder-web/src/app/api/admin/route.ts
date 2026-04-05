import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Admin privileges locked.' }, { status: 403 });
    }

    const [
      pendingApplications,
      pendingReviews,
      totalVerified,
      totalInquiries,
      totalArticles,
    ] = await Promise.all([
      prisma.lawyerApplication.findMany({
        where: { status: 'SUBMITTED' },
        orderBy: { submittedAt: 'desc' },
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

    // Safety-first parse of raw PostgreSQL JSON payload logic.
    const mappedApplications = pendingApplications.map(app => {
      const data = app.draftData as any;
      return {
        id: app.id,
        fullName: data?.step1?.fullName || 'No Name Provided',
        baslNumber: data?.step2?.baslNumber || 'MISSING',
        user: app.user,
        draftData: data
      };
    });

    return NextResponse.json({
      pendingLawyers: mappedApplications,
      pendingReviews,
      stats: {
        totalVerified,
        pendingApprovals: pendingApplications.length,
        totalInquiries,
        totalArticles,
        pendingReviewCount: pendingReviews.length,
      },
    }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server architecture mismatch.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, id } = body as { action: string; id: string };

    if (!action || !id) {
      return NextResponse.json({ error: 'Payload configuration violation.' }, { status: 400 });
    }

    if (action === 'approve-review') {
      await prisma.review.update({
        where: { id },
        data: { isApproved: true },
      });
      return NextResponse.json({ success: true, message: 'Review successfully approved.' });
    }

    if (action === 'reject-review') {
      await prisma.review.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Review successfully deleted.' });
    }

    return NextResponse.json({ error: 'Illegal macro execution.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
