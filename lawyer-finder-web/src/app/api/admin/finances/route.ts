import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET: Retrieve financial summary and breakdown by lawyer (ADMIN only)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    // 1. Get all paid invoices (subscriptions)
    const paidInvoices = await prisma.invoice.findMany({
      where: { status: 'PAID' },
      select: { id: true, amount: true, paymentReason: true, lawyerId: true, createdAt: true },
    });

    const totalSubscriptionIncome = paidInvoices
      .filter(inv => inv.paymentReason.toLowerCase().includes('subscription') || inv.paymentReason.toLowerCase().includes('plan'))
      .reduce((sum, inv) => sum + inv.amount, 0);

    const totalAdInvoiceIncome = paidInvoices
      .filter(inv => inv.paymentReason.toLowerCase().includes('ad') || inv.paymentReason.toLowerCase().includes('campaign'))
      .reduce((sum, inv) => sum + inv.amount, 0);

    // Income is money received: paid invoices only. This used to take the larger of
    // paid ad invoices and the BUDGETS of approved campaigns, so an approved campaign
    // nobody had paid for showed as revenue (proven 2026-10-16: LKR 250,000 from one
    // unpaid campaign).
    const finalAdIncome = totalAdInvoiceIncome;

    // No client-fee figures. What attorneys earn from their clients is the
    // practice's own business, and a platform that tracks it per attorney is one
    // step from pricing on it (rule 1). It was "informational only"; it is gone.

    // Withdrawal requests were removed in Phase 1a — the platform never holds a
    // lawyer's fees, so there is no balance to pay out.

    // 5. Calculate breakdown per lawyer
    const lawyers = await prisma.lawyerProfile.findMany({
      select: {
        id: true,
        fullName: true,
        baslNumber: true,
        user: { select: { email: true } },
      },
    });

    const lawyerBreakdowns = lawyers.map(lawyer => {
      // Subscriptions paid by this lawyer
      const lawyerSubscriptions = paidInvoices
        .filter((inv: any) => inv.lawyerId === lawyer.id && (inv.paymentReason.toLowerCase().includes('subscription') || inv.paymentReason.toLowerCase().includes('plan')))
        .reduce((sum: number, inv: any) => sum + inv.amount, 0);

      // Per-lawyer ad income was removed in Phase 4: attorneys no longer buy
      // advertising, so there is no such figure. The comparison that used to be
      // here read `c.lawyerId === lawyer.id` against a campaign that now carries
      // an advertiserId — it compiled only because the row was cast to `any`,
      // and would have silently reported zero forever.
      // See docs/restructure/LEGAL-GUARDRAILS.md (rule 3).
      const finalLawyerAdIncome = 0;

      return {
        lawyerId: lawyer.id,
        fullName: lawyer.fullName,
        baslNumber: lawyer.baslNumber,
        email: lawyer.user?.email || '',
        // What this lawyer paid the platform (this IS our revenue)
        subscriptionsPaid: lawyerSubscriptions,
        adsPaid: finalLawyerAdIncome,
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        // Platform revenue. Software licences and advertising only — never a
        // share of any legal fee.
        totalSubscriptionIncome,
        totalAdIncome: finalAdIncome,
        platformTotalIncome: totalSubscriptionIncome + finalAdIncome,
      },
      lawyerBreakdowns,
    });
  } catch (error: any) {
    console.error('Failed to get admin finances:', error);
    return NextResponse.json({ error: 'Could not load the financial report.' }, { status: 500 });
  }
}
