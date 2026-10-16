import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { LICENSING_ENABLED } from '@/lib/licensing';

export async function GET(req: NextRequest) {
  // Hidden while licensing is off (src/lib/licensing.ts): there is nothing to
  // review, and marking an invoice paid would start a licence nobody can buy.
  if (!LICENSING_ENABLED) {
    return NextResponse.json({ error: 'Licences are not sold yet.' }, { status: 410 });
  }

  try {
    const session = await getSession();

    // Check if authorized as admin
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const skip = (page - 1) * limit;

    // Build filter
    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }

    // Get all invoices with filters, ordered by newest first
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        include: {
          lawyer: {
            include: {
              user: true,
            },
          },
          plan: true,
          subscription: true,
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
      lawyerId: invoice.lawyerId,
      lawyerName: invoice.lawyer?.fullName || 'N/A',
      lawyerEmail: invoice.lawyer?.user?.email || 'N/A',
      planName: invoice.plan?.name || 'N/A',
      amount: invoice.amount,
      status: invoice.status,
      paymentReason: invoice.paymentReason,
      paymentDetails: invoice.paymentDetails,
      receiptImageUrl: invoice.receiptImageUrl,
      adminNotes: invoice.adminNotes,
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
    console.error('Error fetching admin invoices:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
