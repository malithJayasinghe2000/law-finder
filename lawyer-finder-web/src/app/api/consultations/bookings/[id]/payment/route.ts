import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { BankTransferPaymentSchema, AdminVerifyPaymentSchema } from '@/schemas/consultation.schema';
import { EmailService } from '@/lib/email/EmailService';
import { formatSriLankaDateIso } from '@/lib/utils';

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
      include: { payment: true, client: { select: { email: true, fullName: true } } },
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

      // Use transaction to create or update payment and update booking status
      const paymentData = {
        amount: booking.totalAmount,
        method: 'BANK_TRANSFER' as const,
        status: 'PENDING' as const,
        bankName: validated.data.bankName,
        accountHolder: validated.data.accountHolder,
        accountNumber: validated.data.accountNumber,
        transactionDate: validated.data.transactionDate,
        transactionRef: validated.data.transactionRef,
        receiptImageUrl: validated.data.receiptImageUrl,
        notes: validated.data.notes,
      };

      const [payment] = await prisma.$transaction([
        prisma.bookingPayment.upsert({
          where: { bookingId: id },
          update: paymentData,
          create: {
            bookingId: id,
            ...paymentData,
          },
        }),
        prisma.booking.update({
          where: { id },
          data: { status: 'AWAITING_BANK_TRANSFER_VERIFICATION' },
        })
      ]);

      EmailService.sendPaymentSubmittedClient(booking.client.email, booking.client.fullName || 'Client', booking.bookingNumber);
      
      // We don't have a specific email for lawyer payment verification yet, but we can reuse a generic one or assume the dashboard will notify them.
      // EmailService.sendPaymentVerificationLawyer(booking.lawyer.user.email, booking.lawyer.fullName, booking.bookingNumber, booking.client.fullName || 'Client');

      return NextResponse.json({
        success: true,
        payment,
        message: 'Payment receipt submitted. Your booking will be confirmed once admin verifies the payment.',
      }, { status: 201 });

    } else if (method === 'PAYHERE') {
      // Generate PayHere payment hash and return checkout data
      // Client will redirect to PayHere and webhook will handle confirmation
      const orderId = `BOOK-${booking.bookingNumber}-${Date.now()}`;

      // Create or update pending payment record
      const payment = await prisma.bookingPayment.upsert({
        where: { bookingId: id },
        update: {
          amount: booking.totalAmount,
          method: 'PAYHERE',
          status: 'PENDING',
          payhereOrderId: orderId,
        },
        create: {
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        lawyer: { select: { userId: true, fullName: true, onlineMeetingLink: true, user: { select: { email: true } } } },
      },
    });

    if (!booking || !booking.payment) {
      return NextResponse.json({ error: 'Booking or payment not found' }, { status: 404 });
    }

    const isLawyer = booking.lawyer.userId === session.userId;
    const isAdmin = session.role === 'ADMIN';

    if (!isLawyer && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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
        meetingLink = booking.lawyer.onlineMeetingLink || null;
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
        formatSriLankaDateIso(booking.date),
        booking.startTime,
        meetingLink || undefined,
        booking.mode === 'PHYSICAL' ? booking.officeAddress || undefined : undefined
      );

      if (booking.lawyer.user?.email) {
        await EmailService.sendBookingConfirmationLawyer(
          booking.lawyer.user.email,
          booking.lawyer.fullName,
          booking.client.fullName || 'Client',
          formatSriLankaDateIso(booking.date),
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
      
      await EmailService.sendBookingCancelledClient(
        booking.client.email,
        booking.client.fullName || 'Client',
        booking.bookingNumber,
        'Payment rejected by admin',
        0
      );
    } else if (validated.data.status === 'RESUBMIT') {
      await prisma.booking.update({
        where: { id },
        data: {
          status: 'PENDING_PAYMENT',
        },
      });
      await EmailService.sendPaymentResubmitClient(
        booking.client.email,
        booking.client.fullName || 'Client',
        booking.bookingNumber,
        validated.data.adminNotes || 'Payment receipt was unclear or invalid.'
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
