import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { formatSriLankaDateIso, formatSriLankaDateIsoOrNull } from '@/lib/utils';
import { EmailService } from '@/lib/email/EmailService';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';
import { ADMIN_REFUNDS_VIEW_ENABLED, ADMIN_REFUNDS_VIEW_OFF_REASON } from '@/lib/consultations/adminRefunds';

// GET: List bookings with pending refunds (Admin only)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Off: see src/lib/consultations/adminRefunds.ts.
    if (session.role === 'ADMIN' && !ADMIN_REFUNDS_VIEW_ENABLED) {
      return NextResponse.json({ error: ADMIN_REFUNDS_VIEW_OFF_REASON }, { status: 410 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING'; // PENDING, PROCESSED, ALL

    const where: any = {};
    if (status === 'ALL') {
      where.refundStatus = { in: ['PENDING', 'PROCESSED', 'CONFIRMED', 'DISPUTED', 'DECLINED'] };
    } else {
      where.refundStatus = status;
    }

    // The refund is owed by the PRACTICE, which holds the fee. Its principal and
    // practice manager see all of its refunds; an attorney the ones on their own
    // matters; a paralegal none. Platform staff may look, never act (PATCH). This
    // used to be per attorney and LAWYER-only, so the people who run the
    // practice's account could not see what it owed.
    if (session.role !== 'ADMIN') {
      const membership = await getFirmMembership(session.userId);
      if (!membership || (!canManageFirm(membership) && !membership.profileId)) {
        return NextResponse.json(
          { error: "Only the practice's principal, practice manager and attorneys can see refunds." },
          { status: 403 }
        );
      }
      where.firmId = membership.firmId;
      if (!canManageFirm(membership)) where.lawyerId = membership.profileId;
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
        lawyerName: b.lawyer?.fullName ?? null,
        date: formatSriLankaDateIsoOrNull(b.date),
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
        refundMethod: b.refundMethod,
        refundReference: b.refundReference,
        refundProofUrl: b.refundProofUrl,
        refundSentOn: b.refundSentOn,
        refundDisputeReason: b.refundDisputeReason,
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
 * The practice records it — the attorney on the matter, or its principal or
 * practice manager. Platform staff cannot: it is the practice's account.
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

    if (!['process', 'decline', 'confirm', 'dispute'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "process", "decline", "confirm" or "dispute".' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: { select: { email: true, fullName: true } },
        lawyer: { select: { userId: true, fullName: true, user: { select: { email: true } } } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isClient = booking.clientId === session.userId;
    // The practice acts: the attorney on the matter, or its principal or manager.
    const membership = isClient ? null : await getFirmMembership(session.userId);
    const isPractice =
      !!membership &&
      membership.firmId === booking.firmId &&
      (canManageFirm(membership) || (!!booking.lawyer && booking.lawyer.userId === session.userId));

    // --- Client side: acknowledge or dispute a refund the firm says it sent ---
    if (action === 'confirm' || action === 'dispute') {
      if (!isClient) {
        return NextResponse.json(
          { error: 'Only the client can confirm or dispute a refund.' },
          { status: 403 }
        );
      }

      if (booking.refundStatus !== 'PROCESSED') {
        return NextResponse.json(
          { error: 'There is no refund awaiting your confirmation.' },
          { status: 400 }
        );
      }

      if (action === 'dispute' && (!notes || notes.trim().length < 5)) {
        return NextResponse.json(
          { error: 'Tell the firm what happened so they can look into it.' },
          { status: 400 }
        );
      }

      const updatedByClient = await prisma.booking.update({
        where: { id: bookingId },
        data:
          action === 'confirm'
            ? { refundStatus: 'CONFIRMED', refundConfirmedAt: new Date() }
            : {
                refundStatus: 'DISPUTED',
                refundDisputedAt: new Date(),
                refundDisputeReason: notes.trim(),
              },
      });

      return NextResponse.json({
        success: true,
        booking: { id: updatedByClient.id, refundStatus: updatedByClient.refundStatus },
      });
    }

    // --- Firm side: record that the refund was made, or decline it ---
    // Not platform staff: recording that a practice returned, or kept, a client's
    // money is the practice's statement about its own account (rule 2).
    if (!isPractice) {
      return NextResponse.json(
        { error: 'Only the practice that received the fee can record this refund.' },
        { status: 403 }
      );
    }

    if (booking.refundStatus !== 'PENDING' && booking.refundStatus !== 'DISPUTED') {
      return NextResponse.json({ error: 'This booking has no refund outstanding' }, { status: 400 });
    }

    const actor = membership?.role === 'FIRM_ADMIN' ? 'practice manager' : 'practice';

    if (action === 'decline') {
      if (!notes || notes.trim().length < 5) {
        return NextResponse.json(
          { error: 'Give the client a reason for declining the refund.' },
          { status: 400 }
        );
      }

      const declined = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          refundStatus: 'DECLINED',
          refundProcessedAt: new Date(),
          refundNotes: `${notes.trim()} (recorded by ${actor})`,
        },
      });

      await EmailService.sendRefundDeclined(
        booking.client.email,
        booking.client.fullName || 'Client',
        booking.bookingNumber,
        notes.trim()
      );

      return NextResponse.json({
        success: true,
        booking: { id: declined.id, refundStatus: declined.refundStatus },
      });
    }

    // action === 'process' — the firm says it has returned the money.
    // Evidence is required: an unsupported claim is not a record.
    const { method, reference, proofUrl, sentOn } = body;

    if (typeof method !== 'string' || method.trim().length < 2) {
      return NextResponse.json(
        { error: 'Record how the refund was sent (e.g. bank transfer).' },
        { status: 400 }
      );
    }

    if (typeof reference !== 'string' || reference.trim().length < 3) {
      return NextResponse.json(
        { error: 'Record the transaction reference from your bank, so the client can match it.' },
        { status: 400 }
      );
    }

    if (typeof sentOn !== 'string' || Number.isNaN(Date.parse(sentOn))) {
      return NextResponse.json({ error: 'Record the date you sent the refund.' }, { status: 400 });
    }

    // How much the practice returned. What the client paid is recorded as owed
    // in full; the practice may return less under its own terms with the client,
    // and must say why — the client is shown the reason and can dispute it.
    const owed = booking.totalAmount;
    const refunded = body.amount === undefined ? owed : Number(body.amount);
    if (!Number.isInteger(refunded) || refunded < 1 || refunded > owed) {
      return NextResponse.json(
        { error: `Enter the amount you refunded, between 1 and ${owed}.` },
        { status: 400 }
      );
    }
    if (refunded < owed && (!notes || notes.trim().length < 10)) {
      return NextResponse.json(
        { error: 'You refunded less than the client paid. Say why - the client is shown your reason.' },
        { status: 400 }
      );
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        refundStatus: 'PROCESSED',
        refundProcessedAt: new Date(),
        refundAmount: refunded,
        retainedLawyerFee: owed - refunded,
        refundMethod: method.trim(),
        refundReference: reference.trim(),
        refundProofUrl: typeof proofUrl === 'string' && proofUrl ? proofUrl : null,
        refundSentOn: sentOn,
        refundNotes: notes?.trim()
          ? `${notes.trim()} (recorded by ${actor})`
          : `Refund returned to the client (recorded by ${actor})`,
        // A dispute is cleared by a fresh, evidenced record.
        refundDisputedAt: null,
        refundDisputeReason: null,
      },
    });

    await EmailService.sendRefundProcessed(
      booking.client.email,
      booking.client.fullName || 'Client',
      booking.bookingNumber,
      refunded
    );

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
