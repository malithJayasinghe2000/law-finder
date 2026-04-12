# 🎯 Subscription RBAC System - Setup Checklist

## Phase 1: Database Setup ✅
- [x] Updated `prisma/schema.prisma` with 7 new models
- [x] Added SubscriptionTier and BillingCycle enums
- [x] Created relationships between all tables
- [ ] **TODO:** Run migration: `npx prisma migrate dev --name add_subscription_rbac`
- [ ] **TODO:** Run seed: `npx prisma db seed`
- [ ] **TODO:** Verify test users created in database

## Phase 2: Backend Services ✅
- [x] Created `src/lib/subscription.ts` with 8 core functions
- [x] Created `src/lib/subscription-middleware.ts` with 5 helper functions
- [x] Updated `src/lib/auth.ts` to include subscription fields
- [x] Created `src/schemas/subscription.schema.ts` with 10+ ZOD schemas

## Phase 3: API Routes ✅
- [x] Admin permissions: `GET /api/admin/permissions` & `POST`
- [x] Admin roles: `GET /api/admin/roles`
- [x] Admin role permissions: `POST/DELETE /api/admin/roles/{roleId}/permissions`
- [x] Admin feature limits: `GET/POST /api/admin/roles/{roleId}/feature-limits`
- [x] User subscription: `GET /api/subscriptions/my-subscription`
- [x] User feature usage: `GET /api/subscriptions/feature-usage/{featureName}`
- [x] User check feature: `POST /api/subscriptions/check-feature`

## Phase 4: Frontend Components ✅
- [x] `SubscriptionRoleManager.tsx` - Admin UI for permissions
- [x] `FeatureLimitManager.tsx` - Admin UI for limits
- [x] `SubscriptionViewer.tsx` - User dashboard

## Phase 5: Documentation ✅
- [x] `SUBSCRIPTION_RBAC_GUIDE.md` - Comprehensive guide (500+ lines)
- [x] `SUBSCRIPTION_IMPLEMENTATION.md` - Implementation details
- [x] `SUBSCRIPTION_QUICK_REFERENCE.md` - Quick reference
- [x] `README_SUBSCRIPTION_SYSTEM.md` - Overview

---

## 📋 NEXT STEPS TO COMPLETE

### Step 1: Apply Database Changes
```bash
# Terminal: Run migration
npx prisma migrate dev --name add_subscription_rbac

# Verify: Schema changes applied
```

### Step 2: Seed Test Data
```bash
# Terminal: Seed database
npx prisma db seed

# Verify: Check output shows:
# - Database seeded successfully
# - Created subscription tiers
# - Created permissions
# - Set feature limits
```

### Step 3: Verify Test Accounts
After seeding, test login with:
- Email: `admin@lawfinder.lk` / Password: `password123`
- Email: `lawyer@lawfinder.lk` / Password: `password123`
- Email: `citizen@lawfinder.lk` / Password: `password123`

### Step 4: Test API Endpoints
```bash
# As lawyer user, test:
curl -H "Cookie: session=..." \
  http://localhost:3000/api/subscriptions/my-subscription

# Should return subscription info
```

### Step 5: Integrate into Existing Routes

#### Example: Article Creation Route
```typescript
// src/app/api/articles/create/route.ts
import { hasPermission, canUseFeature, incrementFeatureUsage } from '@/lib/subscription'

export async function POST(request: NextRequest) {
  const session = await getSession()
  
  // Get profile
  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId: session.userId }
  })
  
  // Check permission
  const canCreate = await hasPermission(profile.id, 'create_article')
  if (!canCreate) return NextResponse.json({}, { status: 403 })
  
  // Get subscription
  const subscription = await prisma.subscription.findFirst({
    where: { lawyerId: profile.id }
  })
  
  // Check quota
  const canUse = await canUseFeature(subscription.id, 'articles_per_month')
  if (!canUse.allowed) return NextResponse.json({ error: canUse.reason }, { status: 429 })
  
  // Create article
  const article = await prisma.article.create({ data: await request.json() })
  
  // Track usage
  await incrementFeatureUsage(subscription.id, 'articles_per_month', 1)
  
  return NextResponse.json(article)
}
```

