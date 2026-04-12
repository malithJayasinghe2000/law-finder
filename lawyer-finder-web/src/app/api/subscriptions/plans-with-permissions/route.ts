import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * GET /api/subscriptions/plans-with-permissions
 * Get all subscription plans with their tier's assigned permissions
 * Used by the pricing page to display feature lists
 */
export async function GET() {
  try {
    const session = await getSession();

    // Check if authorized
    if (!session || (session.role !== 'ADMIN' && session.role !== 'LAWYER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all plans with subscription details
    const plans = await prisma.subscriptionPlan.findMany({
      include: {
        subscriptionDetails: true,
      },
      orderBy: {
        tier: 'asc',
      },
    });

    // Get all roles with their permissions
    const roles = await prisma.subscriptionRole.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        featureLimits: true,
      },
    });

    // Map plans with their role permissions
    const plansWithPermissions = plans.map(plan => {
      const role = roles.find(r => r.name === plan.tier);
      const permissions = role?.permissions.map(rp => ({
        id: rp.permission.id,
        name: rp.permission.name,
        slug: rp.permission.slug,
        description: rp.permission.description,
        category: rp.permission.category,
      })) || [];

      const featureLimits = role?.featureLimits.map(fl => ({
        featureName: fl.featureName,
        limit: fl.limit,
        description: fl.description,
      })) || [];

      return {
        ...plan,
        permissions,
        featureLimits,
      };
    });

    return NextResponse.json(plansWithPermissions);
  } catch (error) {
    console.error('Error fetching plans with permissions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
