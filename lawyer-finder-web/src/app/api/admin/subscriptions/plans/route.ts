import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { SubscriptionTier } from '@prisma/client';

const tierMap: { [key: string]: SubscriptionTier } = {
  'BASIC': 'BASIC',
  'PROFESSIONAL': 'PROFESSIONAL',
  'PREMIUM': 'PREMIUM',
  'ENTERPRISE': 'ENTERPRISE',
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { tier: 'asc' }
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, tier, monthlyAmount, yearlyAmount, description } = body;

    if (!name || !tier) {
      return NextResponse.json(
        { error: 'Name and tier are required' },
        { status: 400 }
      );
    }

    const tierValue = tierMap[tier] || 'BASIC';

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        tier: tierValue,
        monthlyAmount: Number(monthlyAmount) || 0,
        yearlyAmount: Number(yearlyAmount) || 0
      }
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, tier, monthlyAmount, yearlyAmount, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    const tierValue = tierMap[tier] || 'BASIC';

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name,
        tier: tierValue,
        monthlyAmount: Number(monthlyAmount) || 0,
        yearlyAmount: Number(yearlyAmount) || 0
      }
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    await prisma.subscriptionPlan.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete plan' },
      { status: 500 }
    );
  }
}
