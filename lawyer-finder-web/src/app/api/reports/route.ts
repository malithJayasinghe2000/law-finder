import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { reportSchema } from '@/schemas/community.schema';

// POST /api/reports — Submit a report
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to report content.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Check for duplicate report
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: session.userId,
        postId: parsed.data.postId || undefined,
        commentId: parsed.data.commentId || undefined,
        status: 'PENDING',
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'You have already reported this content.' }, { status: 409 });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: session.userId,
        reason: parsed.data.reason,
        description: parsed.data.description || null,
        postId: parsed.data.postId || null,
        commentId: parsed.data.commentId || null,
      },
    });

    // Auto-hide content if it reaches 3+ pending reports
    if (parsed.data.postId) {
      const reportCount = await prisma.report.count({
        where: { postId: parsed.data.postId, status: 'PENDING' },
      });
      if (reportCount >= 3) {
        await prisma.post.update({
          where: { id: parsed.data.postId },
          data: { status: 'REMOVED', removedBy: 'AUTO_REPORTS' },
        });
      }
    }

    return NextResponse.json({ report, message: 'Report submitted. Thank you.' }, { status: 201 });
  } catch (error) {
    console.error('[REPORTS_POST]', error);
    return NextResponse.json({ error: 'Failed to submit report.' }, { status: 500 });
  }
}

import { validatePaginationParams } from '@/lib/security';

// GET /api/reports — Admin: List reports
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';
    
    // Clamp pagination parameters
    const { page, limit } = validatePaginationParams(
      searchParams.get('page'),
      searchParams.get('limit')
    );

    const where: Record<string, unknown> = {};
    if (status !== 'all') where.status = status;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, fullName: true } },
          post: { select: { id: true, title: true, slug: true, authorId: true } },
          comment: { select: { id: true, content: true, authorId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[REPORTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch reports.' }, { status: 500 });
  }
}
