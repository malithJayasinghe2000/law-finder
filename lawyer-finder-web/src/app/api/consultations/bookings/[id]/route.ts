import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CancelBookingSchema, CompleteBookingSchema, BookingRatingSchema } from '@/schemas/consultation.schema';
import { formatSriLankaDateIso } from '@/lib/utils';

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

    return NextResponse.json({
      booking: {
        ...booking,
        date: formatSriLankaDateIso(booking.date),
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        paidAt: booking.paidAt?.toISOString() || null,
        cancelledAt: booking.cancelledAt?.toISOString() || null,
      },
      role: isClient ? 'CLIENT' : isLawyer ? 'LAWYER' : 'ADMIN',
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
        lawyer: { select: { userId: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isClient = booking.clientId === session.userId;
    const isLawyer = booking.lawyer.userId === session.userId;
    const isAdmin = session.role === 'ADMIN';

    switch (action) {
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

        // Calculate refund and retained fees based on cancellation policy
        let refundAmount = 0;
        let retainedLawyerFee = 0;
        let retainedPlatformFee = 0;

        if (booking.status === 'CONFIRMED') {
          const bookingDateTime = new Date(`${formatSriLankaDateIso(booking.date)}T${booking.startTime}:00+05:30`);
          const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

          if (isLawyer || isAdmin) {
            // Lawyer cancellation = full refund
            refundAmount = booking.totalAmount;
          } else if (hoursUntilBooking >= 24) {
            // Client cancels 24+ hrs before = full refund
            refundAmount = booking.totalAmount;
          } else {
            // Client cancels <24 hrs = 50% refund, 50% retained split evenly between lawyer & platform
            refundAmount = Math.round(booking.totalAmount * 0.5);
            retainedLawyerFee = Math.round(booking.lawyerFee * 0.5);
            retainedPlatformFee = Math.round(booking.platformFee * 0.5);
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

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
