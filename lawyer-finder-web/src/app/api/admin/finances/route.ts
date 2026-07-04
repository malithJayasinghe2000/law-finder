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

    // 3. Get all bookings that have been paid (i.e. status is AWAITING_LAWYER_APPROVAL, CONFIRMED, COMPLETED, IN_PROGRESS)
    const paidBookings = await prisma.booking.findMany({
      where: {
        paidAt: { not: null },
        status: { notIn: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_LAWYER', 'PENDING_PAYMENT', 'AWAITING_BANK_TRANSFER_VERIFICATION'] },
      },
      select: {
        id: true,
        lawyerFee: true,
        platformFee: true,
        totalAmount: true,
        lawyerId: true,
      },
    });

    const totalBookingPayments = paidBookings.reduce((sum: number, b: any) => sum + b.totalAmount, 0);
    const totalPlatformFeeBookingIncome = paidBookings.reduce((sum: number, b: any) => sum + b.platformFee, 0);
    const totalLawyerShareBookingIncome = paidBookings.reduce((sum: number, b: any) => sum + b.lawyerFee, 0);

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

      // Bookings for this lawyer
      const lawyerBookings = paidBookings.filter((b: any) => b.lawyerId === lawyer.id);
      const bookingTotalAmount = lawyerBookings.reduce((sum: number, b: any) => sum + b.totalAmount, 0);
      const bookingPlatformFee = lawyerBookings.reduce((sum: number, b: any) => sum + b.platformFee, 0);
      const bookingLawyerShare = lawyerBookings.reduce((sum: number, b: any) => sum + b.lawyerFee, 0); // earnings

      // Withdrawals for this lawyer
      const lawyerWithdrawals = withdrawals.filter((w: any) => w.lawyerId === lawyer.id);
      const paidAmount = lawyerWithdrawals
        .filter((w: any) => w.status === 'APPROVED')
        .reduce((sum: number, w: any) => sum + w.amount, 0);
      const pendingAmount = lawyerWithdrawals
        .filter((w: any) => w.status === 'PENDING')
        .reduce((sum: number, w: any) => sum + w.amount, 0);

      const remainingBalance = bookingLawyerShare - paidAmount - pendingAmount;

      return {
        lawyerId: lawyer.id,
        fullName: lawyer.fullName,
        baslNumber: lawyer.baslNumber,
        email: lawyer.user?.email || '',
        subscriptionsPaid: lawyerSubscriptions,
        adsPaid: finalLawyerAdIncome,
        bookingTotalVolume: bookingTotalAmount,
        bookingPlatformFee,
        bookingLawyerShare,
        paidAmount,
        pendingAmount,
        remainingBalance,
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalSubscriptionIncome,
        totalAdIncome: finalAdIncome,
        totalBookingPayments,
        totalPlatformFeeBookingIncome,
        totalLawyerShareBookingIncome,
        totalPaidPayouts,
        totalPendingPayouts,
        adminTotalIncome: totalSubscriptionIncome + finalAdIncome + totalPlatformFeeBookingIncome, // total platform revenue
      },
      lawyerBreakdowns,
    });
  } catch (error: any) {
    console.error('Failed to get admin finances:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error', stack: error?.stack }, { status: 500 });
  }
}
