import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * GET /api/subscriptions/status
 * Get comprehensive subscription status for the current lawyer
 * Returns active, canceled, expired, or past_due subscription info
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Find the most recent subscription (any status)
    const subscription = await prisma.subscription.findFirst({
      where: { lawyerId: profile.id },
      include: {
        plan: true,
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
      });
    }

    // Auto-expire if endDate has passed
    const now = new Date();
    let currentStatus = subscription.status;
    if (subscription.endDate && subscription.endDate < now && subscription.status !== 'EXPIRED') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });
      currentStatus = 'EXPIRED';
    }

    // Calculate days remaining
    let daysRemaining = null;
    if (subscription.endDate) {
      const diff = subscription.endDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return NextResponse.json({
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        status: currentStatus,
        tier: subscription.plan.tier,
        planName: subscription.plan.name,
        billingCycle: subscription.billingCycle,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextBilling: subscription.nextBilling,
        autoRenew: subscription.autoRenew,
        daysRemaining,
        permissions: subscription.role.permissions.map(rp => ({
          name: rp.permission.name,
          slug: rp.permission.slug,
          description: rp.permission.description,
          category: rp.permission.category,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
