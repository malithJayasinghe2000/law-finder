import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { EmailService } from '@/lib/email/EmailService';
import { formatSriLankaDateIso } from '@/lib/utils';
import crypto from 'crypto';

// POST: PayHere payment webhook/notification
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await req.formData();
    
    const merchantId = formData.get('merchant_id') as string;
    const orderId = formData.get('order_id') as string;
    const paymentId = formData.get('payment_id') as string;
    const payhereAmount = formData.get('payhere_amount') as string;
    const payhereCurrency = formData.get('payhere_currency') as string;
    const statusCode = formData.get('status_code') as string;
    const md5sig = formData.get('md5sig') as string;

    // Verify signature
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || '';
    
    // MD5 Signature formula: md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5(merchant_secret))
    // Note: merchant_secret should be MD5 hashed first, capitalized, then appended.
    const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const localSig = crypto
      .createHash('md5')
      .update(merchantId + orderId + payhereAmount + payhereCurrency + statusCode + secretHash)
      .digest('hex')
      .toUpperCase();

    // Check if md5sig matches (optional/relaxed for sandbox testing, but good practice)
    // We can proceed even if signature verification isn't strict in local testing, but let's check it.
    const isSandbox = !process.env.PAYHERE_MERCHANT_SECRET;
    if (!isSandbox && localSig !== md5sig) {
      console.warn('PayHere Signature Verification Failed', { localSig, md5sig });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        payment: true,
        client: { select: { fullName: true, email: true } },
        lawyer: { select: { fullName: true, onlineMeetingLink: true, user: { select: { email: true } } } },
      },
    });

    if (!booking || !booking.payment) {
      return NextResponse.json({ error: 'Booking or payment not found' }, { status: 404 });
    }

    if (statusCode === '2') {
      // Payment Successful
      await prisma.$transaction([
        prisma.bookingPayment.update({
          where: { id: booking.payment.id },
          data: {
            status: 'PAID',
            payherePaymentId: paymentId,
            payhereStatus: 'SUCCESS',
            verifiedAt: new Date(),
          },
        }),
        prisma.booking.update({
          where: { id },
          data: {
            status: 'AWAITING_LAWYER_APPROVAL',
            paidAt: new Date(),
          },
        }),
      ]);

      // Send emails
      await EmailService.sendPaymentApprovedAwaitingLawyerClient(
        booking.client.email,
        booking.client.fullName || 'Client',
        booking.bookingNumber,
        booking.lawyer.fullName
      );

      return NextResponse.json({ success: true, message: 'Payment successfully processed' });
    } else {
      // Payment Failed / Cancelled
      await prisma.bookingPayment.update({
        where: { id: booking.payment.id },
        data: {
          status: 'CANCELLED',
          payhereStatus: `FAILED_CODE_${statusCode}`,
        },
      });

      return NextResponse.json({ success: false, message: 'Payment failed' });
    }
  } catch (error) {
    console.error('PayHere webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
