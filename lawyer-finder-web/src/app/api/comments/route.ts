import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createCommentSchema } from '@/schemas/community.schema';

// GET /api/comments?postId=xxx — Get threaded comments for a post
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const sort = searchParams.get('sort') || 'best'; // best, new, old
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!postId) {
      return NextResponse.json({ error: 'postId is required.' }, { status: 400 });
    }

    let orderBy: Record<string, string>;
    switch (sort) {
      case 'new':
        orderBy = { createdAt: 'desc' };
        break;
      case 'old':
        orderBy = { createdAt: 'asc' };
        break;
      case 'best':
      default:
        orderBy = { score: 'desc' };
        break;
    }

    // Get top-level comments only (parentId is null)
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { postId, parentId: null, isDeleted: false },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              profileImageUrl: true,
              role: true,
              profile: { select: { isVerified: true } },
            },
          },
          replies: {
            where: { isDeleted: false },
            orderBy: { score: 'desc' },
            take: 5, // First 5 replies loaded inline
            include: {
              author: {
                select: {
                  id: true,
                  fullName: true,
                  profileImageUrl: true,
                  role: true,
                  profile: { select: { isVerified: true } },
                },
              },
              _count: { select: { replies: true } },
            },
          },
          _count: { select: { replies: true } },
        },
      }),
      prisma.comment.count({ where: { postId, parentId: null, isDeleted: false } }),
    ]);

    // Get user votes on these comments
    let userVotes: Record<string, string> = {};
    const session = await getSession();
    if (session) {
      const allCommentIds = [
        ...comments.map((c) => c.id),
        ...comments.flatMap((c) => c.replies.map((r) => r.id)),
      ];
      if (allCommentIds.length > 0) {
        const votes = await prisma.vote.findMany({
          where: { userId: session.userId, commentId: { in: allCommentIds } },
          select: { commentId: true, type: true },
        });
        userVotes = Object.fromEntries(votes.map((v) => [v.commentId!, v.type]));
      }
    }

    const enrichedComments = comments.map((comment) => ({
      ...comment,
      replyCount: comment._count.replies,
      userVote: userVotes[comment.id] || null,
      replies: comment.replies.map((reply) => ({
        ...reply,
        replyCount: reply._count.replies,
        userVote: userVotes[reply.id] || null,
      })),
    }));

    return NextResponse.json({
      comments: enrichedComments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[COMMENTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch comments.' }, { status: 500 });
  }
}

// POST /api/comments — Create a comment
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to comment.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Verify post exists and is not locked
    const post = await prisma.post.findUnique({
      where: { id: parsed.data.postId },
      select: { id: true, status: true, isLocked: true },
    });

    if (!post || post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    if (post.isLocked) {
      return NextResponse.json({ error: 'This post is locked. No new comments allowed.' }, { status: 403 });
    }

    // If replying, verify parent comment exists
    if (parsed.data.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parsed.data.parentId },
        select: { id: true, postId: true },
      });
      if (!parent || parent.postId !== parsed.data.postId) {
        return NextResponse.json({ error: 'Parent comment not found.' }, { status: 404 });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        postId: parsed.data.postId,
        authorId: session.userId,
        content: parsed.data.content,
        parentId: parsed.data.parentId || null,
        language: parsed.data.language,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImageUrl: true,
            role: true,
            profile: { select: { isVerified: true } },
          },
        },
      },
    });

    // Update post comment count
    await prisma.post.update({
      where: { id: parsed.data.postId },
      data: { commentCount: { increment: 1 } },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('[COMMENTS_POST]', error);
    return NextResponse.json({ error: 'Failed to create comment.' }, { status: 500 });
  }
}
