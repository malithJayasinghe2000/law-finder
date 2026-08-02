import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { BankTransferPaymentSchema } from '@/schemas/consultation.schema';
import { EmailService } from '@/lib/email/EmailService';

/**
 * Payment notification.
 *
 * The client pays the FIRM directly, into the account given on the accepted
 * quote. This endpoint only lets the client tell the firm they have paid and
 * attach a reference — the platform never receives, holds, or verifies the money.
 *
 * The firm confirms receipt via
 *   PATCH /api/consultations/bookings/[id]  { action: 'confirm_payment_received' }
 * which is what actually moves the request to SCHEDULED. Admin verification was
 * removed: platform staff cannot see a transfer into a firm's own account, and
 * have no business adjudicating it.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 2 and 7).
 */
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
      include: {
        payment: true,
        client: { select: { email: true, fullName: true } },
        lawyer: { select: { fullName: true, user: { select: { email: true } } } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (booking.clientId !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Payment is only meaningful once terms have been accepted.
    if (booking.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'You can only record a payment once you have accepted the firm’s quote.' },
        { status: 400 }
      );
    }

    const validated = BankTransferPaymentSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

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

    const payment = await prisma.bookingPayment.upsert({
      where: { bookingId: id },
      update: paymentData,
      create: { bookingId: id, ...paymentData },
    });

    // The booking status does not change here — only the firm confirming receipt
    // can move it forward.
    EmailService.sendPaymentSubmittedClient(
      booking.client.email,
      booking.client.fullName || 'Client',
      booking.bookingNumber
    );

    return NextResponse.json(
      {
        success: true,
        payment,
        message:
          'Payment details recorded. Your consultation will be confirmed once the firm verifies the payment has reached their account.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Payment notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
