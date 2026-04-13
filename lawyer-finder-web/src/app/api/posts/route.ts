import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createPostSchema } from '@/schemas/community.schema';

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) +
    '-' +
    Date.now().toString(36)
  );
}

function generateExcerpt(content: string): string {
  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/[#*_~`>\[\]()!]/g, '');
  return plainText.replace(/\s+/g, ' ').substring(0, 200).trim();
}

// GET /api/posts — Feed with filtering and sorting
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const communityId = searchParams.get('communityId') || '';
    const communitySlug = searchParams.get('community') || '';
    const sort = searchParams.get('sort') || 'hot'; // hot, new, top
    const timeRange = searchParams.get('time') || 'week'; // day, week, month, year, all
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
    };

    if (communityId) {
      where.communityId = communityId;
    } else if (communitySlug) {
      const community = await prisma.community.findUnique({
        where: { name: communitySlug },
        select: { id: true },
      });
      if (community) where.communityId = community.id;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Time range filter for "top" sort
    if (sort === 'top' && timeRange !== 'all') {
      const now = new Date();
      const ranges: Record<string, Date> = {
        day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      };
      if (ranges[timeRange]) {
        where.createdAt = { gte: ranges[timeRange] };
      }
    }

    // Sort options
    let orderBy: Record<string, string>[];
    switch (sort) {
      case 'new':
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'top':
        orderBy = [{ score: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'hot':
      default:
        // Hot = combination of score and recency
        orderBy = [{ score: 'desc' }, { createdAt: 'desc' }];
        break;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
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
              profile: { select: { isVerified: true, fullName: true } },
            },
          },
          community: {
            select: { id: true, name: true, displayName: true, icon: true },
          },
          _count: { select: { comments: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    // Get user's votes on these posts if logged in
    let userVotes: Record<string, string> = {};
    const session = await getSession();
    if (session && posts.length > 0) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: session.userId,
          postId: { in: posts.map((p) => p.id) },
        },
        select: { postId: true, type: true },
      });
      userVotes = Object.fromEntries(
        votes.map((v) => [v.postId!, v.type])
      );
    }

    const enrichedPosts = posts.map((post) => ({
      ...post,
      author: post.isAnonymous 
        ? { id: 'anonymous', fullName: 'Anonymous', role: 'USER', profileImageUrl: null, profile: null } 
        : post.author,
      commentCount: post._count.comments,
      userVote: userVotes[post.id] || null,
    }));

    return NextResponse.json({
      posts: enrichedPosts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[POSTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch posts.' }, { status: 500 });
  }
}

// POST /api/posts — Create a new post
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to create posts.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Verify community exists
    const community = await prisma.community.findUnique({
      where: { id: parsed.data.communityId },
    });
    if (!community || community.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Community not found.' }, { status: 404 });
    }

    // Determine post status based on user trust level
    let postStatus: 'PUBLISHED' | 'PENDING_REVIEW' = 'PENDING_REVIEW';

    if (session.role === 'ADMIN') {
      postStatus = 'PUBLISHED';
    } else if (session.role === 'LAWYER') {
      // Check if lawyer is verified
      const profile = await prisma.lawyerProfile.findUnique({
        where: { userId: session.userId },
        select: { isVerified: true },
      });
      if (profile?.isVerified) {
        postStatus = 'PUBLISHED'; // Verified lawyers auto-publish
      }
    } else {
      // CLIENT: check post history
      const publishedCount = await prisma.post.count({
        where: { authorId: session.userId, status: 'PUBLISHED' },
      });
      const flaggedCount = await prisma.report.count({
        where: {
          post: { authorId: session.userId },
          status: 'ACTION_TAKEN',
        },
      });
      if (publishedCount >= 3 && flaggedCount === 0) {
        postStatus = 'PUBLISHED'; // Trusted client auto-publishes
      }
    }

    const slug = generateSlug(parsed.data.title);
    const excerpt = generateExcerpt(parsed.data.content);

    const post = await prisma.post.create({
      data: {
        communityId: parsed.data.communityId,
        authorId: session.userId,
        title: parsed.data.title,
        slug,
        content: parsed.data.content,
        excerpt,
        coverImage: parsed.data.coverImage || null,
        images: parsed.data.images || [],
        language: parsed.data.language,
        status: postStatus,
        isAnonymous: parsed.data.isAnonymous || false,
      },
    });

    // Update community post count if published
    if (postStatus === 'PUBLISHED') {
      await prisma.community.update({
        where: { id: parsed.data.communityId },
        data: { postCount: { increment: 1 } },
      });
    }

    return NextResponse.json({
      post,
      message:
        postStatus === 'PUBLISHED'
          ? 'Post published successfully!'
          : 'Post submitted for review. It will be visible once approved.',
    }, { status: 201 });
  } catch (error) {
    console.error('[POSTS_POST]', error);
    return NextResponse.json({ error: 'Failed to create post.' }, { status: 500 });
  }
}
