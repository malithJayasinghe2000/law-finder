import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let pendingInvoicesCount = 0;
    let pendingAdCampaignsCount = 0;

    if (session.role === 'LAWYER') {
      const lawyerProfile = await prisma.lawyerProfile.findUnique({
        where: { userId: session.userId },
      });

      if (lawyerProfile) {
        pendingInvoicesCount = await prisma.invoice.count({
          where: {
            lawyerId: lawyerProfile.id,
            status: { in: ['UNPAID', 'PENDING', 'RESUBMIT'] },
          },
        });
      }
    } else if (session.role === 'ADMIN') {
      pendingAdCampaignsCount = await prisma.adCampaign.count({
        where: {
          status: 'PENDING_REVIEW',
        },
      });
      // No count of clients' bank transfers: checking a client's payment is the
      // practice's job, never the platform's (rule 2).
    }

    return NextResponse.json({
      pendingInvoicesCount,
      pendingAdCampaignsCount,
    });
  } catch (error) {
    console.error('Error fetching sidebar counts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
