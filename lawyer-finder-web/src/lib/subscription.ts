import prisma from './db'
import { SubscriptionStatus, BillingCycle } from '@prisma/client'
import { getSubscriptionForProfile } from './firms/billing'

/**
 * The licence covering an attorney.
 *
 * `lawyerId` is a `LawyerProfile.id`, kept as the parameter because that is what
 * callers hold — but the licence itself belongs to the attorney's **firm** as of
 * Phase 3, not to them. Resolution lives in `src/lib/firms/billing.ts`.
 *
 * Returns ACTIVE subscriptions, and CANCELED ones that have not yet expired.
 */
export async function getUserSubscription(lawyerId: string) {
  return getSubscriptionForProfile(lawyerId)
}

/**
 * Check if user has a specific permission
 * CANCELED subscriptions retain access until endDate
 */
export async function hasPermission(
  lawyerId: string,
  permissionSlug: string
): Promise<boolean> {
  const subscription = await getUserSubscription(lawyerId)

  if (!subscription) return false
  
  // Allow ACTIVE and CANCELED (not yet expired) subscriptions
  const validStatuses: string[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED]
  if (!validStatuses.includes(subscription.status)) return false

  const hasPermission = subscription.role.permissions.some(
    (rp) => rp.permission.slug === permissionSlug
  )

  return hasPermission
}

/**
 * Check multiple permissions (AND - all required)
 */
export async function hasAllPermissions(
  lawyerId: string,
  permissionSlugs: string[]
): Promise<boolean> {
  const subscription = await getUserSubscription(lawyerId)

  if (!subscription) return false
  if (subscription.status !== SubscriptionStatus.ACTIVE) return false

  const userPermissions = subscription.role.permissions.map((rp) => rp.permission.slug)

  return permissionSlugs.every((slug) => userPermissions.includes(slug))
}

/**
 * Check multiple permissions (OR - any required)
 */
export async function hasAnyPermission(
  lawyerId: string,
  permissionSlugs: string[]
): Promise<boolean> {
  const subscription = await getUserSubscription(lawyerId)

  if (!subscription) return false
  if (subscription.status !== SubscriptionStatus.ACTIVE) return false

  const userPermissions = subscription.role.permissions.map((rp) => rp.permission.slug)

  return permissionSlugs.some((slug) => userPermissions.includes(slug))
}

/**
 * Get feature usage for a subscription
 */
export async function getFeatureUsage(subscriptionId: string, featureName: string) {
  const feature = await prisma.feature.findUnique({
    where: { name: featureName },
  })

  if (!feature) {
    throw new Error(`Feature ${featureName} not found`)
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { role: true },
  })

  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found`)
  }

  // Get current usage
  const now = new Date()
  const usage = await prisma.featureUsage.findFirst({
    where: {
      subscriptionId,
      featureId: feature.id,
      billingCycleStart: { lte: now },
      billingCycleEnd: { gte: now },
    },
  })

  // Get limit for this role
  const limitConfig = await prisma.featureLimitConfig.findUnique({
    where: {
      roleId_featureName: {
        roleId: subscription.roleId,
        featureName,
      },
    },
  })

  const currentUsage = usage?.usage || 0
  const limit = limitConfig?.limit || 0
  const isUnlimited = limit === -1

  return {
    featureName,
    current: currentUsage,
    limit: isUnlimited ? -1 : limit,
    percentage: isUnlimited ? 0 : Math.round((currentUsage / limit) * 100),
    isUnlimited,
    isLimited: !isUnlimited && currentUsage >= limit,
  }
}

/**
 * Increment feature usage
 */
export async function incrementFeatureUsage(
  subscriptionId: string,
  featureName: string,
  amount: number = 1
) {
  const feature = await prisma.feature.findUnique({
    where: { name: featureName },
  })

  if (!feature) {
    throw new Error(`Feature ${featureName} not found`)
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  })

  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found`)
  }

  // Determine billing cycle dates
  const now = new Date()
  let billingCycleStart: Date
  let billingCycleEnd: Date

  if (subscription.billingCycle === BillingCycle.MONTHLY) {
    billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
    billingCycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  } else {
    // YEARLY
    const year = now.getFullYear()
    const subscriptionStartMonth = subscription.startDate.getMonth()
    billingCycleStart = new Date(year, subscriptionStartMonth, subscription.startDate.getDate())
    billingCycleEnd = new Date(year + 1, subscriptionStartMonth, subscription.startDate.getDate(), 23, 59, 59, 999)

    // If cycle start is in the future, adjust to previous year
    if (billingCycleStart > now) {
      billingCycleStart.setFullYear(year - 1)
      billingCycleEnd.setFullYear(year)
    }
  }

  // Get or create usage record
  const usage = await prisma.featureUsage.upsert({
    where: {
      subscriptionId_featureId_billingCycleStart: {
        subscriptionId,
        featureId: feature.id,
        billingCycleStart,
      },
    },
    update: {
      usage: {
        increment: amount,
      },
    },
    create: {
      subscriptionId,
      featureId: feature.id,
      billingCycleStart,
      billingCycleEnd,
      usage: amount,
    },
  })

  return usage
}

/**
 * Check if user can use a feature
 */
export async function canUseFeature(
  subscriptionId: string,
  featureName: string
): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { role: true },
  })

  if (!subscription) {
    return { allowed: false, reason: 'Subscription not found' }
  }

  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    return { allowed: false, reason: `Subscription is ${subscription.status}` }
  }

  const feature = await prisma.feature.findUnique({
    where: { name: featureName },
  })

  if (!feature) {
    return { allowed: false, reason: 'Feature not found' }
  }

  // Check if role has permission for this category
  const permissionCategory = featureName.split('_')[0] // e.g., "document" from "document_templates"
  const hasPermission = await prisma.subscriptionRolePermission.findFirst({
    where: {
      roleId: subscription.roleId,
      permission: {
        category: permissionCategory,
      },
    },
  })

  if (!hasPermission) {
    return {
      allowed: false,
      reason: `Subscription role does not have permission for ${permissionCategory}`,
    }
  }

  // Check limit
  const usage = await getFeatureUsage(subscriptionId, featureName)

  if (usage.isLimited) {
    return {
      allowed: false,
      reason: `Feature limit reached (${usage.current}/${usage.limit})`,
    }
  }

  return { allowed: true }
}

/**
 * Get all subscription stats
 */
export async function getSubscriptionStats(lawyerId: string) {
  const subscription = await getUserSubscription(lawyerId)

  if (!subscription) {
    return null
  }

  // Get all feature usage
  const allUsages = await prisma.featureUsage.findMany({
    where: {
      subscriptionId: subscription.id,
      billingCycleStart: { lte: new Date() },
      billingCycleEnd: { gte: new Date() },
    },
    include: {
      feature: true,
    },
  })

  // Get all limits for this role
  const limits = await prisma.featureLimitConfig.findMany({
    where: { roleId: subscription.roleId },
  })

  const stats = {
    subscriptionId: subscription.id,
    tier: subscription.role.name,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    features: await Promise.all(
      limits.map(async (limit) => {
        const usage = allUsages.find((u) => u.feature.name === limit.featureName)
        return {
          name: limit.featureName,
          current: usage?.usage || 0,
          limit: limit.limit === -1 ? 'Unlimited' : limit.limit,
          percentage:
            limit.limit === -1 ? 0 : Math.round(((usage?.usage || 0) / limit.limit) * 100),
        }
      })
    ),
  }

  return stats
}