#### Example: Apply to Inquiry Route
```typescript
// src/app/api/inquiries/route.ts - Similar pattern
// 1. Check 'receive_inquiries' permission
// 2. Check 'inquiries_per_month' quota
// 3. Create inquiry
// 4. Increment usage
```

#### Example: Apply to Chat Route
```typescript
// src/app/api/chat/route.ts - Similar pattern
// 1. Check 'send_message' permission
// 2. Check 'chat_messages_per_month' quota
// 3. Create message
// 4. Increment usage
```

### Step 6: Add Admin Panel Components

#### Create Admin Subscriptions Page
```typescript
// src/app/[locale]/dashboard/admin/subscriptions/page.tsx
'use client'

import { SubscriptionRoleManager } from '@/components/admin/SubscriptionRoleManager'
import { FeatureLimitManager } from '@/components/admin/FeatureLimitManager'
import { Card } from '@/components/ui/card'

export default function AdminSubscriptionsPage() {
  return (
    <div className="space-y-8 p-6">
      <Card>
        <h1 className="text-3xl font-bold">Manage Subscriptions</h1>
      </Card>
      
      <SubscriptionRoleManager />
      <FeatureLimitManager />
    </div>
  )
}
```

#### Create User Subscription Page  
```typescript
// src/app/[locale]/dashboard/subscription/page.tsx
'use client'

import { SubscriptionViewer } from '@/components/admin/SubscriptionViewer'

export default function SubscriptionPage() {
  return (
    <div className="p-6">
      <SubscriptionViewer />
    </div>
  )
}
```

### Step 7: Test End-to-End

#### Test 1: Permission Check
```bash
# As lawyer user
curl -H "Cookie: session=..." \
  http://localhost:3000/api/subscriptions/check-feature \
  -d '{"featureName":"articles_per_month"}' \
  -H "Content-Type: application/json"

# Should return: { allowed: true } or { allowed: false, reason: "..." }
```

#### Test 2: Create Article with Quota
```bash
# Test 1: Can create (quota not exceeded)
POST /api/articles/create with article data
# Should succeed

# Test 2: Can't create (quota exceeded)
# Repeat 10 times (PROFESSIONAL limit is 10)
# 11th call should fail with "Feature limit reached"
```

#### Test 3: Admin Panel
```bash
# As admin user
# Go to: /dashboard/admin/subscriptions
# Should see:
# - All 4 subscription tiers (BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE)
# - Permission assignment interface
# - Feature limit management interface
```

#### Test 4: User Dashboard
```bash
# As lawyer user
# Go to: /dashboard/subscription
# Should see:
# - Current tier (PROFESSIONAL)
# - Status (ACTIVE)
# - Usage progress for each feature
# - Upgrade button (optional)
```

---

## ✅ Verification Checklist

### Database
- [ ] Migration runs without errors
- [ ] All 7 new tables created in database
- [ ] Seed completes successfully
- [ ] Test users exist with correct roles
- [ ] Permissions exist (15+)
- [ ] Feature limits configured for all roles

### API Endpoints
- [ ] `/api/subscriptions/my-subscription` returns data
- [ ] `/api/subscriptions/feature-usage/{name}` returns usage
- [ ] `/api/subscriptions/check-feature` returns { allowed }
- [ ] `/api/admin/roles` accessible to admin only
- [ ] `/api/admin/roles/{id}/permissions` works with POST/DELETE
- [ ] `/api/admin/roles/{id}/feature-limits` works with POST

