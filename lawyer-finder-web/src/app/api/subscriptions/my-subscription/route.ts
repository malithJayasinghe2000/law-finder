import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { getSubscriptionStats } from '@/lib/subscription'

/**
 * GET /api/subscriptions/my-subscription
 * Get current user's subscription info
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'LAWYER') {
      return NextResponse.json(
        { error: 'Only lawyers can access subscription info' },
        { status: 403 }
      )
    }

    // Get lawyer profile
    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const stats = await getSubscriptionStats(profile.id)

    if (!stats) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      )
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
