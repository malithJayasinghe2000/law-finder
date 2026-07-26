import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    // Check if authorized
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pagination & filter params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const filter = searchParams.get('filter') || 'all';
    const skip = (page - 1) * limit;

    // Get lawyer profile
    const lawyerProfile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!lawyerProfile) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    // Determine status filter
    let statusFilter: any = undefined;
    if (filter === 'actionable') {
      statusFilter = { in: ['PENDING', 'RESUBMIT', 'UNPAID'] };
    } else if (filter === 'history') {
      statusFilter = { in: ['PAID', 'CANCELLED'] };
    }

    const whereClause: any = {
      lawyerId: lawyerProfile.id,
    };
    
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    // Get invoices for this lawyer
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
