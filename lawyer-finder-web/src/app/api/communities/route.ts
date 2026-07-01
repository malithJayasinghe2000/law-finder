import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createCommunitySchema } from '@/schemas/community.schema';

import { validatePaginationParams, sanitizeString } from '@/lib/security';

// GET /api/communities — List communities with search/pagination
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ? sanitizeString(searchParams.get('search') || '', 100) : '';
    const category = searchParams.get('category') || '';
    
    // Clamp pagination parameters
    const { page, limit } = validatePaginationParams(
      searchParams.get('page'),
      searchParams.get('limit')
    );
    const sort = searchParams.get('sort') || 'popular'; // popular, newest, alphabetical

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
    };

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const orderBy: Record<string, string> =
      sort === 'newest'
        ? { createdAt: 'desc' }
        : sort === 'alphabetical'
          ? { displayName: 'asc' }
          : { memberCount: 'desc' };

    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: { select: { id: true, fullName: true, role: true } },
          _count: { select: { posts: true, members: true } },
        },
      }),
      prisma.community.count({ where }),
    ]);

    // If user is logged in, check their memberships
    let userMemberships: string[] = [];
    const session = await getSession();
    if (session) {
      const memberships = await prisma.communityMember.findMany({
        where: { userId: session.userId },
        select: { communityId: true },
      });
      userMemberships = memberships.map((m) => m.communityId);
    }

    const enrichedCommunities = communities.map((c) => ({
      ...c,
      isMember: userMemberships.includes(c.id),
      memberCount: c._count.members,
      postCount: c._count.posts,
    }));

    return NextResponse.json({
      communities: enrichedCommunities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[COMMUNITIES_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch communities.' }, { status: 500 });
  }
}

// POST /api/communities — Admin creates community directly
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can create communities directly.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createCommunitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Check name uniqueness
    const existing = await prisma.community.findUnique({ where: { name: parsed.data.name } });
    if (existing) {
      return NextResponse.json({ error: 'A community with this name already exists.' }, { status: 409 });
    }

    const community = await prisma.community.create({
      data: {
        ...parsed.data,
        createdById: session.userId,
      },
    });

    // Auto-add creator as CREATOR member
    await prisma.communityMember.create({
      data: {
        communityId: community.id,
        userId: session.userId,
        role: 'CREATOR',
      },
    });

    // Update member count
    await prisma.community.update({
      where: { id: community.id },
      data: { memberCount: 1 },
    });

    return NextResponse.json({ community }, { status: 201 });
  } catch (error) {
    console.error('[COMMUNITIES_POST]', error);
    return NextResponse.json({ error: 'Failed to create community.' }, { status: 500 });
  }
}
