import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getFirmMembership } from '@/lib/firms/access';
import { getSession } from '@/lib/auth';

/**
 * GET /api/invoices/[id] - Get invoice details
 * PATCH /api/invoices/[id] - Update invoice status (admin only)
 *   When status is 'PAID', automatically activates the linked subscription
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        plan: true,
        subscription: {
          include: { plan: true, role: true },
        },
        remarks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Non-admin can only see invoices billed to their own firm. Matching on
    // `lawyerId` — who raised it — locked out everyone else at the practice, and
    // locked out everyone entirely once a practice manager raised one, since
    // `lawyerId` is null in that case. The firm is the party billed.
    if (session.role !== 'ADMIN') {
      const membership = await getFirmMembership(session.userId);
      if (!membership || invoice.firmId !== membership.firmId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, adminNotes, remark } = body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { plan: true, subscription: true },
    });

    // Add remark if provided
    if (remark) {
      await prisma.invoiceRemark.create({
        data: {
          invoiceId: id,
          remark: remark,
          isForLawyer: true,
        },
      });
    }

    // If status is PAID, activate the linked subscription
    if (status === 'PAID' && invoice.subscription) {
      await prisma.subscription.update({
        where: { id: invoice.subscription.id },
        data: {
          status: 'ACTIVE',
        },
      });
    }

    // If status is CANCELLED, also cancel the linked subscription
    if (status === 'CANCELLED' && invoice.subscription) {
      await prisma.subscription.update({
        where: { id: invoice.subscription.id },
        data: {
          status: 'CANCELED',
          autoRenew: false,
        },
      });
    }

    // If status is RESUBMIT, keep subscription as PAST_DUE
    if (status === 'RESUBMIT' && invoice.subscription) {
      await prisma.subscription.update({
        where: { id: invoice.subscription.id },
        data: {
          status: 'PAST_DUE',
        },
      });
    }

    return NextResponse.json({
      message: `Invoice status updated to ${status}`,
      invoice: updated,
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
