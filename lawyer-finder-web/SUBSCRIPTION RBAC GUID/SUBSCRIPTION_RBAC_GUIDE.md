# Subscription Access Control System (RBAC) - Complete Guide

## Overview

This is a robust subscription-based Role-Based Access Control (RBAC) system that allows you to:
- Manage subscription tiers (BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE)
- Assign granular permissions to each tier
- Track feature usage and enforce limits
- Support monthly and yearly billing cycles
- Admin panel for permission management

## Architecture

### Data Models

1. **SubscriptionRole** - Defines subscription tiers
   - BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE

2. **Permission** - Individual features/actions
   - Can be assigned to roles
   - Grouped by category (articles, inquiries, chat, etc.)

3. **Subscription** - User subscription
   - Links to a role and plan
   - Tracks billing cycle (monthly/yearly)
   - Status (ACTIVE, CANCELED, EXPIRED, PAST_DUE)

4. **Feature** - Trackable usage metrics
   - articles_per_month
   - inquiries_per_month
   - chat_messages_per_month
   - promo_campaigns_per_month
   - storage_gb

5. **FeatureLimitConfig** - Limits per role
   - Defines how many of each feature per billing cycle
   - -1 = Unlimited

6. **FeatureUsage** - Tracks actual usage
   - Records current usage per billing cycle
   - Automatically resets each month/year

### Permission Categories

- **articles** - Create, edit, publish articles
- **inquiries** - Receive and manage inquiries
- **chat** - Access chat functionality
- **profile** - Edit profile and upload documents
- **promotion** - Access paid promotion features
- **analytics** - View analytics and export data

## Default Permission Structure

### BASIC Tier (Entry Level)
- Permissions: `create_article`, `receive_inquiries`, `access_chat`, `send_message`, `edit_profile`
- Limits:
  - Articles: 2/month
  - Inquiries: 10/month
  - Chat messages: 50/month
  - Promotions: 0
  - Storage: 1 GB

### PROFESSIONAL Tier
- Includes all BASIC + `edit_article`, `publish_article`, `post_inquiry`, `view_analytics`, `upload_documents`
- Limits:
  - Articles: 10/month
  - Inquiries: 50/month
  - Chat messages: 500/month
  - Promotions: 2
  - Storage: 5 GB

### PREMIUM Tier
- Includes all PROFESSIONAL + `delete_article`, `manage_inquiries`, `access_paid_promo`, `create_promo`, `export_data`
- Limits:
  - Articles: 50/month
  - Inquiries: 200/month
  - Chat messages: 2000/month
  - Promotions: 10
  - Storage: 20 GB

### ENTERPRISE Tier
- All permissions
- Unlimited usage

## Database Setup

### 1. Run Migrations
```bash
npx prisma migrate dev --name add_subscription_rbac
```

### 2. Seed Database
```bash
npx prisma db seed
```

This creates:
- All subscription roles
- All permissions
- Feature definitions
- Feature limits per role

## Usage Examples

### 1. Check User Permissions

#### Backend (Server-Side)
```typescript
import { getUserSubscription, hasPermission } from '@/lib/subscription'

// Get full subscription info
const subscription = await getUserSubscription(lawyerId)
console.log(subscription.role.name) // 'PREMIUM'

// Check single permission
const canCreate = await hasPermission(lawyerId, 'create_article')
if (!canCreate) {
  throw new Error('Permission denied: create_article')
}

// Check multiple permissions (all required)
const canManage = await hasAllPermissions(lawyerId, [
  'edit_article',
  'publish_article',
  'view_analytics'
])

// Check multiple permissions (any required)
const hasAccess = await hasAnyPermission(lawyerId, [
  'access_paid_promo',
  'create_promo'
])
```

#### Frontend (Client-Side)
```typescript
// Check permission before showing UI button
const response = await fetch('/api/subscriptions/check-feature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ featureName: 'articles_per_month' })
})

const { allowed, reason } = await response.json()

if (!allowed) {
  showError(`Cannot create article: ${reason}`)
}
```

