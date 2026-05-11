import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET: List bookings with pending refunds (Admin only)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING'; // PENDING, PROCESSED, ALL

    const where: any = {};
    if (status === 'ALL') {
      where.refundStatus = { in: ['PENDING', 'PROCESSED', 'DECLINED'] };
    } else {
      where.refundStatus = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        client: { select: { id: true, fullName: true, email: true, profileImageUrl: true } },
        lawyer: { select: { id: true, fullName: true, profileImageUrl: true } },
        payment: { select: { method: true, bankName: true, accountHolder: true, transactionRef: true } },
      },
      orderBy: { cancelledAt: 'desc' },
    });

    return NextResponse.json({
      refunds: bookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        clientName: b.client.fullName || b.client.email,
        clientEmail: b.client.email,
        lawyerName: b.lawyer.fullName,
        date: b.date.toISOString().split('T')[0],
        startTime: b.startTime,
        endTime: b.endTime,
        mode: b.mode,
        totalAmount: b.totalAmount,
        lawyerFee: b.lawyerFee,
        platformFee: b.platformFee,
        refundAmount: b.refundAmount || 0,
        refundStatus: b.refundStatus,
        refundProcessedAt: b.refundProcessedAt?.toISOString() || null,
        refundNotes: b.refundNotes,
        status: b.status,
        cancelReason: b.cancelReason,
        cancelledAt: b.cancelledAt?.toISOString() || null,
        cancelledBy: b.cancelledBy,
        paymentMethod: b.payment?.method || 'N/A',
        paymentBankName: b.payment?.bankName || null,
        paymentAccountHolder: b.payment?.accountHolder || null,
        paymentTransactionRef: b.payment?.transactionRef || null,
      })),
      stats: {
        pendingCount: await prisma.booking.count({ where: { refundStatus: 'PENDING' } }),
        processedCount: await prisma.booking.count({ where: { refundStatus: 'PROCESSED' } }),
        totalPendingAmount: (await prisma.booking.aggregate({
          where: { refundStatus: 'PENDING' },
          _sum: { refundAmount: true },
        }))._sum.refundAmount || 0,
      },
    });
  } catch (error) {
    console.error('Refund list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Process a refund (mark as PROCESSED or DECLINED)
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { bookingId, action, notes } = body;

    if (!bookingId || !action) {
      return NextResponse.json({ error: 'bookingId and action are required' }, { status: 400 });
    }

    if (!['process', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "process" or "decline"' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.refundStatus !== 'PENDING') {
      return NextResponse.json({ error: 'This booking does not have a pending refund' }, { status: 400 });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        refundStatus: action === 'process' ? 'PROCESSED' : 'DECLINED',
        refundProcessedAt: new Date(),
        refundNotes: notes || (action === 'process' ? 'Refund processed by admin' : 'Refund declined by admin'),
      },
    });

    return NextResponse.json({
      success: true,
      booking: {
        id: updated.id,
        refundStatus: updated.refundStatus,
        refundProcessedAt: updated.refundProcessedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Refund action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
