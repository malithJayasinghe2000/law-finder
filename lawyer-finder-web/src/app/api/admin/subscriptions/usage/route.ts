import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all feature usages with related data
    const usages = await prisma.featureUsage.findMany({
      include: {
        subscription: {
          include: {
            // Usage belongs to a firm's licence, not to an individual (Phase 3).
            firm: {
              select: { name: true }
            },
            plan: {
              select: { tier: true }
            },
            role: {
              include: {
                featureLimits: true
              }
            }
          }
        },
        feature: true
      }
    });

    const records = usages.map(usage => {
      const limit = usage.subscription.role?.featureLimits.find(
        (fl: { featureName: string; limit: number }) => fl.featureName === usage.feature.name
      )?.limit ?? 0;
      const percentageUsed = limit > 0 ? Math.round((usage.usage / limit) * 100) : 0;
      
      return {
        id: usage.id,
        firmName: usage.subscription.firm?.name || 'Unknown',
        subscriptionTier: usage.subscription.plan?.tier || 'UNKNOWN',
        featureName: usage.feature.name,
        usageCount: usage.usage,
        limit: limit,
        percentageUsed,
        status: limit === -1 ? 'safe' : percentageUsed >= 100 ? 'exceeded' : percentageUsed >= 80 ? 'warning' : 'safe',
        lastUsed: usage.updatedAt.toISOString()
      };
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching usage records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage records' },
      { status: 500 }
    );
  }
}