### 2. Track Feature Usage

#### Increment Usage When Feature Is Used
```typescript
import { incrementFeatureUsage } from '@/lib/subscription'

// When user creates an article
await incrementFeatureUsage(subscriptionId, 'articles_per_month', 1)

// When user sends a message
await incrementFeatureUsage(subscriptionId, 'chat_messages_per_month', 1)
```

#### Check Current Usage
```typescript
import { getFeatureUsage } from '@/lib/subscription'

const usage = await getFeatureUsage(subscriptionId, 'articles_per_month')
console.log(usage)
// {
//   featureName: 'articles_per_month',
//   current: 5,
//   limit: 10,
//   percentage: 50,
//   isLimited: false
// }
```

#### Check if Feature Can Be Used
```typescript
import { canUseFeature } from '@/lib/subscription'

const result = await canUseFeature(subscriptionId, 'articles_per_month')
if (!result.allowed) {
  throw new Error(result.reason) // "Feature limit reached (10/10)"
}

// Safe to proceed
await createArticle(...)
await incrementFeatureUsage(subscriptionId, 'articles_per_month', 1)
```

#### Get All Stats
```typescript
import { getSubscriptionStats } from '@/lib/subscription'

const stats = await getSubscriptionStats(lawyerId)
// {
//   subscriptionId: '...',
//   tier: 'PREMIUM',
//   status: 'ACTIVE',
//   billingCycle: 'MONTHLY',
//   features: [
//     { name: 'articles_per_month', current: 5, limit: 50, percentage: 10 },
//     { name: 'inquiries_per_month', current: 25, limit: 200, percentage: 12.5 },
//     ...
//   ]
// }
```

### 3. API Routes

#### Get User's Subscription
```bash
GET /api/subscriptions/my-subscription
# Headers: Must be logged in as lawyer

# Response:
{
  subscriptionId: "uuid",
  tier: "PREMIUM",
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  features: [...]
}
```

#### Check Feature Usage
```bash
GET /api/subscriptions/feature-usage/articles_per_month
# Headers: Must be logged in as lawyer

# Response:
{
  featureName: "articles_per_month",
  current: 5,
  limit: 50,
  percentage: 10,
  isUnlimited: false,
  isLimited: false
}
```

#### Verify Feature Access
```bash
POST /api/subscriptions/check-feature
# Headers: Must be logged in as lawyer
# Body: { "featureName": "articles_per_month" }

# Response:
{
  allowed: true,
  reason: null  // or error message if allowed: false
}
```

### 4. Admin Panel Management

#### View All Roles and Permissions
```bash
GET /api/admin/roles
# Headers: Must be admin

# Response:
[
  {
    id: "...",
    name: "PROFESSIONAL",
    permissions: [
      { permission: { id: "...", name: "create_article", ... } },
      ...
    ],
    featureLimits: [...]
  }
]
```

#### Assign Permissions to Role
```bash
POST /api/admin/roles/{roleId}/permissions/assign
# Headers: Must be admin
# Body: { "permissionIds": ["perm1", "perm2", ...] }

# Response:
{ "message": "Assigned 5 permissions to role", "count": 5 }
```

#### Remove Permissions from Role
```bash
DELETE /api/admin/roles/{roleId}/permissions/remove
# Headers: Must be admin
# Body: { "permissionIds": ["perm1", "perm2", ...] }

# Response:
{ "message": "Removed 2 permissions from role", "count": 2 }
```

#### Update Feature Limits
```bash
POST /api/admin/roles/{roleId}/feature-limits
# Headers: Must be admin
# Body: {
#   "limits": [
#     { "featureName": "articles_per_month", "limit": 50 },
#     { "featureName": "chat_messages_per_month", "limit": -1 }
#   ]
# }

# Response:
{ "message": "Updated 2 feature limits", "limits": [...] }
```

