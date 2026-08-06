import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getFirmMembership } from '@/lib/firms/access';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pagination & filter params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const filter = searchParams.get('filter') || 'all';
    const skip = (page - 1) * limit;

    // These are the FIRM's software invoices, not one attorney's. Scoping by
    // `lawyerId` — who happened to raise the invoice — hid the practice's own
    // bills from everyone else in it, and hid them from everyone once a practice
    // manager raised one, since `lawyerId` is then null.
    const membership = await getFirmMembership(session.userId);

    if (!membership) {
      return NextResponse.json({ error: 'You do not belong to a firm.' }, { status: 404 });
    }

    // Determine status filter
    let statusFilter: any = undefined;
    if (filter === 'actionable') {
      statusFilter = { in: ['PENDING', 'RESUBMIT', 'UNPAID'] };
    } else if (filter === 'history') {
      statusFilter = { in: ['PAID', 'CANCELLED'] };
    }

    const whereClause: any = {
      firmId: membership.firmId,
    };

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    // Get invoices for this firm
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        include: {
          plan: true,
          subscription: true,
          remarks: {
            orderBy: { createdAt: 'desc' },
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.invoice.count({
        where: whereClause,
      }),
    ]);

    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice.id,
      planId: invoice.planId,
      planName: invoice.plan?.name || 'N/A',
      amount: invoice.amount,
      status: invoice.status,
      paymentReason: invoice.paymentReason,
      paymentDetails: invoice.paymentDetails,
      receiptImageUrl: invoice.receiptImageUrl,
      adminNotes: invoice.adminNotes,
      remarks: invoice.remarks,
      subscriptionStatus: invoice.subscription?.status || 'INACTIVE',
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    }));

    return NextResponse.json(
      {
        invoices: formattedInvoices,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
