# Subscription RBAC System - Implementation Checklist & Report

## System Overview

You now have a **production-ready subscription access control system** with:

✅ **Database Models** (7 new tables)
- SubscriptionRole (BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE)
- Permission (15+ default permissions)
- SubscriptionRolePermission (junction table)
- Feature (5 trackable features)
- FeatureLimitConfig (limits per role)
- FeatureUsage (usage tracking)

✅ **Backend Services**
- `subscription.ts` - Core permission and usage functions
- `subscription-middleware.ts` - Helper functions for routes
- Stripe-ready subscription models

✅ **API Routes**
- Admin: `/api/admin/permissions` - Manage permissions
- Admin: `/api/admin/roles` - View roles
- Admin: `/api/admin/roles/{roleId}/permissions` - Assign/remove permissions
- Admin: `/api/admin/roles/{roleId}/feature-limits` - Set usage limits
- User: `/api/subscriptions/my-subscription` - Get subscription info
- User: `/api/subscriptions/feature-usage/{featureName}` - Check usage
- User: `/api/subscriptions/check-feature` - Verify access

✅ **Frontend Components**
- SubscriptionRoleManager - Admin panel for permissions
- FeatureLimitManager - Admin panel for limits
- SubscriptionViewer - User dashboard for subscription

✅ **Database Seeding**
- 4 subscription tiers
- 15 permissions across 6 categories
- 5 features with proper limits
- Test users (admin, lawyer, client)

---

## Implementation Steps

### Phase 1: Database Setup ✅ COMPLETE

**What was done:**
1. Added 7 new tables to Prisma schema
2. Created enums for SubscriptionTier and BillingCycle
3. Updated existing Subscription table with roleId and billingCycle fields
4. Added relationships between all tables

**File changes:**
- `prisma/schema.prisma` - Updated with new models

**Next action:**
```bash
# Create migration
npx prisma migrate dev --name add_subscription_rbac

# Seed database
npx prisma db seed
```

---

### Phase 2: Backend Services ✅ COMPLETE

**What was done:**
1. Created `subscription.ts` with core functions:
   - `getUserSubscription()` - Fetch user's subscription
   - `hasPermission()` - Check single permission
   - `hasAllPermissions()` - Check multiple (AND)
   - `hasAnyPermission()` - Check multiple (OR)
   - `getFeatureUsage()` - Get current usage
   - `incrementFeatureUsage()` - Track usage
   - `canUseFeature()` - Check if usage allowed
   - `getSubscriptionStats()` - Get all stats

2. Created `subscription-middleware.ts` with helpers:
   - `withSubscriptionCheck()` - Middleware for session
   - `withPermissionCheck()` - Verify permissions
   - `checkFeatureQuota()` - Check usage limits
   - `requirePermission()` - Throw on no permission
   - `requireFeatureQuota()` - Throw on quota exceeded

3. Updated `auth.ts`:
   - Extended SessionPayload with subscription info

**Files created:**
- `src/lib/subscription.ts` - Core service
- `src/lib/subscription-middleware.ts` - Middleware helpers

---

### Phase 3: API Routes ✅ COMPLETE

**What was done:**
1. Admin endpoints (protected by `isAdmin()` check)
   - GET/POST `/api/admin/permissions` - Manage permissions
   - GET `/api/admin/roles` - List all roles
   - POST `/api/admin/roles/{roleId}/permissions/assign` - Assign perms
   - DELETE `/api/admin/roles/{roleId}/permissions/remove` - Remove perms
   - GET/POST `/api/admin/roles/{roleId}/feature-limits` - Manage limits

2. User endpoints (requires authentication)
   - GET `/api/subscriptions/my-subscription` - Current subscription
   - GET `/api/subscriptions/feature-usage/{featureName}` - Usage stats
   - POST `/api/subscriptions/check-feature` - Verify access

**Files created:**
- `src/app/api/admin/permissions/route.ts`
- `src/app/api/admin/roles/{roleId}/permissions/route.ts`
- `src/app/api/admin/roles/{roleId}/feature-limits/route.ts`
- `src/app/api/admin/roles/route.ts`
- `src/app/api/subscriptions/my-subscription/route.ts`
- `src/app/api/subscriptions/feature-usage/[featureName]/route.ts`
- `src/app/api/subscriptions/check-feature/route.ts`

