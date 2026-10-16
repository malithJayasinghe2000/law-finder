import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { updatePostSchema } from '@/schemas/community.schema';

// GET /api/posts/[id] — Single post with author and community details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try finding by ID or slug
    const post = await prisma.post.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImageUrl: true,
            role: true,
            profile: { select: { isVerified: true, fullName: true, practiceAreas: true } },
          },
        },
        community: {
          select: { id: true, name: true, displayName: true, icon: true },
        },
        translations: true,
        _count: { select: { comments: true, reports: true } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    // Only show non-published posts to the author or admins
    const session = await getSession();
    if (post.status !== 'PUBLISHED') {
      if (!session || (session.userId !== post.authorId && session.role !== 'ADMIN')) {
        return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
      }
    }

    // Get user vote
    let userVote = null;
    if (session) {
      const vote = await prisma.vote.findUnique({
        where: { userId_postId: { userId: session.userId, postId: post.id } },
      });
      userVote = vote?.type || null;
    }

    // Increment view count
    await prisma.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      post: {
        ...post,
        author: post.isAnonymous 
          ? { id: 'anonymous', fullName: 'Anonymous', role: 'USER', profileImageUrl: null, profile: null } 
          : post.author,
        commentCount: post._count.comments,
        reportCount: session?.role === 'ADMIN' ? post._count.reports : undefined,
        userVote,
      },
    });
  } catch (error) {
    console.error('[POST_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch post.' }, { status: 500 });
  }
}

// PATCH /api/posts/[id] — Update post (author can edit, admin/mod can moderate)
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
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updatePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const isAuthor = session.userId === post.authorId;
    const isAdmin = session.role === 'ADMIN';

    // Check community mod status
    let isMod = false;
    if (!isAdmin && !isAuthor) {
      const membership = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: post.communityId, userId: session.userId } },
      });
      isMod = membership?.role === 'MODERATOR' || membership?.role === 'CREATOR';
    }

    if (!isAuthor && !isAdmin && !isMod) {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
    }

    const updateData: Record<string, any> = {};

    // Authors can update content fields
    if (isAuthor) {
      if (parsed.data.title) updateData.title = parsed.data.title;
      if (parsed.data.content) {
        updateData.content = parsed.data.content;
        updateData.excerpt = parsed.data.content.replace(/[#*_~`>\[\]()!]/g, '').substring(0, 200).trim();
      }
      if (parsed.data.coverImage !== undefined) updateData.coverImage = parsed.data.coverImage;
      if (parsed.data.images) updateData.images = parsed.data.images;
      if (parsed.data.language) updateData.language = parsed.data.language;
      
      // Authors can transition statuses
      if (parsed.data.status && parsed.data.status !== post.status) {
        // A post a moderator rejected or took down (or that reports hid) goes
        // back to a moderator, never straight to PUBLISHED: a verified attorney
        // could republish a removed post themselves.
        const heldByModeration =
          post.status === 'REJECTED' || (post.status === 'REMOVED' && post.removedBy !== 'AUTHOR');
        if (parsed.data.status === 'REMOVED' && post.status === 'PUBLISHED') {
          updateData.status = 'REMOVED';
          updateData.removedBy = 'AUTHOR';
        } else if (heldByModeration && (parsed.data.status === 'PENDING_REVIEW' || parsed.data.status === 'PUBLISHED')) {
          updateData.status = 'PENDING_REVIEW';
        } else if (parsed.data.status === 'DRAFT') {
           updateData.status = 'DRAFT';
        } else if (parsed.data.status === 'PENDING_REVIEW' || parsed.data.status === 'PUBLISHED') {
          // Re-evaluate trust level
          let newStatus: 'PUBLISHED' | 'PENDING_REVIEW' = 'PENDING_REVIEW';
          if (session.role === 'ADMIN') {
            newStatus = 'PUBLISHED';
          } else if (session.role === 'LAWYER') {
            const profile = await prisma.lawyerProfile.findUnique({
              where: { userId: session.userId },
              select: { isVerified: true },
            });
            if (profile?.isVerified) newStatus = 'PUBLISHED';
          } else {
            const publishedCount = await prisma.post.count({
              where: { authorId: session.userId, status: 'PUBLISHED' },
            });
            const flaggedCount = await prisma.report.count({
              where: { post: { authorId: session.userId }, status: 'ACTION_TAKEN' },
            });
            if (publishedCount >= 3 && flaggedCount === 0) newStatus = 'PUBLISHED';
          }
          updateData.status = newStatus;
        }
      }
    }

    // Admin/Mod can update moderation fields
    if (isAdmin || isMod) {
      if (parsed.data.status) {
        updateData.status = parsed.data.status;
        updateData.removedBy = parsed.data.status === 'REMOVED' ? 'MODERATOR' : null;
      }
      if (parsed.data.isPinned !== undefined) updateData.isPinned = parsed.data.isPinned;
      if (parsed.data.isLocked !== undefined) updateData.isLocked = parsed.data.isLocked;
    }

    // Handle community postCount adjustments
    const finalStatus = (updateData.status as string) || (post.status as string);
    if (finalStatus === 'PUBLISHED' && post.status !== 'PUBLISHED') {
      await prisma.community.update({
        where: { id: post.communityId },
        data: { postCount: { increment: 1 } },
      });
    } else if (finalStatus !== 'PUBLISHED' && post.status === 'PUBLISHED') {
      await prisma.community.update({
        where: { id: post.communityId },
        data: { postCount: { decrement: 1 } },
      });
    }

    const updated = await prisma.post.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ post: updated });
  } catch (error) {
    console.error('[POST_PATCH]', error);
    return NextResponse.json({ error: 'Failed to update post.' }, { status: 500 });
  }
}

// DELETE /api/posts/[id] — Delete post (author or admin)
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
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    if (session.userId !== post.authorId && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
    }

    // Soft delete by setting status to REMOVED, recording who did it.
    await prisma.post.update({
      where: { id },
      data: { status: 'REMOVED', removedBy: session.userId === post.authorId ? 'AUTHOR' : 'MODERATOR' },
    });

    // Decrement community count if was published
    if (post.status === 'PUBLISHED') {
      await prisma.community.update({
        where: { id: post.communityId },
        data: { postCount: { decrement: 1 } },
      });
    }

    return NextResponse.json({ message: 'Post deleted.' });
  } catch (error) {
    console.error('[POST_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete post.' }, { status: 500 });
  }
}
