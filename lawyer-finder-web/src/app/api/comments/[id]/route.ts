import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { updateCommentSchema } from '@/schemas/community.schema';

// PATCH /api/comments/[id] — Edit own comment
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const comment = await prisma.comment.findUnique({ where: { id } });

    if (!comment || comment.isDeleted) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
    }
    if (comment.authorId !== session.userId && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'You can only edit your own comments.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: { content: parsed.data.content },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error('[COMMENT_PATCH]', error);
    return NextResponse.json({ error: 'Failed to update comment.' }, { status: 500 });
  }
}

// DELETE /api/comments/[id] — Soft delete comment
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const comment = await prisma.comment.findUnique({ where: { id } });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
    }

    // Author, admin, or community mod can delete
    const isAuthor = session.userId === comment.authorId;
    const isAdmin = session.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      // Check if community mod
      const post = await prisma.post.findUnique({ where: { id: comment.postId }, select: { communityId: true } });
      if (post) {
        const membership = await prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId: post.communityId, userId: session.userId } },
        });
        if (!membership || membership.role === 'MEMBER') {
          return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
        }
      }
    }

    // Soft delete: replace content but keep structure for threaded replies
    await prisma.comment.update({
      where: { id },
      data: { isDeleted: true, content: '[deleted]' },
    });

    // Decrement post comment count
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });

    return NextResponse.json({ message: 'Comment deleted.' });
  } catch (error) {
    console.error('[COMMENT_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete comment.' }, { status: 500 });
  }
}
