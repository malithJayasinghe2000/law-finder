import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const totalLawyers = await prisma.lawyerProfile.count();
    const activeSubscriptions = await prisma.subscription.count({
      where: { status: 'ACTIVE' }
    });
    const featuresTracked = await prisma.feature.count();
    
    // Calculate average usage
    const featureUsages = await prisma.featureUsage.findMany({
      include: {
        feature: true
      }
    });
    
    const featureLimits = await prisma.featureLimitConfig.findMany();
    
    let averageUsagePercent = 0;
    let topUsedFeature = 'None';

    if (featureUsages.length > 0) {
      const usageByFeature: { [key: string]: { count: number; limit: number } } = {};
      
      featureUsages.forEach(usage => {
        const featureName = usage.feature.name;
        if (!usageByFeature[featureName]) {
          usageByFeature[featureName] = { count: 0, limit: 0 };
        }
        usageByFeature[featureName].count += usage.usage;
      });

      featureLimits.forEach(limit => {
        if (usageByFeature[limit.featureName]) {
          usageByFeature[limit.featureName].limit = limit.limit;
        }
      });

      const percentages = Object.entries(usageByFeature).map(([feature, data]) => {
        const percent = data.limit > 0 ? (data.count / data.limit) * 100 : 0;
        return { feature, percent };
      });

      if (percentages.length > 0) {
        averageUsagePercent = Math.round(
          percentages.reduce((sum, item) => sum + item.percent, 0) / percentages.length
        );
        
        const topFeature = percentages.reduce((max, item) => 
          item.percent > max.percent ? item : max
        );
        topUsedFeature = topFeature.feature;
      }
    }

    return NextResponse.json({
      totalLawyers,
      activeSubscriptions,
      featuresTracked,
      averageUsagePercent,
      topUsedFeature
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage stats' },
      { status: 500 }
    );
  }
}
