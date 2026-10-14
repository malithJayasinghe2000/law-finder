import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createCommentSchema } from '@/schemas/community.schema';

import { validatePaginationParams, isValidUUID } from '@/lib/security';

// GET /api/comments?postId=xxx — Get threaded comments for a post
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const sort = searchParams.get('sort') || 'best'; // best, new, old
    
    // Clamp pagination parameters
    const { page, limit } = validatePaginationParams(
      searchParams.get('page'),
      searchParams.get('limit'),
      { page: 1, limit: 50, maxLimit: 100 }
    );

    if (!postId || !isValidUUID(postId)) {
      return NextResponse.json({ error: 'A valid postId is required.' }, { status: 400 });
    }

    // Fetch all comments for the post to build a complete N-depth tree
    const allComments = await prisma.comment.findMany({
      where: { postId }, // Fetch all, including deleted, to maintain thread hierarchy
      orderBy: { createdAt: 'asc' }, // Sorting will be dynamically applied to tree nodes next
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImageUrl: true,
            role: true,
            profile: { select: { isVerified: true, fullName: true } },
          },
        },
      },
    });

    // Get user votes on these comments
    let userVotes: Record<string, string> = {};
    const session = await getSession();
    if (session && allComments.length > 0) {
      const allCommentIds = allComments.map((c) => c.id);
      const votes = await prisma.vote.findMany({
        where: { userId: session.userId, commentId: { in: allCommentIds } },
        select: { commentId: true, type: true },
      });
      userVotes = Object.fromEntries(votes.map((v) => [v.commentId!, v.type]));
    }

    // Build the nested tree
    const commentMap = new Map();
    allComments.forEach((c) => {
      // If deleted, scrub content but keep the node to anchor its replies
      const content = c.isDeleted ? '' : c.content;
      
      let author = c.author;
      if (c.isAnonymous) {
        author = {
          id: 'anonymous',
          fullName: 'Anonymous',
          profileImageUrl: null,
          role: 'CLIENT',
          profile: null,
        } as any;
      }

      commentMap.set(c.id, { 
        ...c, 
        content, 
        author,
        replies: [], 
        replyCount: 0, 
        userVote: userVotes[c.id] || null 
      });
    });

    const rootComments: any[] = [];
    allComments.forEach((c) => {
      const node = commentMap.get(c.id);
      if (c.parentId) {
        const parent = commentMap.get(c.parentId);
        if (parent) {
          parent.replies.push(node);
          parent.replyCount += 1;
        } else {
          // If parent is completely missing, hoist to root
          rootComments.push(node);
        }
      } else {
        rootComments.push(node);
      }
    });

    // Sort the tree based on requested order
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (sort === 'new') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        // 'best' (the default) used to order by votes, putting the most
        // up-voted answer — often an attorney's — first. That is the platform
        // ranking attorneys (rules 3 and 4), so it now means conversation order.
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      nodes.forEach(n => sortNodes(n.replies));
    };
    sortNodes(rootComments);

    // Filter out root comments that are deleted AND have no replies
    const validRootComments = rootComments.filter(c => !c.isDeleted || c.replies.length > 0);

    // Apply pagination ONLY to root comments
    const total = validRootComments.length;
    const paginatedRoots = validRootComments.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      comments: paginatedRoots,
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
        isAnonymous: parsed.data.isAnonymous,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            profileImageUrl: true,
            role: true,
            profile: { select: { isVerified: true, fullName: true } },
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
