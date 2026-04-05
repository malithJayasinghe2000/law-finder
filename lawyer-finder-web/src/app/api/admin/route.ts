import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const [
      pendingApplications,
      pendingReviews,
      totalVerified,
      totalInquiries,
      totalArticles,
      totalUsers,
      totalLawyers,
      totalClients,
      allUsers,
      allProfiles,
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
      prisma.user.count(),
      prisma.user.count({ where: { role: 'LAWYER' } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.user.findMany({
        select: { createdAt: true, role: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.lawyerProfile.findMany({
        select: { id: true, user: { select: { createdAt: true } } },
        orderBy: { user: { createdAt: 'asc' } },
      }),
    ]);

    // Build monthly stats for the last 12 months
    const now = new Date();
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      const lawyersCount = allProfiles.filter(p => {
        const d = new Date(p.user.createdAt);
        return d >= date && d <= monthEnd;
      }).length;

      const clientsCount = allUsers.filter(u => {
        const d = new Date(u.createdAt);
        return u.role === 'CLIENT' && d >= date && d <= monthEnd;
      }).length;

      monthlyData.push({ month: monthLabel, lawyers: lawyersCount, clients: clientsCount });
    }

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
        totalUsers,
        totalLawyers,
        totalClients,
      },
      monthlyData,
    }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    if (action === 'approve-review') {
      await prisma.review.update({
        where: { id },
        data: { isApproved: true },
      });
      return NextResponse.json({ success: true, message: 'Review approved.' });
    }

    if (action === 'reject-review') {
      await prisma.review.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Review deleted.' });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
