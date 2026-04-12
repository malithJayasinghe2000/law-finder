import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * POST /api/subscriptions/cancel
 * Cancel the lawyer's active subscription.
 * The subscription remains active until the end date, then expires.
 */
export async function POST(request: NextRequest) {
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

    // Find active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        lawyerId: profile.id,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // Set autoRenew to false and status to CANCELED
    // The subscription will still work until endDate
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        autoRenew: false,
      },
      include: { plan: true, role: true },
    });

    return NextResponse.json({
      message: 'Subscription cancelled successfully. You will retain access until your current billing period ends.',
      subscription: {
        id: updated.id,
        status: updated.status,
        planName: updated.plan.name,
        endDate: updated.endDate,
        autoRenew: updated.autoRenew,
      },
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
