import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CancelBookingSchema, CompleteBookingSchema, BookingRatingSchema } from '@/schemas/consultation.schema';
import { formatSriLankaDateIso } from '@/lib/utils';
import { EmailService } from '@/lib/email/EmailService';

// GET: Get single booking details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, fullName: true, email: true, profileImageUrl: true } },
        lawyer: { select: { id: true, fullName: true, profileImageUrl: true, district: true, address: true, contactPhone: true, userId: true } },
        payment: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Verify access
    const isClient = booking.clientId === session.userId;
    const isLawyer = booking.lawyer.userId === session.userId;
    const isAdmin = session.role === 'ADMIN';

    if (!isClient && !isLawyer && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Legal professional privilege (Evidence Ordinance s.126): withhold the
    // client's account of their matter, and the lawyer's notes on it, from
    // platform staff. See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
    const redactMatterDetail = isAdmin && !isClient && !isLawyer;

    return NextResponse.json({
      booking: {
        ...booking,
        subject: redactMatterDetail ? '[Withheld — privileged]' : booking.subject,
        description: redactMatterDetail ? '[Withheld — privileged]' : booking.description,
        lawyerNotes: redactMatterDetail ? null : booking.lawyerNotes,
        date: formatSriLankaDateIso(booking.date),
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        paidAt: booking.paidAt?.toISOString() || null,
        cancelledAt: booking.cancelledAt?.toISOString() || null,
      },
      role: isClient ? 'CLIENT' : isLawyer ? 'LAWYER' : 'ADMIN',
      matterDetailRedacted: redactMatterDetail,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update booking status (cancel, complete, rate)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const action = body.action as string;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        lawyer: { select: { userId: true, fullName: true, user: { select: { email: true } } } },
        client: { select: { email: true, fullName: true } }
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isClient = booking.clientId === session.userId;
    const isLawyer = booking.lawyer.userId === session.userId;
    const isAdmin = session.role === 'ADMIN';

    switch (action) {
      case 'accept': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the lawyer can accept the request' }, { status: 403 });
        }

        if (booking.status !== 'AWAITING_LAWYER_APPROVAL') {
          return NextResponse.json({ error: 'Only pending requests can be accepted' }, { status: 400 });
        }

        const { fee, paymentMethod, paymentInstructions } = body;
        
        if (typeof fee !== 'number' || fee < 0) {
          return NextResponse.json({ error: 'Valid fee is required' }, { status: 400 });
        }

        if (!['BANK_TRANSFER', 'PAY_AT_OFFICE'].includes(paymentMethod)) {
          return NextResponse.json({ error: 'Valid payment method is required' }, { status: 400 });
        }

        if (paymentMethod === 'BANK_TRANSFER' && !paymentInstructions) {
          return NextResponse.json({ error: 'Payment instructions (bank details) are required for bank transfer' }, { status: 400 });
        }

        // The client pays the lawyer's quoted fee, in full, directly to the lawyer.
        // The platform takes no share of it — not at payment time, and not by
        // invoicing the lawyer afterwards. Deferring a commission does not stop it
        // being a commission. See docs/restructure/LEGAL-GUARDRAILS.md (rule 1).
        const newStatus = paymentMethod === 'PAY_AT_OFFICE' ? 'CONFIRMED' : 'PENDING_PAYMENT';

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: newStatus,
            lawyerFee: fee,
            platformFee: 0,
            totalAmount: fee,
            commissionRate: 0,
            paymentMethod: paymentMethod as any,
            paymentInstructions: paymentMethod === 'BANK_TRANSFER' ? paymentInstructions : null,
          },
        });

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
        });
      }

      case 'decline': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the lawyer can decline the request' }, { status: 403 });
        }

        if (booking.status !== 'AWAITING_LAWYER_APPROVAL') {
          return NextResponse.json({ error: 'Only pending requests can be declined' }, { status: 400 });
        }

        const declineReason = body.reason || 'Lawyer is unavailable';

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'REJECTED_BY_LAWYER',
            cancelReason: declineReason,
            cancelledAt: new Date(),
            cancelledBy: session.userId,
          },
        });

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
        });
      }

      case 'cancel': {
        if (!isClient && !isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
          return NextResponse.json({ error: 'This booking cannot be cancelled' }, { status: 400 });
        }

        const validated = CancelBookingSchema.safeParse(body);
        if (!validated.success) {
          return NextResponse.json({ error: validated.error.format() }, { status: 400 });
        }

        // Calculate the refund the LAWYER owes the client under the cancellation
        // policy. The platform holds no funds, so this is a record of what the
        // lawyer should return directly — the platform never moves the money and
        // retains nothing. See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
        let refundAmount = 0;
        let retainedLawyerFee = 0;
        const retainedPlatformFee = 0;

        // Only a booking that was actually paid can generate a refund.
        if (booking.status === 'CONFIRMED' && booking.paidAt) {
          const bookingDateTime = new Date(`${formatSriLankaDateIso(booking.date)}T${booking.startTime}:00+05:30`);
          const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

          if (isLawyer || isAdmin) {
            // Lawyer cancellation = full refund
            refundAmount = booking.totalAmount;
          } else if (hoursUntilBooking >= 24) {
            // Client cancels 24+ hrs before = full refund
            refundAmount = booking.totalAmount;
          } else {
            // Client cancels <24 hrs = 50% refund; the lawyer retains the other 50%
            refundAmount = Math.round(booking.totalAmount * 0.5);
            retainedLawyerFee = booking.totalAmount - refundAmount;
          }
        }

        const cancelStatus = isLawyer ? 'CANCELLED_BY_LAWYER' : 'CANCELLED_BY_CLIENT';

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: cancelStatus as any,
            cancelledAt: new Date(),
            cancelledBy: session.userId,
            cancelReason: validated.data.reason,
            refundAmount,
            retainedLawyerFee,
            retainedPlatformFee,
            refundStatus: refundAmount > 0 ? 'PENDING' : 'NONE',
          },
        });

        if (isClient) {
          await EmailService.sendBookingCancelledClient(booking.client.email, booking.client.fullName || 'Client', booking.bookingNumber, validated.data.reason, refundAmount);
          if (booking.lawyer.user?.email) {
            await EmailService.sendBookingCancelledLawyer(booking.lawyer.user.email, booking.lawyer.fullName, booking.bookingNumber, booking.client.fullName || 'Client');
          }
        } else if (isLawyer) {
          await EmailService.sendBookingCancelledClient(booking.client.email, booking.client.fullName || 'Client', booking.bookingNumber, `Cancelled by lawyer: ${validated.data.reason}`, refundAmount);
        } else if (isAdmin) {
          await EmailService.sendBookingCancelledClient(booking.client.email, booking.client.fullName || 'Client', booking.bookingNumber, `Cancelled by admin: ${validated.data.reason}`, refundAmount);
          if (booking.lawyer.user?.email) {
            await EmailService.sendBookingCancelledLawyer(booking.lawyer.user.email, booking.lawyer.fullName, booking.bookingNumber, booking.client.fullName || 'Client');
          }
        }

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
          refundAmount,
        });
      }

      case 'complete': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the lawyer can mark as complete' }, { status: 403 });
        }

        if (booking.status !== 'CONFIRMED') {
          return NextResponse.json({ error: 'Only confirmed bookings can be completed' }, { status: 400 });
        }

        const validated = CompleteBookingSchema.safeParse(body);
        if (!validated.success) {
          return NextResponse.json({ error: validated.error.format() }, { status: 400 });
        }

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            lawyerNotes: validated.data.lawyerNotes,
          },
        });

        await EmailService.sendConsultationCompleted(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.lawyer.fullName
        );

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
        });
      }

      case 'rate': {
        if (!isClient) {
          return NextResponse.json({ error: 'Only the client can rate' }, { status: 403 });
        }

        if (booking.status !== 'COMPLETED') {
          return NextResponse.json({ error: 'Can only rate completed bookings' }, { status: 400 });
        }

        const validated = BookingRatingSchema.safeParse(body);
        if (!validated.success) {
          return NextResponse.json({ error: validated.error.format() }, { status: 400 });
        }

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            clientRating: validated.data.rating,
            clientFeedback: validated.data.feedback,
          },
        });

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
        });
      }

      case 'approve': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the lawyer or admin can approve the booking' }, { status: 403 });
        }
        if (booking.status !== 'AWAITING_LAWYER_APPROVAL') {
          return NextResponse.json({ error: 'This booking is not awaiting approval' }, { status: 400 });
        }
        const remarks = body.remarks || '';
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            lawyerRemarks: remarks,
          },
        });
        await EmailService.sendBookingApprovedClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.bookingNumber,
          booking.lawyer.fullName,
          formatSriLankaDateIso(booking.date),
          `${booking.startTime} - ${booking.endTime}`
        );
        return NextResponse.json({ success: true, booking: { ...updated, date: formatSriLankaDateIso(updated.date) } });
      }

      case 'reject': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the lawyer or admin can reject the booking' }, { status: 403 });
        }
        if (booking.status !== 'AWAITING_LAWYER_APPROVAL') {
          return NextResponse.json({ error: 'This booking is not awaiting approval' }, { status: 400 });
        }
        const remarks = body.remarks || 'Rejected by lawyer';
        // A booking awaiting approval has never been paid, so there is nothing to
        // refund. This previously wrote refundAmount + refundStatus PENDING on
        // every rejection, filling the refund queue with refunds for money that
        // was never sent.
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'REJECTED_BY_LAWYER',
            lawyerRemarks: remarks,
          },
        });
        await EmailService.sendBookingRejectedClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.bookingNumber,
          booking.lawyer.fullName,
          remarks
        );
        return NextResponse.json({ success: true, booking: { ...updated, date: formatSriLankaDateIso(updated.date) } });
      }

      case 'reschedule': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the lawyer or admin can reschedule' }, { status: 403 });
        }
        const { newDate, newTime, remarks } = body;
        if (!newDate || !newTime) {
          return NextResponse.json({ error: 'Proposed date and time are required' }, { status: 400 });
        }
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'RESCHEDULE_REQUESTED',
            rescheduleProposedDate: new Date(newDate),
            rescheduleProposedTime: newTime,
            lawyerRemarks: remarks || '',
          },
        });
        await EmailService.sendBookingRescheduledClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.bookingNumber,
          booking.lawyer.fullName,
          newDate,
          newTime,
          remarks || ''
        );
        return NextResponse.json({ success: true, booking: { ...updated, date: formatSriLankaDateIso(updated.date) } });
      }

      case 'accept_reschedule': {
        if (!isClient) {
          return NextResponse.json({ error: 'Only the client can accept the reschedule' }, { status: 403 });
        }
        if (booking.status !== 'RESCHEDULE_REQUESTED' || !booking.rescheduleProposedDate || !booking.rescheduleProposedTime) {
          return NextResponse.json({ error: 'No reschedule requested' }, { status: 400 });
        }
        const newStartTime = booking.rescheduleProposedTime;
        const [sh, sm] = newStartTime.split(':').map(Number);
        const totalMinutes = sh * 60 + sm + booking.duration;
        const eh = Math.floor(totalMinutes / 60) % 24;
        const em = totalMinutes % 60;
        const newEndTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            date: booking.rescheduleProposedDate,
            startTime: newStartTime,
            endTime: newEndTime,
            rescheduleProposedDate: null,
            rescheduleProposedTime: null,
          },
        });
        await EmailService.sendBookingApprovedClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.bookingNumber,
          booking.lawyer.fullName,
          formatSriLankaDateIso(updated.date),
          `${newStartTime} - ${newEndTime}`
        );
        return NextResponse.json({ success: true, booking: { ...updated, date: formatSriLankaDateIso(updated.date) } });
      }

      case 'decline_reschedule': {
        if (!isClient) {
          return NextResponse.json({ error: 'Only the client can decline the reschedule' }, { status: 403 });
        }
        if (booking.status !== 'RESCHEDULE_REQUESTED') {
          return NextResponse.json({ error: 'No reschedule requested' }, { status: 400 });
        }
        // Only refund if the client actually paid.
        const wasPaid = Boolean(booking.paidAt);
        const refundDue = wasPaid ? booking.totalAmount : 0;

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'CANCELLED_BY_CLIENT',
            cancelReason: 'Client declined reschedule proposed by lawyer',
            cancelledAt: new Date(),
            cancelledBy: session.userId,
            refundAmount: refundDue,
            refundStatus: refundDue > 0 ? 'PENDING' : 'NONE',
            rescheduleProposedDate: null,
            rescheduleProposedTime: null,
          },
        });
        await EmailService.sendBookingCancelledClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.bookingNumber,
          'Reschedule request declined by client',
          refundDue
        );
        return NextResponse.json({ success: true, booking: { ...updated, date: formatSriLankaDateIso(updated.date) } });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
