import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { BankTransferPaymentSchema, AdminVerifyPaymentSchema } from '@/schemas/consultation.schema';
import { EmailService } from '@/lib/email/EmailService';

// POST: Submit payment for a booking
export async function POST(
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

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.clientId !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      return NextResponse.json({ error: 'Payment already submitted or booking is not in payment pending state' }, { status: 400 });
    }

    const method = body.method as string;

    if (method === 'BANK_TRANSFER') {
      const validated = BankTransferPaymentSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
      }

      const payment = await prisma.bookingPayment.create({
        data: {
          bookingId: id,
          amount: booking.totalAmount,
          method: 'BANK_TRANSFER',
          status: 'PENDING',
          bankName: validated.data.bankName,
          accountHolder: validated.data.accountHolder,
          transactionRef: validated.data.transactionRef,
          receiptImageUrl: validated.data.receiptImageUrl,
        },
      });

      return NextResponse.json({
        success: true,
        payment,
        message: 'Payment receipt submitted. Your booking will be confirmed once admin verifies the payment.',
      }, { status: 201 });

    } else if (method === 'PAYHERE') {
      // Generate PayHere payment hash and return checkout data
      // Client will redirect to PayHere and webhook will handle confirmation
      const orderId = `BOOK-${booking.bookingNumber}-${Date.now()}`;

      // Create pending payment record
      const payment = await prisma.bookingPayment.create({
        data: {
          bookingId: id,
          amount: booking.totalAmount,
          method: 'PAYHERE',
          status: 'PENDING',
          payhereOrderId: orderId,
        },
      });

      // Return PayHere checkout data
      const merchantId = process.env.PAYHERE_MERCHANT_ID || '';
      const currency = 'LKR';

      return NextResponse.json({
        success: true,
        payment,
        payhere: {
          merchantId,
          orderId,
          amount: (booking.totalAmount / 100).toFixed(2), // Convert from cents if needed
          currency,
          items: `Legal Consultation - ${booking.bookingNumber}`,
          returnUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/en/dashboard/client/consultations?payment=success&bookingId=${id}`,
          cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/en/dashboard/client/consultations?payment=cancelled&bookingId=${id}`,
          notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/consultations/bookings/${id}/payment/webhook`,
        },
      }, { status: 201 });

    } else {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }
  } catch (error) {
    console.error('Payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Admin verify/reject payment
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = AdminVerifyPaymentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { 
        payment: true,
        client: { select: { fullName: true, email: true } },
        lawyer: { select: { fullName: true, user: { select: { email: true } } } }
      },
    });

    if (!booking || !booking.payment) {
      return NextResponse.json({ error: 'Booking or payment not found' }, { status: 404 });
    }

    // Update payment status
    await prisma.bookingPayment.update({
      where: { id: booking.payment.id },
      data: {
        status: validated.data.status as any,
        adminNotes: validated.data.adminNotes,
        verifiedBy: session.userId,
        verifiedAt: new Date(),
      },
    });

    // If payment approved, confirm the booking
    if (validated.data.status === 'PAID') {
      let meetingLink = booking.meetingLink;
      
      if (!meetingLink && (booking.mode === 'ONLINE' || booking.mode === 'BOTH')) {
        const { createMeetingLink } = await import('@/lib/meetings/googleMeet');
        meetingLink = createMeetingLink(
          booking.bookingNumber,
          booking.lawyer.fullName,
          booking.client.fullName || 'Client'
        );
      }

      await prisma.booking.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          paidAt: new Date(),
          meetingLink,
        },
      });

      // Send emails
      await EmailService.sendBookingConfirmationClient(
        booking.client.email,
        booking.client.fullName || 'Client',
        booking.lawyer.fullName,
        booking.date.toISOString().split('T')[0],
        booking.startTime,
        meetingLink || undefined
      );

      if (booking.lawyer.user?.email) {
        await EmailService.sendBookingConfirmationLawyer(
          booking.lawyer.user.email,
          booking.lawyer.fullName,
          booking.client.fullName || 'Client',
          booking.date.toISOString().split('T')[0],
          booking.startTime,
          booking.mode
        );
      }
    }

    // If resubmit or cancelled, update booking accordingly
    if (validated.data.status === 'CANCELLED') {
      await prisma.booking.update({
        where: { id },
        data: {
          status: 'CANCELLED_BY_CLIENT',
          cancelReason: 'Payment rejected by admin',
          cancelledAt: new Date(),
        },
      });
      
      await EmailService.sendBookingCancellation(
        booking.client.email,
        booking.client.fullName || 'Client',
        booking.bookingNumber,
        'Payment rejected by admin'
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
