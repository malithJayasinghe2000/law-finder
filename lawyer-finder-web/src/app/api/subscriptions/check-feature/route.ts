import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { canUseFeature } from '@/lib/subscription'

/**
 * POST /api/subscriptions/check-feature
 * Check if user can use a feature
 * Body: { featureName: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'LAWYER') {
      return NextResponse.json(
        { error: 'Only lawyers can check feature access' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { featureName } = body

    if (!featureName) {
      return NextResponse.json(
        { error: 'featureName is required' },
        { status: 400 }
      )
    }

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
        {
          allowed: false,
          reason: 'No active subscription found',
        },
        { status: 200 }
      )
    }

    const result = await canUseFeature(subscription.id, featureName)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error checking feature access:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