---

### Phase 4: Frontend Components ✅ COMPLETE

**What was done:**
1. `SubscriptionRoleManager` - Admin UI for permissions
   - Select role
   - Checkbox list of available permissions
   - Save button to assign permissions

2. `FeatureLimitManager` - Admin UI for limits
   - Dropdown to select role
   - Edit limit values
   - Support for -1 (unlimited)
   - Save button

3. `SubscriptionViewer` - User dashboard
   - Display subscription tier
   - Show status badge
   - Display feature usage with progress bars
   - Color-coded usage (green/yellow/orange/red)
   - Upgrade button

**Files created:**
- `src/components/admin/SubscriptionRoleManager.tsx`
- `src/components/admin/FeatureLimitManager.tsx`
- `src/components/admin/SubscriptionViewer.tsx`

---

### Phase 5: Documentation ✅ COMPLETE

**What was done:**
1. Comprehensive usage guide with code examples
2. API documentation with curl examples
3. Architecture overview
4. Permission and feature explanations
5. Integration examples

**Files created:**
- `SUBSCRIPTION_RBAC_GUIDE.md` - Full guide

---

## Quick Start

### 1. Run Database Migration & Seed
```bash
# Apply schema changes
npx prisma migrate dev --name add_subscription_rbac

# Seed test data
npx prisma db seed

# This creates:
# - Admin: admin@lawfinder.lk / password123
# - Lawyer: lawyer@lawfinder.lk / password123 (PROFESSIONAL tier)
# - Client: citizen@lawfinder.lk / password123
# - All subscription roles with default permissions
# - All features with default limits
```

### 2. Test Permissions
```bash
# In your route/API handler
import { hasPermission, getSubscriptionStats } from '@/lib/subscription'

// Check permission
const canCreate = await hasPermission(lawyerId, 'create_article')

// Get stats
const stats = await getSubscriptionStats(lawyerId)
console.log(stats.tier) // 'PROFESSIONAL'
```

### 3. Track Feature Usage
```bash
import { incrementFeatureUsage, canUseFeature } from '@/lib/subscription'

// Check before using
const canUse = await canUseFeature(subscriptionId, 'articles_per_month')
if (!canUse.allowed) {
  throw new Error(canUse.reason) // "Feature limit reached"
}

// After successful action
await incrementFeatureUsage(subscriptionId, 'articles_per_month', 1)
```

### 4. Add Admin Panel to Dashboard
```typescript
// pages/dashboard/admin/subscriptions.tsx
'use client'
import { SubscriptionRoleManager } from '@/components/admin/SubscriptionRoleManager'
import { FeatureLimitManager } from '@/components/admin/FeatureLimitManager'

export default function SubscriptionsAdmin() {
  return (
    <div className="space-y-8">
      <SubscriptionRoleManager />
      <FeatureLimitManager />
    </div>
  )
}
```

### 5. Show User Subscription Dashboard
```typescript
// pages/dashboard/subscription.tsx
'use client'
import { SubscriptionViewer } from '@/components/admin/SubscriptionViewer'

export default function SubscriptionPage() {
  return <SubscriptionViewer />
}
```

---

## Default Permissions by Tier

### BASIC
- ✅ Create articles (2/month)
- ✅ Receive inquiries (10/month)
- ✅ Access chat
- ✅ Edit profile
- ❌ Publish articles
- ❌ Manage inquiries
- ❌ Paid promotions
- ❌ Analytics

### PROFESSIONAL
- ✅ All BASIC permissions
- ✅ Edit & publish articles (10/month)
- ✅ Post inquiries (50/month)
- ✅ View analytics
- ✅ Upload documents
- ❌ Delete articles
- ❌ Manage all inquiries
- ❌ Paid promotions

