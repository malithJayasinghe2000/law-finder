import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/communities/[id]/join — Join a community
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to join communities.' }, { status: 401 });
    }

    const { id } = await params;

    // Verify community exists and is active
    const community = await prisma.community.findUnique({ where: { id } });
    if (!community || community.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Community not found.' }, { status: 404 });
    }

    // Check if already a member
    const existing = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId: session.userId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Already a member.' }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.communityMember.create({
        data: { communityId: id, userId: session.userId, role: 'MEMBER' },
      }),
      prisma.community.update({
        where: { id },
        data: { memberCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ message: 'Joined successfully.' }, { status: 201 });
  } catch (error) {
    console.error('[COMMUNITY_JOIN]', error);
    return NextResponse.json({ error: 'Failed to join community.' }, { status: 500 });
  }
}

// DELETE /api/communities/[id]/join — Leave a community
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

    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId: session.userId } },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member.' }, { status: 404 });
    }

    // Prevent creators from leaving (they must transfer ownership first)
    if (membership.role === 'CREATOR') {
      return NextResponse.json(
        { error: 'Community creators cannot leave. Transfer ownership first.' },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.communityMember.delete({
        where: { communityId_userId: { communityId: id, userId: session.userId } },
      }),
      prisma.community.update({
        where: { id },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ message: 'Left community.' });
  } catch (error) {
    console.error('[COMMUNITY_LEAVE]', error);
    return NextResponse.json({ error: 'Failed to leave community.' }, { status: 500 });
  }
}
