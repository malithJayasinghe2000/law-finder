import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CancelBookingSchema, CompleteBookingSchema, BookingRatingSchema } from '@/schemas/consultation.schema';
import { formatSriLankaDateIso } from '@/lib/utils';
import { EmailService } from '@/lib/email/EmailService';
import { canTransition } from '@/lib/consultations/bookingStatus';

/**
 * Engagement request lifecycle.
 *
 * Phase 1a consolidated the two competing state machines that used to live here:
 * `accept`/`decline` and `approve`/`reject` were separate paths out of the same
 * state doing different things. Triage now happens through dedicated routes:
 *
 *   POST  [id]/conflict-check   firm screens for conflicts
 *   POST  [id]/quotes           firm issues a fee quote
 *   PATCH [id]/quotes           client accepts or declines it
 *
 * What remains here is the lifecycle after terms are agreed.
 * See docs/restructure/ROADMAP.md (Phase 1).
 */

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
        quotes: { orderBy: { version: 'desc' } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

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
        termsAcceptedAt: booking.termsAcceptedAt?.toISOString() || null,
      },
      role: isClient ? 'CLIENT' : isLawyer ? 'LAWYER' : 'ADMIN',
      matterDetailRedacted: redactMatterDetail,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Advance the engagement lifecycle
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
        lawyer: { select: { userId: true, fullName: true, onlineMeetingLink: true, user: { select: { email: true } } } },
        client: { select: { email: true, fullName: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isClient = booking.clientId === session.userId;
    const isLawyer = booking.lawyer.userId === session.userId;
    const isAdmin = session.role === 'ADMIN';

    if (!isClient && !isLawyer && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    /** Reject any transition the state machine does not permit. */
    const guard = (to: Parameters<typeof canTransition>[1]) => {
      if (!canTransition(booking.status, to)) {
        return NextResponse.json(
          { error: `Cannot move a request from "${booking.status}" to "${to}".` },
          { status: 400 }
        );
      }
      return null;
    };

    switch (action) {
      /**
       * The firm confirms the client's payment arrived in the firm's own account.
       * The platform records this; it never receives or verifies the money.
       * See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
       */
      case 'confirm_payment_received': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the firm can confirm payment' }, { status: 403 });
        }

        const blocked = guard('SCHEDULED');
        if (blocked) return blocked;

        const meetingLink =
          booking.meetingLink ||
          (booking.mode !== 'PHYSICAL' ? booking.lawyer.onlineMeetingLink : null);

        const updated = await prisma.booking.update({
          where: { id },
          data: { status: 'SCHEDULED', paidAt: new Date(), meetingLink },
        });

        await EmailService.sendBookingConfirmationClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.lawyer.fullName,
          formatSriLankaDateIso(booking.date),
          booking.startTime,
          meetingLink || undefined,
          booking.mode === 'PHYSICAL' ? booking.officeAddress || undefined : undefined
        );

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
        });
      }

      case 'cancel': {
        const to = isClient ? 'CANCELLED_BY_CLIENT' : 'CANCELLED_BY_FIRM';
        const blocked = guard(to);
        if (blocked) return blocked;

        const validated = CancelBookingSchema.safeParse(body);
        if (!validated.success) {
          return NextResponse.json({ error: validated.error.format() }, { status: 400 });
        }

        // Refund the client is owed under the cancellation policy. The firm holds
        // the money, so the firm returns it — the platform only records the
        // amount. See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
        let refundAmount = 0;
        let retainedLawyerFee = 0;

        if (booking.paidAt) {
          const bookingDateTime = new Date(
            `${formatSriLankaDateIso(booking.date)}T${booking.startTime}:00+05:30`
          );
          const hoursUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

          if (isLawyer || isAdmin || hoursUntil >= 24) {
            // Firm cancels, or client cancels with 24h+ notice: full refund
            refundAmount = booking.totalAmount;
          } else {
            // Client cancels inside 24h: firm retains half
            refundAmount = Math.round(booking.totalAmount * 0.5);
            retainedLawyerFee = booking.totalAmount - refundAmount;
          }
        }

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: to,
            cancelledAt: new Date(),
            cancelledBy: session.userId,
            cancelReason: validated.data.reason,
            refundAmount,
            retainedLawyerFee,
            refundStatus: refundAmount > 0 ? 'PENDING' : 'NONE',
          },
        });

        const reasonPrefix = isClient ? '' : isLawyer ? 'Cancelled by the firm: ' : 'Cancelled by admin: ';
        await EmailService.sendBookingCancelledClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.bookingNumber,
          `${reasonPrefix}${validated.data.reason}`,
          refundAmount
        );

        if (!isLawyer && booking.lawyer.user?.email) {
          await EmailService.sendBookingCancelledLawyer(
            booking.lawyer.user.email,
            booking.lawyer.fullName,
            booking.bookingNumber,
            booking.client.fullName || 'Client'
          );
        }

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
          refundAmount,
        });
      }

      case 'complete': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the firm can mark a consultation complete' }, { status: 403 });
        }

        const blocked = guard('COMPLETED');
        if (blocked) return blocked;

        const validated = CompleteBookingSchema.safeParse(body);
        if (!validated.success) {
          return NextResponse.json({ error: validated.error.format() }, { status: 400 });
        }

        const updated = await prisma.booking.update({
          where: { id },
          data: { status: 'COMPLETED', lawyerNotes: validated.data.lawyerNotes },
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

      case 'no_show': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the firm can record a no-show' }, { status: 403 });
        }

        const blocked = guard('NO_SHOW');
        if (blocked) return blocked;

        const updated = await prisma.booking.update({
          where: { id },
          data: { status: 'NO_SHOW', lawyerRemarks: body.remarks || 'Client did not attend' },
        });

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
          return NextResponse.json({ error: 'Can only rate completed consultations' }, { status: 400 });
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

      case 'reschedule': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the firm can propose a new time' }, { status: 403 });
        }

        const blocked = guard('RESCHEDULE_REQUESTED');
        if (blocked) return blocked;

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

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
        });
      }

      case 'accept_reschedule': {
        if (!isClient) {
          return NextResponse.json({ error: 'Only the client can accept a new time' }, { status: 403 });
        }

        const blocked = guard('SCHEDULED');
        if (blocked) return blocked;

        if (!booking.rescheduleProposedDate || !booking.rescheduleProposedTime) {
          return NextResponse.json({ error: 'No reschedule was proposed' }, { status: 400 });
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
            status: 'SCHEDULED',
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

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
        });
      }

      case 'decline_reschedule': {
        if (!isClient) {
          return NextResponse.json({ error: 'Only the client can decline a new time' }, { status: 403 });
        }

        const blocked = guard('CANCELLED_BY_CLIENT');
        if (blocked) return blocked;

        // Only refund what was actually paid.
        const refundDue = booking.paidAt ? booking.totalAmount : 0;

        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'CANCELLED_BY_CLIENT',
            cancelReason: 'Client declined the new time proposed by the firm',
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
          'Reschedule declined by client',
          refundDue
        );

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIso(updated.date) },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Booking lifecycle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
