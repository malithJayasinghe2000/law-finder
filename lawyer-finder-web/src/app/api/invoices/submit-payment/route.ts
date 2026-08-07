import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';
import { getSession } from '@/lib/auth';
import { SubmitPaymentSchema } from '@/schemas/subscription.schema';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = SubmitPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const {
      invoiceId,
      bankName,
      accountHolder,
      accountNumber,
      transactionDate,
      transactionId,
      amount,
      receiptImageUrl,
      notes,
    } = validation.data;

    // The invoice is billed to the FIRM (Phase 3), so access is decided by firm
    // membership. `Invoice.lawyerId` only records who raised it and is null when
    // that was a practice manager, so matching on it would have made an invoice
    // nobody could pay.
    const membership = await getFirmMembership(session.userId);

    if (!membership) {
      return NextResponse.json(
        { error: 'You do not belong to a firm, so there is no invoice to settle.' },
        { status: 404 }
      );
    }

    if (!canManageFirm(membership)) {
      return NextResponse.json(
        { error: 'Only the firm\'s principal or practice manager can settle the firm\'s software invoice.' },
        { status: 403 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        plan: true,
        subscription: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.firmId !== membership.firmId) {
      return NextResponse.json({ error: 'You do not have access to this invoice' }, { status: 403 });
    }

    if (invoice.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot submit payment for cancelled invoice' },
        { status: 400 }
      );
    }

    if (amount < invoice.amount) {
      return NextResponse.json(
        { error: `Amount cannot be lower than the invoice amount of LKR ${invoice.amount}` },
        { status: 400 }
      );
    }

    // Update invoice with payment details
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentDetails: {
          bankName,
          accountHolder,
          accountNumber,
          transactionDate,
          transactionId,
          amount,
          notes,
          submittedAt: new Date().toISOString(),
        },
        receiptImageUrl: receiptImageUrl || null,
        status: 'PENDING', // Changed to PENDING to await admin approval
      },
      include: {
        plan: true,
        subscription: true,
      },
    });

    return NextResponse.json(
      {
        message: 'Payment details submitted successfully',
        invoice: {
          id: updatedInvoice.id,
          status: updatedInvoice.status,
          amount: updatedInvoice.amount,
          planName: updatedInvoice.plan?.name || 'N/A',
          paymentDetails: updatedInvoice.paymentDetails,
          updatedAt: updatedInvoice.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error submitting payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