### PREMIUM
- ✅ All PROFESSIONAL permissions
- ✅ Delete articles (50/month)
- ✅ Manage all inquiries (200/month)
- ✅ Access paid promotions (10 campaigns/month)
- ✅ Export data
- ✅ Chat messages (2000/month)
- ✅ Storage (20 GB)

### ENTERPRISE
- ✅ All permissions
- ✅ Unlimited usage on all features
- ✅ Priority support
- ✅ Advanced analytics

---

## Feature Limits Summary

| Feature | BASIC | PROF | PREMIUM | ENTERPRISE |
|---------|-------|------|---------|------------|
| Articles/month | 2 | 10 | 50 | ∞ |
| Inquiries/month | 10 | 50 | 200 | ∞ |
| Chat messages/month | 50 | 500 | 2000 | ∞ |
| Promo campaigns/month | 0 | 2 | 10 | ∞ |
| Storage | 1 GB | 5 GB | 20 GB | ∞ |

---

## Integration Points

### When User Creates Article
```typescript
// 1. Check permission
await hasPermission(lawyerId, 'create_article')

// 2. Check quota
await canUseFeature(subscriptionId, 'articles_per_month')

// 3. Create article
const article = await prisma.article.create({ data })

// 4. Increment usage
await incrementFeatureUsage(subscriptionId, 'articles_per_month', 1)
```

### When User Sends Message
```typescript
await hasPermission(lawyerId, 'send_message')
await canUseFeature(subscriptionId, 'chat_messages_per_month')
await createMessage(...)
await incrementFeatureUsage(subscriptionId, 'chat_messages_per_month', 1)
```

### When User Posts Inquiry
```typescript
await hasPermission(lawyerId, 'post_inquiry')
await canUseFeature(subscriptionId, 'inquiries_per_month')
await createInquiry(...)
await incrementFeatureUsage(subscriptionId, 'inquiries_per_month', 1)
```

---

## Billing Cycles

### Monthly
- Resets: 1st day of month
- Usage period: Full calendar month

### Yearly
- Resets: Subscription anniversary date
- Usage period: 12 months from anniversary

**Automatic handling:** Usage tracking automatically calculates billing cycles based on subscription.billingCycle field.

---

## Admin Tasks

### View All Users' Subscriptions
```typescript
const subscriptions = await prisma.subscription.findMany({
  include: {
    lawyer: true,
    role: true,
    plan: true
  },
  orderBy: { createdAt: 'desc' }
})
```

### Update User's Subscription Tier
```typescript
// Upgrade from BASIC to PREMIUM
const premiumRole = await prisma.subscriptionRole.findUnique({
  where: { name: 'PREMIUM' }
})

await prisma.subscription.update({
  where: { id: subscriptionId },
  data: { roleId: premiumRole.id }
})
```

### Add Custom Permission to Role
```typescript
const role = await prisma.subscriptionRole.findUnique({
  where: { name: 'PREMIUM' }
})

const permission = await prisma.permission.create({
  data: {
    name: 'api_access',
    slug: 'api-access',
    category: 'api',
    description: 'Access to REST API'
  }
})

await prisma.subscriptionRolePermission.create({
  data: {
    roleId: role.id,
    permissionId: permission.id
  }
})
```

### Change Feature Limit
```typescript
await prisma.featureLimitConfig.update({
  where: {
    roleId_featureName: {
      roleId: premiumRole.id,
      featureName: 'articles_per_month'
    }
  },
  data: { limit: 100 } // Changed from 50
})
```

---

## Security Checklist

✅ **Backend Permission Checks**
- Always verify permissions server-side
- Don't trust frontend checks alone
- Use `requirePermission()` helper in API routes

✅ **Subscription Status Validation**
- Check subscription is ACTIVE
- Verify not EXPIRED or PAST_DUE
- Middleware automatically validates on session

✅ **Usage Quota Enforcement**
- Check before incrementing
- Use `canUseFeature()` helper
- Prevent quota bypass

✅ **Admin Access Control**
- All admin endpoints verify `session.role === 'ADMIN'`
- Admin endpoints return 403 if not admin
- No sensitive data in error messages

