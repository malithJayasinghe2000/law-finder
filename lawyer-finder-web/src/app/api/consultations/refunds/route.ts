import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { formatSriLankaDateIso } from '@/lib/utils';
import { EmailService } from '@/lib/email/EmailService';

// GET: List bookings with pending refunds (Admin only)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'LAWYER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING'; // PENDING, PROCESSED, ALL

    const where: any = {};
    if (status === 'ALL') {
      where.refundStatus = { in: ['PENDING', 'PROCESSED', 'DECLINED'] };
    } else {
      where.refundStatus = status;
    }

    // A lawyer sees only refunds they themselves owe — they hold the money, so
    // they are the one who returns it.
    if (session.role === 'LAWYER') {
      const lawyer = await prisma.lawyerProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });

      if (!lawyer) {
        return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
      }

      where.lawyerId = lawyer.id;
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
        date: formatSriLankaDateIso(b.date),
        startTime: b.startTime,
        endTime: b.endTime,
        mode: b.mode,
        totalAmount: b.totalAmount,
        lawyerFee: b.lawyerFee,
        refundAmount: b.refundAmount || 0,
        retainedLawyerFee: b.retainedLawyerFee || 0,
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
      // Scoped the same way as the list above, so a lawyer's totals cover only
      // their own refunds rather than the whole platform's.
      stats: {
        pendingCount: await prisma.booking.count({
          where: { ...where, refundStatus: 'PENDING' },
        }),
        processedCount: await prisma.booking.count({
          where: { ...where, refundStatus: 'PROCESSED' },
        }),
        totalPendingAmount: (await prisma.booking.aggregate({
          where: { ...where, refundStatus: 'PENDING' },
          _sum: { refundAmount: true },
        }))._sum.refundAmount || 0,
      },
    });
  } catch (error) {
    console.error('Refund list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH: Record that a refund has been made, or declined.
 *
 * The platform does not hold consultation fees, so it cannot issue a refund. The
 * lawyer received the money and the lawyer returns it directly to the client.
 * This endpoint only *records* that outcome.
 *
 * The lawyer who owes the refund can record it themselves; admins may also record
 * one on their behalf for support cases.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
 */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      include: {
        client: { select: { email: true, fullName: true } },
        lawyer: { select: { userId: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isAdmin = session.role === 'ADMIN';
    const isOwningLawyer = booking.lawyer.userId === session.userId;

    if (!isAdmin && !isOwningLawyer) {
      return NextResponse.json(
        { error: 'Only the lawyer who received the fee, or an admin, can record this refund.' },
        { status: 403 }
      );
    }

    if (booking.refundStatus !== 'PENDING') {
      return NextResponse.json({ error: 'This booking does not have a pending refund' }, { status: 400 });
    }

    const actor = isOwningLawyer ? 'lawyer' : 'admin';
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        refundStatus: action === 'process' ? 'PROCESSED' : 'DECLINED',
        refundProcessedAt: new Date(),
        refundNotes:
          notes ||
          (action === 'process'
            ? `Refund confirmed as returned to the client (recorded by ${actor})`
            : `Refund declined (recorded by ${actor})`),
      },
    });

    if (action === 'process') {
      await EmailService.sendRefundProcessed(booking.client.email, booking.client.fullName || 'Client', booking.bookingNumber, booking.refundAmount || 0);
    } else {
      await EmailService.sendRefundDeclined(booking.client.email, booking.client.fullName || 'Client', booking.bookingNumber, notes || 'Refund declined by admin');
    }

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
