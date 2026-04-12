import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { reviewCommunityRequestSchema } from '@/schemas/community.schema';

// PATCH /api/communities/requests/[id] — Admin: Approve/Reject request
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = reviewCommunityRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const request = await prisma.communityRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request not found or already processed.' }, { status: 404 });
    }

    if (parsed.data.status === 'APPROVED') {
      // Create the community and add requester as creator
      const community = await prisma.community.create({
        data: {
          name: request.name,
          displayName: request.displayName,
          description: request.description,
          category: request.category,
          createdById: request.requesterId,
        },
      });

      await prisma.communityMember.create({
        data: {
          communityId: community.id,
          userId: request.requesterId,
          role: 'CREATOR',
        },
      });

      await prisma.community.update({
        where: { id: community.id },
        data: { memberCount: 1 },
      });
    }

    await prisma.communityRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        adminNotes: parsed.data.adminNotes || null,
      },
    });

    return NextResponse.json({
      message: `Request ${parsed.data.status.toLowerCase()}.`,
    });
  } catch (error) {
    console.error('[COMMUNITY_REQUEST_REVIEW]', error);
    return NextResponse.json({ error: 'Failed to process request.' }, { status: 500 });
  }
}