✅ **Data Isolation**
- Use `lawyerId` to scope subscriptions
- Users can only see their own subscriptions
- Usage is tracked per subscription, not globally

---

## Testing Commands

### Test Permission Check
```bash
# Logged in as lawyer
curl -H "Authorization: Bearer $TOKEN" \
  https://yourapp.com/api/subscriptions/check-feature \
  -d '{"featureName":"articles_per_month"}'
```

### View Subscription
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://yourapp.com/api/subscriptions/my-subscription
```

### Check Feature Usage
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://yourapp.com/api/subscriptions/feature-usage/articles_per_month
```

### Admin: View Roles
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://yourapp.com/api/admin/roles
```

### Admin: Update Limits
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limits":[{"featureName":"articles_per_month","limit":100}]}' \
  https://yourapp.com/api/admin/roles/{roleId}/feature-limits
```

---

## File Structure

```
/prisma
  schema.prisma                    # Updated with 7 new models

/src
  /lib
    auth.ts                        # Updated SessionPayload
    subscription.ts                # Core service
    subscription-middleware.ts     # Middleware helpers
  
  /schemas
    subscription.schema.ts         # ZOD schemas
  
  /app/api
    /admin
      /permissions
        route.ts                   # Manage permissions
      /roles
        route.ts                   # List roles
        /[roleId]
          /permissions
            route.ts               # Assign/remove permissions
          /feature-limits
            route.ts               # Set limits
    
    /subscriptions
      /my-subscription
        route.ts                   # Get user's subscription
      /feature-usage
        /[featureName]
          route.ts                 # Get usage for feature
      /check-feature
        route.ts                   # Verify access to feature
  
  /components/admin
    SubscriptionRoleManager.tsx    # Admin UI for permissions
    FeatureLimitManager.tsx        # Admin UI for limits
    SubscriptionViewer.tsx         # User dashboard

SUBSCRIPTION_RBAC_GUIDE.md         # Complete documentation
SUBSCRIPTION_IMPLEMENTATION.md     # This file
```

---

## What's Not Included (For Future Implementation)

- ❌ **Payment Integration** (Stripe, PayPal)
- ❌ **Subscription Renewal** (Automation)
- ❌ **Dunning/Retry** (Failed payments)
- ❌ **Usage Analytics** (Advanced dashboards)
- ❌ **Team Accounts** (Multi-user subscriptions)
- ❌ **Coupon/Discount** (Promo codes)
- ❌ **Usage Alerts** (Email notifications)
- ❌ **Refunds** (Partial billing adjustments)

---

## Support & Troubleshooting

### Problem: Permissions not working

**Check:**
1. Run `npx prisma db seed` to ensure permissions exist
2. Verify subscription has role assigned
3. Check subscription.status === 'ACTIVE'
4. Verify permission assigned to role in database

### Problem: Feature usage not tracking

**Check:**
1. Call `incrementFeatureUsage()` after action
2. Verify feature exists in database
3. Check subscription has feature limits configured
4. Ensure billing cycle dates are correct

### Problem: Admin panel not loading

**Check:**
1. User is logged in as ADMIN (role: 'ADMIN')
2. Check browser console for API errors
3. Verify `/api/admin/roles` returns data
4. Check network tab for failed requests

### Problem: Usage shows as unlimited

**Check:**
1. Limit = -1 means unlimited
2. ENTERPRISE tier has all limits set to -1
3. Check FeatureLimitConfig has correct role

---

## Next Phase Actions

1. **Integrate Payment Processing**
   - Set up Stripe/PayPal webhook handlers
   - Implement subscription creation/renewal
   - Handle failed payments → PAST_DUE status

2. **Add More Features**
   - Template library
   - Document management
   - Client portal access
   - API tokens

3. **Advanced Analytics**
   - Usage history graphs
   - Trend analysis
   - Recommendations for upgrade

4. **Automation**
   - Automatic renewal reminder emails
   - Usage limit warning emails
   - Monthly invoice generation

---

## Questions?

Refer to `SUBSCRIPTION_RBAC_GUIDE.md` for:
- Detailed API documentation
- Code examples
- Implementation patterns
- Best practices
- Security notes
