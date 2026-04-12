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
          data: { status: 'REMOVED' },
        });
      }
      if (report.commentId) {
        await prisma.comment.update({
          where: { id: report.commentId },
          data: { isDeleted: true, content: '[removed by moderator]' },
        });
      }
    }

    // If dismissed, restore content if it was auto-hidden
    if (parsed.data.status === 'DISMISSED') {
      if (report.postId) {
        const post = await prisma.post.findUnique({ where: { id: report.postId } });
        if (post?.status === 'REMOVED') {
          await prisma.post.update({
            where: { id: report.postId },
            data: { status: 'PUBLISHED' },
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
