import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { communityRequestSchema } from '@/schemas/community.schema';

// GET /api/communities/requests — Admin: List community requests
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status !== 'all') {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.communityRequest.findMany({
        where,
        include: {
          requester: { select: { id: true, fullName: true, role: true, profileImageUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.communityRequest.count({ where }),
    ]);

    return NextResponse.json({
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[COMMUNITY_REQUESTS_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch requests.' }, { status: 500 });
  }
}

// POST /api/communities/requests — Lawyer: Submit community request
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    if (session.role !== 'LAWYER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only lawyers can request new communities.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = communityRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Check for existing community or pending request with same name
    const [existingCommunity, existingRequest] = await Promise.all([
      prisma.community.findUnique({ where: { name: parsed.data.name } }),
      prisma.communityRequest.findFirst({
        where: { name: parsed.data.name, status: 'PENDING' },
      }),
    ]);

    if (existingCommunity) {
      return NextResponse.json({ error: 'A community with this name already exists.' }, { status: 409 });
    }
    if (existingRequest) {
      return NextResponse.json({ error: 'A request for this community name is already pending.' }, { status: 409 });
    }

    const request = await prisma.communityRequest.create({
      data: {
        ...parsed.data,
        requesterId: session.userId,
      },
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    console.error('[COMMUNITY_REQUESTS_POST]', error);
    return NextResponse.json({ error: 'Failed to submit request.' }, { status: 500 });
  }
}
