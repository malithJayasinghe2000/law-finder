import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { voteSchema } from '@/schemas/community.schema';

// POST /api/posts/[id]/vote — Toggle vote on a post
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to vote.' }, { status: 401 });
    }

    const { id: postId } = await params;
    const body = await req.json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    const existingVote = await prisma.vote.findUnique({
      where: { userId_postId: { userId: session.userId, postId } },
    });

    if (existingVote) {
      if (existingVote.type === parsed.data.type) {
        // Same vote type: remove vote (toggle off)
        await prisma.vote.delete({ where: { id: existingVote.id } });

        const update =
          parsed.data.type === 'UPVOTE'
            ? { upvotes: { decrement: 1 }, score: { decrement: 1 } }
            : { downvotes: { decrement: 1 }, score: { increment: 1 } };

        const updated = await prisma.post.update({
          where: { id: postId },
          data: update,
          select: { upvotes: true, downvotes: true, score: true },
        });

        return NextResponse.json({ ...updated, userVote: null });
      } else {
        // Different vote type: switch vote
        await prisma.vote.update({
          where: { id: existingVote.id },
          data: { type: parsed.data.type },
        });

        const update =
          parsed.data.type === 'UPVOTE'
            ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 }, score: { increment: 2 } }
            : { upvotes: { decrement: 1 }, downvotes: { increment: 1 }, score: { decrement: 2 } };

        const updated = await prisma.post.update({
          where: { id: postId },
          data: update,
          select: { upvotes: true, downvotes: true, score: true },
        });

        return NextResponse.json({ ...updated, userVote: parsed.data.type });
      }
    } else {
      // New vote
      await prisma.vote.create({
        data: {
          userId: session.userId,
          postId,
          type: parsed.data.type,
        },
      });

      const update =
        parsed.data.type === 'UPVOTE'
          ? { upvotes: { increment: 1 }, score: { increment: 1 } }
          : { downvotes: { increment: 1 }, score: { decrement: 1 } };

      const updated = await prisma.post.update({
        where: { id: postId },
        data: update,
        select: { upvotes: true, downvotes: true, score: true },
      });

      return NextResponse.json({ ...updated, userVote: parsed.data.type });
    }
  } catch (error) {
    console.error('[POST_VOTE]', error);
    return NextResponse.json({ error: 'Failed to vote.' }, { status: 500 });
  }
}
