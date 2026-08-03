import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CancelBookingSchema, CompleteBookingSchema, BookingRatingSchema } from '@/schemas/consultation.schema';
import { formatSriLankaDateIso, formatSriLankaDateIsoOrNull } from '@/lib/utils';
import { EmailService } from '@/lib/email/EmailService';
import { canTransition } from '@/lib/consultations/bookingStatus';
import { getMatterAccess, redactMatter } from '@/lib/firms/access';

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

    // Legal professional privilege (Evidence Ordinance s.126).
    //
    // Since Phase 2 this is not a simple client/lawyer/admin split: a firm has
    // members, and only some of them may read what the client wrote. The whole
    // decision lives in src/lib/firms/access.ts.
    // See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
    const access = await getMatterAccess({
      actorUserId: session.userId,
      actorRole: session.role,
      actorProfileId: session.profileId,
      matter: {
        lawyerId: booking.lawyerId,
        firmId: booking.firmId,
        clientId: booking.clientId,
      },
    });

    if (!access.canRead) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const isClient = access.basis === 'CLIENT';
    const isLawyer = booking.lawyer?.userId === session.userId;

    return NextResponse.json({
      booking: {
        ...redactMatter(booking, access),
        // Null until an appointment exists — a firm-first request has none until
        // the firm assigns an attorney and proposes a time with its quote.
        date: formatSriLankaDateIsoOrNull(booking.date),
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        paidAt: booking.paidAt?.toISOString() || null,
        cancelledAt: booking.cancelledAt?.toISOString() || null,
        termsAcceptedAt: booking.termsAcceptedAt?.toISOString() || null,
      },
      role: isClient ? 'CLIENT' : isLawyer ? 'LAWYER' : session.role === 'ADMIN' ? 'ADMIN' : 'FIRM',
      matterDetailRedacted: !access.canReadMatterDetail,
      access: {
        canReadMatterDetail: access.canReadMatterDetail,
        canAct: access.canAct,
        canAssign: access.canAssign,
        basis: access.basis,
      },
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
    // Only the attorney with responsibility for the matter may act on it. A
    // principal can reassign it (see [id]/assign) but does not quote or
    // conflict-check on a colleague's behalf — the attorney who will do the work
    // is the one who must screen for conflicts and set the fee.
    //
    // `booking.lawyer` is null while the matter sits unassigned in the firm's
    // queue, so nobody is the acting attorney yet.
    const isLawyer = !!booking.lawyer && booking.lawyer.userId === session.userId;
    const isAdmin = session.role === 'ADMIN';

    if (!isClient && !isLawyer && !isAdmin) {
      const access = await getMatterAccess({
        actorUserId: session.userId,
        actorRole: session.role,
        actorProfileId: session.profileId,
        matter: {
          lawyerId: booking.lawyerId,
          firmId: booking.firmId,
          clientId: booking.clientId,
        },
      });

      if (access.canAssign) {
        return NextResponse.json(
          {
            error:
              'This matter is assigned to another attorney at your firm. Reassign it to yourself first if you intend to act on it.',
          },
          { status: 403 }
        );
      }

      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Display values for notifications. A matter can legitimately have no
    // appointment yet (firm-first intake), so these must never assume one.
    const attorneyName = booking.lawyer?.fullName ?? 'your attorney';
    const attorneyEmail = booking.lawyer?.user?.email ?? null;
    const scheduleDate = booking.date ? formatSriLankaDateIso(booking.date) : 'To be arranged';
    const scheduleStart = booking.startTime ?? '—';

    /**
     * Actions that only make sense once an appointment exists.
     *
     * Everything after ACCEPTED works on a real date and time. Rather than
     * scattering null checks through the switch, refuse early and clearly.
     */
    const requiresAppointment = () => {
      if (!booking.date || !booking.startTime || !booking.endTime) {
        return NextResponse.json(
          {
            error:
              'This matter does not have an appointment yet. The firm proposes a date and time with its fee quote.',
          },
          { status: 400 }
        );
      }
      return null;
    };

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
        // A matter with no appointment cannot reach this action.
        const noAppointment = requiresAppointment();
        if (noAppointment) return noAppointment;
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the firm can confirm payment' }, { status: 403 });
        }

        const blocked = guard('SCHEDULED');
        if (blocked) return blocked;

        // Where the client owes a transfer, they must have recorded it first —
        // otherwise the firm would be confirming a payment with nothing to check
        // against. PAY_AT_OFFICE has nothing to record in advance.
        if (booking.paymentMethod !== 'PAY_AT_OFFICE') {
          const payment = await prisma.bookingPayment.findUnique({
            where: { bookingId: id },
            select: { id: true },
          });

          if (!payment) {
            return NextResponse.json(
              { error: 'The client has not recorded a payment yet. There is nothing to confirm.' },
              { status: 400 }
            );
          }

          await prisma.bookingPayment.update({
            where: { bookingId: id },
            data: {
              status: 'PAID',
              verifiedBy: session.userId,
              verifiedAt: new Date(),
              adminNotes: typeof body.notes === 'string' ? body.notes : undefined,
            },
          });
        }

        const meetingLink =
          booking.meetingLink ||
          (booking.mode !== 'PHYSICAL' ? booking.lawyer?.onlineMeetingLink ?? null : null);

        const updated = await prisma.booking.update({
          where: { id },
          data: { status: 'SCHEDULED', paidAt: new Date(), meetingLink },
        });

        await EmailService.sendBookingConfirmationClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          attorneyName,
          scheduleDate,
          scheduleStart,
          meetingLink || undefined,
          booking.mode === 'PHYSICAL' ? booking.officeAddress || undefined : undefined
        );

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIsoOrNull(updated.date) },
        });
      }

      /**
       * The firm reviewed the payment the client recorded and it does not match —
       * wrong amount, unreadable receipt, never arrived. The request stays in
       * ACCEPTED so the client can correct and resubmit.
       */
      case 'reject_payment': {
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the firm can reject a payment' }, { status: 403 });
        }

        if (booking.status !== 'ACCEPTED') {
          return NextResponse.json(
            { error: 'Only a payment on an accepted engagement can be rejected.' },
            { status: 400 }
          );
        }

        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (reason.length < 5) {
          return NextResponse.json(
            { error: 'Tell the client what was wrong so they can correct it.' },
            { status: 400 }
          );
        }

        await prisma.bookingPayment.update({
          where: { bookingId: id },
          data: { status: 'RESUBMIT', adminNotes: reason, verifiedBy: session.userId, verifiedAt: new Date() },
        });

        await EmailService.sendPaymentResubmitClient(
          booking.client.email,
          booking.client.fullName || 'Client',
          booking.bookingNumber,
          reason
        );

        return NextResponse.json({ success: true });
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
            `${scheduleDate}T${booking.startTime}:00+05:30`
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

        if (!isLawyer && attorneyEmail) {
          await EmailService.sendBookingCancelledLawyer(
            attorneyEmail,
            attorneyName,
            booking.bookingNumber,
            booking.client.fullName || 'Client'
          );
        }

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIsoOrNull(updated.date) },
          refundAmount,
        });
      }

      case 'complete': {
        // A matter with no appointment cannot reach this action.
        const noAppointment = requiresAppointment();
        if (noAppointment) return noAppointment;
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the firm can mark a consultation complete' }, { status: 403 });
        }

        const blocked = guard('COMPLETED');
        if (blocked) return blocked;

        // A consultation cannot be completed before it has happened. Without this
        // a firm could mark a future booking complete, which would misstate the
        // record and let the client be asked to rate a meeting that never occurred.
        const endsAt = new Date(
          `${scheduleDate}T${booking.endTime}:00+05:30`
        );

        if (endsAt.getTime() > Date.now()) {
          return NextResponse.json(
            {
              error: `This consultation is scheduled for ${scheduleDate} at ${booking.startTime}. It can be marked complete once it has taken place.`,
            },
            { status: 400 }
          );
        }

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
          attorneyName
        );

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIsoOrNull(updated.date) },
        });
      }

      case 'no_show': {
        // A matter with no appointment cannot reach this action.
        const noAppointment = requiresAppointment();
        if (noAppointment) return noAppointment;
        if (!isLawyer && !isAdmin) {
          return NextResponse.json({ error: 'Only the firm can record a no-show' }, { status: 403 });
        }

        const blocked = guard('NO_SHOW');
        if (blocked) return blocked;

        // Same reasoning as 'complete' — a client cannot have missed a
        // consultation that has not started yet.
        const startsAt = new Date(
          `${scheduleDate}T${booking.startTime}:00+05:30`
        );

        if (startsAt.getTime() > Date.now()) {
          return NextResponse.json(
            { error: 'This consultation has not started yet.' },
            { status: 400 }
          );
        }

        const updated = await prisma.booking.update({
          where: { id },
          data: { status: 'NO_SHOW', lawyerRemarks: body.remarks || 'Client did not attend' },
        });

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIsoOrNull(updated.date) },
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
          booking: { ...updated, date: formatSriLankaDateIsoOrNull(updated.date) },
        });
      }

      case 'reschedule': {
        // A matter with no appointment cannot reach this action.
        const noAppointment = requiresAppointment();
        if (noAppointment) return noAppointment;
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
          attorneyName,
          newDate,
          newTime,
          remarks || ''
        );

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIsoOrNull(updated.date) },
        });
      }

      case 'accept_reschedule': {
        // A matter with no appointment cannot reach this action.
        const noAppointment = requiresAppointment();
        if (noAppointment) return noAppointment;
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
        const totalMinutes = sh * 60 + sm + (booking.duration ?? 60);
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
          attorneyName,
          formatSriLankaDateIsoOrNull(updated.date) ?? 'To be arranged',
          `${newStartTime} - ${newEndTime}`
        );

        return NextResponse.json({
          success: true,
          booking: { ...updated, date: formatSriLankaDateIsoOrNull(updated.date) },
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
          booking: { ...updated, date: formatSriLankaDateIsoOrNull(updated.date) },
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
