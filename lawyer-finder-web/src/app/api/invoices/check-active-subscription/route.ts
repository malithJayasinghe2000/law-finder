import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CheckActiveSubscriptionSchema } from '@/schemas/subscription.schema';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // Check if authorized
    if (!session || session.role !== 'LAWYER') {
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

    // Get lawyer profile
    const lawyerProfile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!lawyerProfile) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    // Check if lawyer has active subscription for this plan
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        lawyerId: lawyerProfile.id,
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
