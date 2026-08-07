import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { getFeatureUsage } from '@/lib/subscription'

/**
 * GET /api/subscriptions/feature-usage/[featureName]
 * Get usage for a specific feature
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureName: string }> }
) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'LAWYER') {
      return NextResponse.json(
        { error: 'Only lawyers can check feature usage' },
        { status: 403 }
      )
    }

    const { featureName } = await params

    // Get lawyer profile
    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, firmId: true },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // The licence belongs to the firm (Phase 3). A missing firmId must fail
    // closed: `firmId: undefined` in a Prisma filter means "no filter", which
    // would hand back some other firm's subscription.
    if (!profile.firmId) {
      return NextResponse.json({ error: 'This attorney is not linked to a firm.' }, { status: 404 });
    }

    // Get subscription
    const subscription = await prisma.subscription.findFirst({
      where: { firmId: profile.firmId },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    const usage = await getFeatureUsage(subscription.id, featureName)

    return NextResponse.json(usage)
  } catch (error) {
    console.error('Error fetching feature usage:', error)
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
