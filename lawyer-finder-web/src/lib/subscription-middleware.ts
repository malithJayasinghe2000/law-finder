import { NextRequest, NextResponse } from 'next/server'
import { getSession } from './auth'
import { getUserSubscription, canUseFeature } from './subscription'
import prisma from './db'

/**
 * Middleware to check subscription status on every request
 * Automatically sets subscription info in request headers
 */
export async function withSubscriptionCheck(request: NextRequest) {
  const session = await getSession()

  if (!session || session.role !== 'LAWYER') {
    return null
  }

  try {
    // Get lawyer profile ID if available
    let profileId = session.profileId

    if (!profileId && session.userId) {
      const profile = await prisma.lawyerProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      })
      profileId = profile?.id
    }

    if (!profileId) {
      return null
    }

    // Get subscription
    const subscription = await getUserSubscription(profileId)

    if (!subscription) {
      return {
        hasSubscription: false,
        status: null,
        tier: null,
      }
    }

    // Check if subscription is expired
    const now = new Date()
    const isExpired = subscription.endDate && subscription.endDate < now
    const isPastDue = subscription.status === 'PAST_DUE'

    let status = isExpired ? 'EXPIRED' : isPastDue ? 'PAST_DUE' : subscription.status

    if (isExpired && subscription.status !== 'EXPIRED') {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' }
      })
      status = 'EXPIRED'
    }

    return {
      hasSubscription: true,
      subscriptionId: subscription.id,
      status,
      tier: subscription.role.name,
      nextBilling: subscription.nextBilling,
      permissions: subscription.role.permissions.map((rp) => rp.permission.slug),
    }
  } catch (error) {
    console.error('Error checking subscription:', error)
    return null
  }
}

/**
 * Middleware to check if user has a specific permission
 */
export async function withPermissionCheck(
  request: NextRequest,
  requiredPermission: string | string[]
) {
  const session = await getSession()

  if (!session || session.role !== 'LAWYER') {
    return null
  }

  let profileId = session.profileId

  if (!profileId && session.userId) {
    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    })
    profileId = profile?.id
  }

  if (!profileId) {
    return null
  }

  const subscription = await getUserSubscription(profileId)

  if (!subscription) {
    return { hasPermission: false }
  }

  const userPermissions = subscription.role.permissions.map((rp) => rp.permission.slug)

  const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]
  const hasPermission = permissions.every((perm) => userPermissions.includes(perm))

  return { hasPermission, subscription }
}

/**
 * Middleware to check feature usage quota
 */
export async function checkFeatureQuota(subscriptionId: string, featureName: string) {
  try {
    const canUse = await canUseFeature(subscriptionId, featureName)
    return canUse
  } catch (error) {
    console.error('Error checking feature quota:', error)
    return { allowed: false, reason: 'Error checking feature quota' }
  }
}

/**
 * Helper to throw error if user doesn't have permission
 */
export async function requirePermission(
  userId: string,
  requiredPermission: string | string[]
) {
  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId },
    select: { id: true },
  })

  if (!profile) {
    throw new Error('Profile not found')
  }

  const subscription = await getUserSubscription(profile.id)

  if (!subscription) {
    throw new Error('No active subscription')
  }

  const userPermissions = subscription.role.permissions.map((rp) => rp.permission.slug)

  const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]
  const hasPermission = permissions.every((perm) => userPermissions.includes(perm))

  if (!hasPermission) {
    throw new Error(`Missing permission: ${permissions.join(', ')}`)
  }

  return subscription
}

/**
 * Helper to throw error if feature quota exceeded
 */
export async function requireFeatureQuota(
  subscriptionId: string,
  featureName: string
) {
  const result = await canUseFeature(subscriptionId, featureName)

  if (!result.allowed) {
    throw new Error(`Feature quota exceeded: ${result.reason}`)
  }

  return true
}
