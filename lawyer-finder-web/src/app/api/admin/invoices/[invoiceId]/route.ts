import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidUUID, sanitizeString } from '@/lib/security';
import { EmailService } from '@/lib/email/EmailService';

// ── Invoice Update Schema ─────────────────────────────────────────────────
const AdminUpdateInvoiceSchema = z.object({
  status: z.enum(['PAID', 'PENDING', 'RESUBMIT', 'CANCELLED'] as const),
  remark: z.string().trim().max(1000, 'Remark cannot exceed 1000 characters.').optional(),
  adminNotes: z.string().trim().max(1000, 'Admin notes cannot exceed 1000 characters.').optional(),
  paymentDetails: z.any().optional(),
  receiptImageUrl: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;
  const session = await getSession();

  // Verify admin
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate invoiceId format
  if (!isValidUUID(invoiceId)) {
    return NextResponse.json({ error: 'Invalid invoice ID.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = AdminUpdateInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid update data.' },
        { status: 400 }
      );
    }

    const { status, remark, adminNotes, paymentDetails, receiptImageUrl } = parsed.data;
    const sanitizedRemark = remark ? sanitizeString(remark, 1000) : undefined;
    const sanitizedNotes = adminNotes ? sanitizeString(adminNotes, 1000) : sanitizedRemark;

    // Update invoice status
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        adminNotes: sanitizedNotes,
        updatedAt: new Date(),
        ...(paymentDetails ? { paymentDetails } : {}),
        ...(receiptImageUrl ? { receiptImageUrl } : {}),
      },
      include: {
        remarks: true,
        subscription: true,
      },
    });

    // Add remark if provided
    if (sanitizedRemark) {
      await prisma.invoiceRemark.create({
        data: {
          invoiceId,
          remark: sanitizedRemark,
          isForLawyer: true,
        },
      });
    }

    // Handle subscription status based on invoice action
    // Find subscription linked to this invoice
    const linkedSubscription = await prisma.subscription.findFirst({
      where: { invoiceId },
    });

    if (linkedSubscription) {
      if (status === 'PAID') {
        // Activate subscription when payment is approved
        await prisma.subscription.update({
          where: { id: linkedSubscription.id },
          data: { status: 'ACTIVE' },
        });
      } else if (status === 'CANCELLED') {
        // Cancel subscription when invoice is rejected
        await prisma.subscription.update({
          where: { id: linkedSubscription.id },
          data: { status: 'CANCELED', autoRenew: false },
        });
      } else if (status === 'RESUBMIT') {
        // Keep subscription as PAST_DUE for resubmission
        await prisma.subscription.update({
          where: { id: linkedSubscription.id },
          data: { status: 'PAST_DUE' },
        });
      }
    }

    // Handle Ad Campaign status based on invoice action
    const linkedCampaign = await prisma.adCampaign.findFirst({
      where: { invoiceId },
    });

    if (linkedCampaign) {
      if (status === 'PAID') {
        await prisma.adCampaign.update({
          where: { id: linkedCampaign.id },
          data: { status: 'ACTIVE' },
        });
      } else if (status === 'CANCELLED') {
        await prisma.adCampaign.update({
          where: { id: linkedCampaign.id },
          data: { status: 'REJECTED', rejectionReason: 'Invoice cancelled or rejected.' },
        });
      }
    }

    if (status === 'PAID') {
      const fullInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lawyer: {
            include: {
              user: true,
            },
          },
        },
      });

      if (fullInvoice?.lawyer?.user?.email) {
        EmailService.sendInvoicePaidReceipt(
          fullInvoice.lawyer.user.email,
          fullInvoice.lawyer.user.fullName || 'Valued Lawyer',
          invoiceId,
          fullInvoice.amount,
          fullInvoice.paymentReason
        ).catch(err => console.error('Failed to send invoice receipt email:', err));
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[ADMIN_INVOICE_UPDATE]', error instanceof Error ? error.message : 'Failed');
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}
