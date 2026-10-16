import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { reviewReportSchema } from '@/schemas/community.schema';

// PATCH /api/reports/[id] — Admin: Review a report
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = reviewReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }

    // A decision stands: a report already upheld could later be dismissed,
    // quietly overturning the removal.
    if (report.status !== 'PENDING') {
      return NextResponse.json({ error: 'This report has already been decided.' }, { status: 409 });
    }

    await prisma.report.update({
      where: { id },
      data: {
        status: parsed.data.status,
        adminNotes: parsed.data.adminNotes || null,
      },
    });

    // If action taken, ensure the content is removed
    if (parsed.data.status === 'ACTION_TAKEN') {
      if (report.postId) {
        await prisma.post.update({
          where: { id: report.postId },
          data: { status: 'REMOVED', removedBy: 'MODERATOR' },
        });
      }
      if (report.commentId) {
        await prisma.comment.update({
          where: { id: report.commentId },
          data: { isDeleted: true, content: '[removed by moderator]' },
        });
      }
    }

    // If dismissed, restore a post only if reports hid it automatically — never
    // one its author or a moderator removed, and not while another report on it
    // was upheld or enough others are still waiting to keep it hidden. This used
    // to republish any REMOVED post, including one removed through another report.
    if (parsed.data.status === 'DISMISSED' && report.postId) {
      const post = await prisma.post.findUnique({ where: { id: report.postId } });
      if (post?.status === 'REMOVED' && post.removedBy === 'AUTO_REPORTS') {
        const [upheld, stillPending] = await Promise.all([
          prisma.report.count({ where: { postId: report.postId, status: 'ACTION_TAKEN' } }),
          prisma.report.count({ where: { postId: report.postId, status: 'PENDING' } }),
        ]);
        if (upheld === 0 && stillPending < 3) {
          await prisma.post.update({
            where: { id: report.postId },
            data: { status: 'PUBLISHED', removedBy: null },
          });
        }
      }
    }

    return NextResponse.json({ message: `Report ${parsed.data.status.toLowerCase().replace('_', ' ')}.` });
  } catch (error) {
    console.error('[REPORT_REVIEW]', error);
    return NextResponse.json({ error: 'Failed to review report.' }, { status: 500 });
  }
}
