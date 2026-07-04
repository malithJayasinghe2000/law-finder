import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET: Retrieve all lawyer withdrawal requests (ADMIN only)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const withdrawals = await prisma.withdrawRequest.findMany({
      include: {
        lawyer: {
          select: {
            id: true,
            fullName: true,
            baslNumber: true,
            contactPhone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      withdrawals,
    });
  } catch (error: any) {
    console.error('Failed to get admin withdrawals:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', stack: error?.stack }, { status: 500 });
  }
}

// PATCH: Update status, upload references, add notes to a withdraw request (ADMIN only)
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, adminNotes, referenceImageUrl } = body;

    if (!id || !status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Valid withdrawal ID and status (APPROVED, REJECTED, PENDING) are required.' }, { status: 400 });
    }

    const withdrawRequest = await prisma.withdrawRequest.findUnique({
      where: { id },
    });

    if (!withdrawRequest) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    const updated = await prisma.withdrawRequest.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes ?? withdrawRequest.adminNotes,
        referenceImageUrl: referenceImageUrl ?? withdrawRequest.referenceImageUrl,
      },
      include: {
        lawyer: {
          select: {
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      withdrawRequest: updated,
    });
  } catch (error: any) {
    console.error('Failed to update withdraw request:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', stack: error?.stack }, { status: 500 });
  }
}
