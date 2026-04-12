import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { moderatePostSchema } from '@/schemas/community.schema';

// GET /api/admin/posts — List posts pending review
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING_REVIEW';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status !== 'all') {
      where.status = status;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: { id: true, fullName: true, role: true, profileImageUrl: true },
          },
          community: {
            select: { id: true, name: true, displayName: true },
          },
        },
        orderBy: { createdAt: 'asc' }, // Oldest first (FIFO)
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({
      posts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[ADMIN_POSTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch posts.' }, { status: 500 });
  }
}

// PATCH /api/admin/posts — Bulk or single post moderation
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { postId, ...moderationData } = body;

    if (!postId) {
      return NextResponse.json({ error: 'postId is required.' }, { status: 400 });
    }

    const parsed = moderatePostSchema.safeParse(moderationData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    await prisma.post.update({
      where: { id: postId },
      data: { status: parsed.data.status },
    });

    // Update community counters
    if (parsed.data.status === 'PUBLISHED' && post.status !== 'PUBLISHED') {
      await prisma.community.update({
        where: { id: post.communityId },
        data: { postCount: { increment: 1 } },
      });
    }
    if (parsed.data.status !== 'PUBLISHED' && post.status === 'PUBLISHED') {
      await prisma.community.update({
        where: { id: post.communityId },
        data: { postCount: { decrement: 1 } },
      });
    }

    return NextResponse.json({ message: `Post ${parsed.data.status.toLowerCase()}.` });
  } catch (error) {
    console.error('[ADMIN_POSTS_PATCH]', error);
    return NextResponse.json({ error: 'Failed to moderate post.' }, { status: 500 });
  }
}
