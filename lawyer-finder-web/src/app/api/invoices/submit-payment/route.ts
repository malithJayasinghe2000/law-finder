import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { SubmitPaymentSchema } from '@/schemas/subscription.schema';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // Check if authorized
    if (!session || session.role !== 'LAWYER') {
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

    // Get lawyer profile
    const lawyerProfile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!lawyerProfile) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    // Get invoice and verify it belongs to this lawyer
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

    if (invoice.lawyerId !== lawyerProfile.id) {
      return NextResponse.json({ error: 'You do not have access to this invoice' }, { status: 403 });
    }

    if (invoice.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot submit payment for cancelled invoice' },
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
