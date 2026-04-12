import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { updateCommunitySchema } from '@/schemas/community.schema';

// GET /api/communities/[id] — Single community detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const community = await prisma.community.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, role: true, profileImageUrl: true } },
        members: {
          where: { role: { in: ['CREATOR', 'MODERATOR'] } },
          include: { user: { select: { id: true, fullName: true, profileImageUrl: true, role: true } } },
          take: 10,
        },
        _count: { select: { posts: true, members: true } },
      },
    });

    if (!community || community.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Community not found.' }, { status: 404 });
    }

    // Check if user is a member
    let membership = null;
    const session = await getSession();
    if (session) {
      membership = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: id, userId: session.userId } },
      });
    }

    return NextResponse.json({
      community: {
        ...community,
        memberCount: community._count.members,
        postCount: community._count.posts,
        isMember: !!membership,
        userRole: membership?.role || null,
      },
    });
  } catch (error) {
    console.error('[COMMUNITY_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch community.' }, { status: 500 });
  }
}

// PATCH /api/communities/[id] — Update community (Admin/Moderator)
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

    // Check permission: admin or community moderator/creator
    if (session.role !== 'ADMIN') {
      const membership = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: id, userId: session.userId } },
      });
      if (!membership || membership.role === 'MEMBER') {
        return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
      }
    }

    const body = await req.json();
    const parsed = updateCommunitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const community = await prisma.community.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ community });
  } catch (error) {
    console.error('[COMMUNITY_PATCH]', error);
    return NextResponse.json({ error: 'Failed to update community.' }, { status: 500 });
  }
}

// DELETE /api/communities/[id] — Archive community (Admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.community.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    return NextResponse.json({ message: 'Community archived.' });
  } catch (error) {
    console.error('[COMMUNITY_DELETE]', error);
    return NextResponse.json({ error: 'Failed to archive community.' }, { status: 500 });
  }
}
