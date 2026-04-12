import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/communities/[id]/members — List community members
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [members, total] = await Promise.all([
      prisma.communityMember.findMany({
        where: { communityId: id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profileImageUrl: true,
              role: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // CREATOR first, then MODERATOR, then MEMBER
          { joinedAt: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.communityMember.count({ where: { communityId: id } }),
    ]);

    return NextResponse.json({
      members,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[COMMUNITY_MEMBERS]', error);
    return NextResponse.json({ error: 'Failed to fetch members.' }, { status: 500 });
  }
}