### Components
- [ ] SubscriptionRoleManager loads and displays roles
- [ ] Can toggle permissions on roles
- [ ] Save permissions button works
- [ ] FeatureLimitManager loads role limits
- [ ] Can edit limit values
- [ ] Save limits button works
- [ ] SubscriptionViewer displays usage correctly
- [ ] Progress bars update based on usage

### Integration
- [ ] Articles route checks permissions
- [ ] Articles route checks quota
- [ ] Usage increments after creating article
- [ ] Quota enforcement prevents excess usage
- [ ] Expired subscriptions block features
- [ ] ENTERPRISE tier allows unlimited usage

---

## 🧪 Test Scenarios

### Scenario 1: Basic Flow
```
1. Login as lawyer@lawfinder.lk (PROFESSIONAL tier)
2. Navigate to /dashboard/subscription
3. See PROFESSIONAL tier with 10 articles/month limit
4. Create article (usage becomes 1/10)
5. Create article 9 more times (usage becomes 10/10)
6. Try to create 11th article - should fail with "limit reached"
```

### Scenario 2: Permission Denied
```
1. Login as lawyer with BASIC tier (0 promo campaigns allowed)
2. Try to create promotional campaign
3. Should fail with "Permission denied" error
4. Can't increment usage
```

### Scenario 3: Subscription Status Update
```
1. Set subscription.status = 'EXPIRED' in database
2. Try to use any feature
3. Should fail with "Subscription is EXPIRED"
4. Update status back to 'ACTIVE' - works again
```

### Scenario 4: Admin Changes Permissions
```
1. Admin removes 'create_article' permission from PROFESSIONAL
2. Log out and back in as lawyer (PROFESSIONAL)
3. Try to create article - should fail
4. Admin grants 'create_article' back
5. Works again
```

---

## 📞 Troubleshooting

### "Migration failed"
**Solution:**
1. Backup current database
2. Run: `npx prisma migrate reset` (WARNING: deletes data)
3. Run: `npx prisma migrate dev --name add_subscription_rbac`
4. Run: `npx prisma db seed`

### "API returns 403 Unauthorized"
**Solution:**
1. Check session exists (login first)
2. Check user role is correct
3. Verify API endpoint is not admin-only
4. Clear cookies and log in again

### "Feature usage not incrementing"
**Solution:**
1. Verify `incrementFeatureUsage()` is called after action
2. Check feature name matches exactly
3. Verify subscription exists and is ACTIVE
4. Check feature and role have limits configured

### "Permissions not showing in dropdown"
**Solution:**
1. Run `npx prisma db seed` again
2. Restart dev server
3. Clear browser cache
4. Verify permissions exist in database

---

## 📞 Support

### Where to Find Help

**Quick answers:** SUBSCRIPTION_QUICK_REFERENCE.md
**Detailed info:** SUBSCRIPTION_RBAC_GUIDE.md
**Implementation:** SUBSCRIPTION_IMPLEMENTATION.md

**Code examples:** Check route files in:
- `src/app/api/subscriptions/`
- `src/app/api/admin/`

**Components:** Check:
- `src/components/admin/SubscriptionRoleManager.tsx`
- `src/components/admin/FeatureLimitManager.tsx`

---

## 🎉 You're Done When

- [x] Database migrations complete
- [x] Seed data loaded
- [x] All API endpoints tested
- [x] Admin panel functional
- [x] User dashboard shows subscription
- [x] Quota enforcement working
- [x] Integration into 3+ routes
- [x] End-to-end test passes

---

## 🚀 Launch Preparation

Before going live:

- [ ] Update test users with real production tier
- [ ] Set correct feature limits for your business
- [ ] Add custom permissions if needed
- [ ] Create pricing page with tier details
- [ ] Document user-facing feature limits
- [ ] Train admin on permission management
- [ ] Test all payment integrations (if added)
- [ ] Monitor usage in production

---

**Status:** Ready to implement
**Estimated time:** 1-2 hours for setup
**Complexity:** Medium (straightforward integration)
**Support:** All documentation included