#### Get Feature Limits for Role
```bash
GET /api/admin/roles/{roleId}/feature-limits
# Headers: Must be admin

# Response:
[
  { id: "...", featureName: "articles_per_month", limit: 50 },
  { id: "...", featureName: "inquiries_per_month", limit: 200 },
  ...
]
```

## Implementing in Features

### Example: Creating an Article

```typescript
'use client'

import { useState } from 'react'
import { requirePermission, requireFeatureQuota } from '@/lib/subscription-middleware'
import { incrementFeatureUsage, getFeatureUsage } from '@/lib/subscription'

export async function handleCreateArticle(
  lawyerId: string,
  subscriptionId: string,
  articleData: ArticleData
) {
  try {
    // 1. Check permission
    await requirePermission(lawyerId, 'create_article')

    // 2. Check feature quota
    await requireFeatureQuota(subscriptionId, 'articles_per_month')

    // 3. Create article
    const article = await prisma.article.create({
      data: articleData
    })

    // 4. Increment usage
    await incrementFeatureUsage(subscriptionId, 'articles_per_month', 1)

    return article
  } catch (error) {
    if (error.message.includes('Permission denied')) {
      throw new Error('You do not have permission to create articles')
    }
    if (error.message.includes('Feature quota exceeded')) {
      throw new Error('You have reached your monthly article limit')
    }
    throw error
  }
}
```

### Example: Frontend Article Creation Form

```typescript
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

export function CreateArticleForm() {
  const [canCreate, setCanCreate] = useState(false)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAccess()
  }, [])

  async function checkAccess() {
    try {
      const [accessRes, usageRes] = await Promise.all([
        fetch('/api/subscriptions/check-feature', {
          method: 'POST',
          body: JSON.stringify({ featureName: 'articles_per_month' })
        }),
        fetch('/api/subscriptions/feature-usage/articles_per_month')
      ])

      const access = await accessRes.json()
      const usageData = await usageRes.json()

      setCanCreate(access.allowed)
      setUsage(usageData)
    } catch (error) {
      toast.error('Failed to check access')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>

  if (!canCreate) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800">
          You have reached your monthly article limit ({usage?.current}/{usage?.limit})
        </p>
        <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">
          Upgrade Plan
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <div className="mt-4 text-sm text-gray-600">
        Articles created: {usage?.current}/{usage?.limit}
      </div>
      <button type="submit">Create Article</button>
    </form>
  )
}
```

## Admin Panel Components

### 1. SubscriptionRoleManager
Manage which permissions are assigned to each subscription role.

Located at: `src/components/admin/SubscriptionRoleManager.tsx`

Features:
- View all subscription roles
- Select a role
- Assign/Remove permissions
- Save changes

```typescript
import { SubscriptionRoleManager } from '@/components/admin/SubscriptionRoleManager'

export function AdminPage() {
  return <SubscriptionRoleManager />
}
```

### 2. FeatureLimitManager
Set usage limits for each feature per subscription role.

Located at: `src/components/admin/FeatureLimitManager.tsx`

Features:
- Select a role
- View all feature limits
- Edit limits (including unlimited with -1)
- Save changes

```typescript
import { FeatureLimitManager } from '@/components/admin/FeatureLimitManager'

export function AdminPage() {
  return <FeatureLimitManager />
}
```

### 3. SubscriptionViewer
Display lawyer's current subscription and usage.

Located at: `src/components/admin/SubscriptionViewer.tsx`

Features:
- Display subscription tier
- Show subscription status
- Display current usage vs limits
- Visual progress bars
- Upgrade button

```typescript
import { SubscriptionViewer } from '@/components/admin/SubscriptionViewer'

export function SubscriptionPage() {
  return <SubscriptionViewer />
}
```

## Billing Cycles

### Monthly Cycle
Usage resets on the 1st of each month.
- Billing starts: 1st day of month
- Billing ends: Last day of month

### Yearly Cycle
Usage resets on the subscription anniversary date.
- Billing starts: Same date as subscription start each year
- Billing ends: 1 day before next anniversary

