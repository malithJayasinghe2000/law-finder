import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { voteSchema } from '@/schemas/community.schema';

// POST /api/comments/[id]/vote — Toggle vote on a comment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to vote.' }, { status: 401 });
    }

    const { id: commentId } = await params;
    const body = await req.json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isDeleted) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
    }

    const existingVote = await prisma.vote.findUnique({
      where: { userId_commentId: { userId: session.userId, commentId } },
    });

    if (existingVote) {
      if (existingVote.type === parsed.data.type) {
        // Toggle off
        await prisma.vote.delete({ where: { id: existingVote.id } });
        const update =
          parsed.data.type === 'UPVOTE'
            ? { upvotes: { decrement: 1 }, score: { decrement: 1 } }
            : { downvotes: { decrement: 1 }, score: { increment: 1 } };
        const updated = await prisma.comment.update({
          where: { id: commentId },
          data: update,
          select: { upvotes: true, downvotes: true, score: true },
        });
        return NextResponse.json({ ...updated, userVote: null });
      } else {
        // Switch vote
        await prisma.vote.update({ where: { id: existingVote.id }, data: { type: parsed.data.type } });
        const update =
          parsed.data.type === 'UPVOTE'
            ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 }, score: { increment: 2 } }
            : { upvotes: { decrement: 1 }, downvotes: { increment: 1 }, score: { decrement: 2 } };
        const updated = await prisma.comment.update({
          where: { id: commentId },
          data: update,
          select: { upvotes: true, downvotes: true, score: true },
        });
        return NextResponse.json({ ...updated, userVote: parsed.data.type });
      }
    } else {
      // New vote
      await prisma.vote.create({ data: { userId: session.userId, commentId, type: parsed.data.type } });
      const update =
        parsed.data.type === 'UPVOTE'
          ? { upvotes: { increment: 1 }, score: { increment: 1 } }
          : { downvotes: { increment: 1 }, score: { decrement: 1 } };
      const updated = await prisma.comment.update({
        where: { id: commentId },
        data: update,
        select: { upvotes: true, downvotes: true, score: true },
      });
      return NextResponse.json({ ...updated, userVote: parsed.data.type });
    }
  } catch (error) {
    console.error('[COMMENT_VOTE]', error);
    return NextResponse.json({ error: 'Failed to vote.' }, { status: 500 });
  }
}
