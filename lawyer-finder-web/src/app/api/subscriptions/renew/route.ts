import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * POST /api/subscriptions/renew
 * Renew a canceled subscription by re-enabling autoRenew.
 * Only works if subscription hasn't expired yet.
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

    // Find canceled subscription that hasn't expired yet
    const subscription = await prisma.subscription.findFirst({
      where: {
        lawyerId: profile.id,
        status: 'CANCELED',
      },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No canceled subscription found to renew' }, { status: 404 });
    }

    // Check if the subscription has already expired
    const now = new Date();
    if (subscription.endDate && subscription.endDate < now) {
      return NextResponse.json(
        { error: 'Subscription has already expired. Please purchase a new subscription from the pricing page.' },
        { status: 400 }
      );
    }

    // Re-activate the subscription
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        autoRenew: true,
      },
      include: { plan: true, role: true },
    });

    return NextResponse.json({
      message: 'Subscription renewed successfully!',
      subscription: {
        id: updated.id,
        status: updated.status,
        planName: updated.plan.name,
        endDate: updated.endDate,
        autoRenew: updated.autoRenew,
      },
    });
  } catch (error) {
    console.error('Error renewing subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
