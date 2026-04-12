import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

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

  try {
    const body = await req.json();
    const { status, remark, adminNotes } = body;

    // Update invoice status
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        adminNotes: adminNotes || remark,
        updatedAt: new Date(),
      },
      include: {
        remarks: true,
        subscription: true,
      },
    });

    // Add remark if provided
    if (remark) {
      await prisma.invoiceRemark.create({
        data: {
          invoiceId,
          remark,
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

