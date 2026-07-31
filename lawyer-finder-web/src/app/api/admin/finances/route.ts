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

    // 2. Get all approved/active/expired ad campaigns as a fallback/additional check
    const adCampaigns = await prisma.adCampaign.findMany({
      where: { status: { in: ['APPROVED', 'ACTIVE', 'EXPIRED'] } },
      select: { totalBudget: true, lawyerId: true },
    });
    const totalAdCampaignBudget = adCampaigns.reduce((sum, c) => sum + (c.totalBudget || 0), 0);

    // We will use the max of paid ad invoices or campaign budgets as ad income, or rely on paid invoices if they exist.
    const finalAdIncome = Math.max(totalAdInvoiceIncome, totalAdCampaignBudget);

    // 3. Consultation fees.
    //
    // These are NOT platform income. The client pays the lawyer directly and the
    // platform takes no share. They are reported here only so admins can see
    // consultation activity on the platform — they must never be added into
    // platform revenue. See docs/restructure/LEGAL-GUARDRAILS.md (rules 1 and 2).
    const paidBookings = await prisma.booking.findMany({
      where: {
        paidAt: { not: null },
        status: { notIn: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_LAWYER', 'PENDING_PAYMENT', 'AWAITING_BANK_TRANSFER_VERIFICATION'] },
      },
      select: {
        id: true,
        lawyerFee: true,
        lawyerId: true,
      },
    });

    // Fees paid by clients directly to lawyers. Platform share is always zero.
    const totalConsultationFeesToLawyers = paidBookings.reduce((sum, b) => sum + b.lawyerFee, 0);

    // 4. Fetch all withdrawal requests
    const withdrawals = await prisma.withdrawRequest.findMany();
    const totalPaidPayouts = withdrawals
      .filter((w: any) => w.status === 'APPROVED')
      .reduce((sum: number, w: any) => sum + w.amount, 0);
    const totalPendingPayouts = withdrawals
      .filter((w: any) => w.status === 'PENDING')
      .reduce((sum: number, w: any) => sum + w.amount, 0);

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

      // Ads paid by this lawyer
      const lawyerAds = paidInvoices
        .filter((inv: any) => inv.lawyerId === lawyer.id && (inv.paymentReason.toLowerCase().includes('ad') || inv.paymentReason.toLowerCase().includes('campaign')))
        .reduce((sum: number, inv: any) => sum + inv.amount, 0);

      const lawyerCampaigns = adCampaigns
        .filter((c: any) => c.lawyerId === lawyer.id)
        .reduce((sum: number, c: any) => sum + (c.totalBudget || 0), 0);

      const finalLawyerAdIncome = Math.max(lawyerAds, lawyerCampaigns);

      // Consultation fees this lawyer collected directly from clients.
      // Informational only — never platform income, and never a platform liability.
      const lawyerBookings = paidBookings.filter((b) => b.lawyerId === lawyer.id);
      const consultationFeesCollected = lawyerBookings.reduce((sum, b) => sum + b.lawyerFee, 0);

      // Legacy withdrawal requests, retained for reconciliation only.
      const lawyerWithdrawals = withdrawals.filter((w) => w.lawyerId === lawyer.id);
      const legacyWithdrawalsPaid = lawyerWithdrawals
        .filter((w) => w.status === 'APPROVED')
        .reduce((sum, w) => sum + w.amount, 0);
      const legacyWithdrawalsPending = lawyerWithdrawals
        .filter((w) => w.status === 'PENDING')
        .reduce((sum, w) => sum + w.amount, 0);

      return {
        lawyerId: lawyer.id,
        fullName: lawyer.fullName,
        baslNumber: lawyer.baslNumber,
        email: lawyer.user?.email || '',
        // What this lawyer paid the platform (this IS our revenue)
        subscriptionsPaid: lawyerSubscriptions,
        adsPaid: finalLawyerAdIncome,
        // What this lawyer collected from clients (NOT our revenue)
        consultationFeesCollected,
        consultationCount: lawyerBookings.length,
        // Legacy escrow records, reconciliation only
        legacyWithdrawalsPaid,
        legacyWithdrawalsPending,
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

        // Consultation activity. Client-to-lawyer money that never touches the
        // platform. Reported for visibility; must not be summed into revenue.
        totalConsultationFeesToLawyers,
        consultationCount: paidBookings.length,

        // Legacy escrow figures, retained for reconciliation only.
        legacyWithdrawalsPaid: totalPaidPayouts,
        legacyWithdrawalsPending: totalPendingPayouts,
      },
      lawyerBreakdowns,
    });
  } catch (error: any) {
    console.error('Failed to get admin finances:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', stack: error?.stack }, { status: 500 });
  }
}
