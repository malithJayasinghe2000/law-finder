import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getFirmMembership } from '@/lib/firms/access';
import { getSession } from '@/lib/auth';
import { CheckActiveSubscriptionSchema } from '@/schemas/subscription.schema';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = CheckActiveSubscriptionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { planId } = validation.data;

    // The licence is the firm's (Phase 3), resolved from membership so that a
    // practice manager with no LawyerProfile can answer for their own firm.
    // Fail closed if there is no firm: `firmId: undefined` would drop the filter
    // and match another firm's row.
    const membership = await getFirmMembership(session.userId);

    if (!membership) {
      return NextResponse.json({ error: 'You do not belong to a firm.' }, { status: 404 });
    }

    // Does this FIRM already hold this plan?
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        firmId: membership.firmId,
        planId: planId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });

    if (activeSubscription) {
      return NextResponse.json(
        {
          hasActiveSubscription: true,
          subscription: {
            id: activeSubscription.id,
            planName: activeSubscription.plan.name,
            status: activeSubscription.status,
            startDate: activeSubscription.startDate,
            endDate: activeSubscription.endDate,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { hasActiveSubscription: false },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error checking active subscription:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