Usage is automatically tracked in the `billingCycleStart` and `billingCycleEnd` fields.

## Permission Management Best Practices

### Adding New Permissions

1. Create permission in database:
```typescript
await prisma.permission.create({
  data: {
    name: 'view_reports',
    slug: 'view-reports',
    category: 'analytics',
    description: 'View financial reports'
  }
})
```

2. Assign to roles via admin panel or API

3. Use in code:
```typescript
await hasPermission(lawyerId, 'view_reports')
```

### Adding New Features

1. Create feature in database:
```typescript
await prisma.feature.create({
  data: {
    name: 'reports_per_month',
    slug: 'reports-per-month',
    unit: 'count',
    description: 'Number of reports per month'
  }
})
```

2. Set limits for each role:
```typescript
await Promise.all([
  prisma.featureLimitConfig.create({
    data: { roleId: basicRole.id, featureName: 'reports_per_month', limit: 5 }
  }),
  prisma.featureLimitConfig.create({
    data: { roleId: premiumRole.id, featureName: 'reports_per_month', limit: 100 }
  })
])
```

3. Track usage:
```typescript
await incrementFeatureUsage(subscriptionId, 'reports_per_month', 1)
```

## Handling Expired/Past Due Subscriptions

The middleware automatically checks subscription status on every request:

```typescript
const subscription = await getUserSubscription(lawyerId)

// Check status
if (subscription.status === 'EXPIRED') {
  // Show renewal prompt
}

if (subscription.status === 'PAST_DUE') {
  // Show payment due notice
}

// Also check end date
const isExpired = subscription.endDate && subscription.endDate < new Date()
```

## Common Errors and Solutions

### Error: "Feature limit reached"
User has exceeded their usage quota for the billing period.
- Solution: Show message to wait until next billing cycle or upgrade

### Error: "Missing permission"
Subscription role doesn't have the required permission.
- Solution: Upgrade user's subscription tier or contact admin

### Error: "No active subscription found"
User doesn't have an active subscription.
- Solution: Prompt user to subscribe

### Error: "Feature not found"
Feature name doesn't exist in database.
- Solution: Check feature name spelling, run seed again if needed

## Performance Considerations

1. **Caching permissions**: Cache user permissions in session to avoid repeated queries
2. **Batch usage checks**: Use `Promise.all()` to check multiple features at once
3. **Index queries**: Feature usage queries are optimized with unique constraints

## Security Notes

1. Always check permissions on the backend, not just frontend
2. Verify subscription status before processing any request
3. Admin-only endpoints check `session.role === 'ADMIN'`
4. Feature quota is tracked per subscription, not per user
5. Soft delete pattern (status field) is used instead of hard deletion

## Testing

### Seed Test Data
```bash
npx prisma db seed
```

Creates:
- Admin: admin@lawfinder.lk
- Lawyer: lawyer@lawfinder.lk (with PROFESSIONAL subscription)
- Client: citizen@lawfinder.lk
- All subscription roles with default permissions
- All features with default limits

### Test Feature Usage
```typescript
// Get a lawyer's subscription
const subscription = await getUserSubscription(lawyerId)

// Check permissions
console.log(subscription.role.name) // 'PROFESSIONAL'

// Get usage stats
const stats = await getSubscriptionStats(lawyerId)
console.log(stats.features)
```

## Troubleshooting

### Permissions not showing
1. Check if permission exists in database
2. Verify role is assigned to permission
3. Restart server (JWT token might be cached)

### Usage not incrementing
1. Verify subscription exists and is ACTIVE
2. Check if feature name matches exactly
3. Ensure `incrementFeatureUsage()` is called after action

### Feature limits not enforcing
1. Check FeatureLimitConfig exists for role
2. Verify role has permission for that category
3. Check billing cycle dates are correct

## Next Steps

1. Integrate with payment processor (Stripe, PayPal)
2. Implement subscription renewal automation
3. Add dunning/retry for failed payments
4. Create detailed usage analytics dashboard
5. Implement family/team accounts
