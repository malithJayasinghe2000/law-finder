import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const totalSubscriptions = await prisma.subscription.count();
    const activeSubscriptions = await prisma.subscription.count({
      where: { status: 'ACTIVE' }
    });
    const totalRoles = await prisma.subscriptionRole.count();
    const totalPermissions = await prisma.permission.count();

    return NextResponse.json({
      totalSubscriptions,
      activeSubscriptions,
      totalRoles,
      totalPermissions
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription stats' },
      { status: 500 }
    );
  }
}
