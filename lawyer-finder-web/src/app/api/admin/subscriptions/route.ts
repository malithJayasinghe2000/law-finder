import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET all subscriptions with their details
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const subscriptions = await prisma.subscriptionPlan.findMany({
      include: {
        subscriptionDetails: true,
      },
      orderBy: {
        tier: 'asc',
      },
    });

    return NextResponse.json(subscriptions, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// POST a new subscription with its details
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { tier, monthlyAmount, yearlyAmount, details , name } = body;

    if (tier === undefined || monthlyAmount === undefined || yearlyAmount === undefined) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const newSubscription = await prisma.subscriptionPlan.create({
      data: {
        tier: Number(tier),
        name: String(name),
        monthlyAmount: Number(monthlyAmount),
        yearlyAmount: Number(yearlyAmount),
        subscriptionDetails: {
          create: details.map((d: string) => ({ details: d })),
        },
      },
      include: {
        subscriptionDetails: true,
      },
    });

    return NextResponse.json(newSubscription, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// PATCH/PUT an existing subscription
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, tier, monthlyAmount, yearlyAmount, details,name } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing subscription ID.' }, { status: 400 });
    }

    const updatedSubscription = await prisma.$transaction(async (tx) => {
      await tx.subscriptionDetails.deleteMany({
        where: { subscriptionId: id },
      });

      return tx.subscriptionPlan.update({
        where: { id },
        data: {
          tier: Number(tier),
          name: String(name),
          monthlyAmount: Number(monthlyAmount),
          yearlyAmount: Number(yearlyAmount),
          subscriptionDetails: {
            create: details.map((d: string) => ({ details: d })),
          },
        },
        include: {
          subscriptionDetails: true,
        },
      });
    });

    return NextResponse.json(updatedSubscription, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// DELETE a subscription
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing subscription ID.' }, { status: 400 });
    }

    await prisma.subscriptionPlan.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Subscription deleted.' }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

