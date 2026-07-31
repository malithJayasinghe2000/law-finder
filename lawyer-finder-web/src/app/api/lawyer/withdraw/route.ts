import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * LEGACY — withdrawals are being retired.
 *
 * The platform previously held consultation fees and paid lawyers out on request.
 * A non-lawyer platform holding funds owed to an attorney for legal work is not
 * something we can do: it sits outside the attorney client-account rules, and
 * holding/settling customer funds engages the Payments and Settlements Systems
 * Act No. 28 of 2005 (CBSL authorisation) plus AML/KYC duties under the Financial
 * Transactions Reporting Act No. 6 of 2006.
 *
 * Clients now pay lawyers directly. There is no platform balance.
 *
 * GET is retained read-only so existing requests stay visible for reconciliation.
 * POST is closed — no new withdrawal requests can be created.
 *
 * Current income view: /api/lawyer/consultations/income
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized. Lawyer access required.' }, { status: 401 });
    }

    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    const withdrawals = await prisma.withdrawRequest.findMany({
      where: { lawyerId: lawyer.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      retired: true,
      message:
        'Withdrawals have been retired. Clients now pay you directly using the bank details you provide when quoting, so the platform holds no balance on your behalf. Any requests below are historical.',
      withdrawals,
    });
  } catch (error: unknown) {
    console.error('Failed to load legacy withdrawals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Withdrawals are no longer available. The platform does not hold your consultation fees — clients pay you directly using the bank details you provide when you quote a fee. See your consultation income record for a full history.',
      retired: true,
    },
    { status: 410 }
  );
}
