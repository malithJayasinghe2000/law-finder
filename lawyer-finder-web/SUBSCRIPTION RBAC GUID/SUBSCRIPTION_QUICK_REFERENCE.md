# Subscription System - Quick Reference

## 🚀 Quick Start

### Admin URLs
```
Dashboard:    /dashboard/admin/subscriptions
Plans:        /dashboard/admin/subscriptions/plans
Roles:        /dashboard/admin/subscriptions/roles
Permissions:  /dashboard/admin/subscriptions/permissions
Usage:        /dashboard/admin/subscriptions/usage
```

### User URLs  
```
Profile:      /profile
Lawyer View:  /lawyers/[id]
Header:       Click profile icon to see subscription
```

---

## 🔑 Key Concepts

| Term | Meaning |
|------|---------|
| **Plan** | Pricing tier (BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE) |
| **Role** | Subscription tier that has a set of permissions |
| **Permission** | Feature-level access (e.g., "create_posts") |
| **Usage** | Count of how many times a feature was used |
| **Status** | Subscription state (ACTIVE, EXPIRED, PAST_DUE, CANCELED) |

---

## ✅ Admin Tasks Checklist

- [ ] Create 4 subscription plans
- [ ] Set monthly and yearly pricing
- [ ] Create 4 subscription roles (one per plan)
- [ ] Create 30+ permissions across 8 categories
- [ ] Assign permissions to each role
- [ ] Set feature limits per tier
- [ ] Test permission checking

---

## 💻 Code Examples

### Check Permission in API
```typescript
async function POST(req: Request) {
  const session = await getSession();
  
  // Verify user has permission
  const hasPermission = session.permissions?.includes('create_posts');
  if (!hasPermission) {
    return NextResponse.json(
      { error: 'Feature not available in your plan' },
      { status: 403 }
    );
  }
  
  // Your logic here
}
```

### Track Feature Usage
```typescript
import { trackFeatureUsage } from '@/lib/subscription';

// When user performs action
await trackFeatureUsage(lawyerId, 'inquiries_received', 1);
```

### Check in Component
```typescript
import { useSession } from 'next-auth/react';

export function MyFeature() {
  const { data: session } = useSession();
  
  if (!session?.permissions?.includes('feature_name')) {
    return <UpgradePrompt />;
  }
  
  return <FeatureComponent />;
}
```

---

## 📊 Feature Limits Template

```typescript
// Define in your config
const FEATURE_LIMITS = {
  BASIC: {
    inquiries_per_month: 50,
    posts_per_month: 10,
  },
  PROFESSIONAL: {
    inquiries_per_month: 500,
    posts_per_month: 100,
  },
  PREMIUM: {
    inquiries_per_month: -1, // unlimited
    posts_per_month: -1,
  },
  ENTERPRISE: {
    inquiries_per_month: -1,
    posts_per_month: -1,
  },
};
```

---

## 🎨 Display Subscription UI

### In Header
```tsx
{subscription && (
  <Badge className="bg-amber-100 text-amber-800">
    <Zap className="w-4 h-4 mr-1" />
    {subscription.tier}
  </Badge>
)}
```

### In Profile
```tsx
<div className="subscription-card">
  <h3>{subscription.tier}</h3>
  <p>Next billing: {formatDate(subscription.nextBilling)}</p>
  <p>Cycle: {subscription.billingCycle}</p>
</div>
```

### Lock Feature Button
```tsx
<Button disabled={!permissions?.includes('feature')} onClick={upgrade}>
  {permissions?.includes('feature') ? 'Use Feature' : 'Upgrade'}
</Button>
```

---

## 🔐 Permission Slug Naming

```
Format: action_object_modifier
Examples:
  - create_posts
  - unlimited_profiles
  - advanced_analytics
  - view_all_inquiries
  - respond_to_reviews
  - export_data
  - 24hr_support
```

---

## 📅 Billing Cycles

### MONTHLY
- Renews: Every 30 days
- Value: `plan.monthlyAmount`
- Example: $29/mon

### YEARLY  
- Renews: Every 365 days
- Value: `plan.yearlyAmount`  
- Example: $290/yr (10% discount like others)

---

## 🚨 Status Meanings

- **ACTIVE** - Full access, subscription valid
- **EXPIRED** - Subscription period ended
- **PAST_DUE** - Payment overdue
- **CANCELED** - User canceled subscription

---

## 🎯 Common Workflows

### 1. Add New Feature Access
```
1. Create Permission in UI
   Name: "Advanced Reports"
   Slug: "advanced_reports"
   Category: "analytics"

2. Add to Desired Roles
   Go to Roles page
   Edit each role
   Check "Advanced Reports"
   Save

3. Start Checking in Code
   if (!permissions.includes('advanced_reports')) {
     // disable feature
   }
```

### 2. Set Feature Limit
```
1. Create Permission first
2. In FeatureUsage table:
   INSERT INTO "FeatureUsage" 
   (featureName, limit, subscriptionId)
   VALUES ('posts_per_month', 100, subId)

3. Track Usage:
   await trackFeatureUsage(lawyerId, 'posts_per_month', 1)

4. Check in Admin Dashboard
   See real-time usage and status
```

### 3. Restrict Feature by Tier
```
// In your <FeatureComponent>
const canUseFeature = 
  subscription?.tier === 'PREMIUM' || 
  subscription?.tier === 'ENTERPRISE';

// Or:
const canUseFeature = 
  permissions?.includes('advanced_analytics');
```

---

## 🧪 Testing Checklist

- [ ] Create test plan with different pricing
- [ ] Create test role and assign permissions
- [ ] Login as lawyer with BASIC plan
- [ ] Verify restricted features are hidden
- [ ] Login as lawyer with PREMIUM plan
- [ ] Verify all features are visible
- [ ] Test feature usage tracking
- [ ] Check admin dashboard shows correct data
- [ ] Verify subscription displays in header
- [ ] Check subscription shows on public profile

---

## ⚠️ Common Mistakes to Avoid

❌ **Not checking permission on backend**
✅ Do: Validate on both frontend AND backend

❌ **Hard deleting subscription data**
✅ Do: Use status field for soft delete

❌ **Forgetting to track usage**
✅ Do: Call trackFeatureUsage() before action

❌ **Not handling expired subscriptions**
✅ Do: Check subscription.status in middleware

❌ **Mixing UI permission checks with backend**
✅ Do: Use same permission slugs everywhere

---

## 📱 UI Pattern: Feature Locked

```tsx
import { Lock, Zap } from 'lucide-react';

<div className="relative opacity-60">
  <YourFeature disabled />
  
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="bg-white/90 backdrop-blur px-4 py-3 rounded-lg">
      <div className="flex items-center gap-2 text-amber-600 font-semibold">
        <Zap className="w-4 h-4" />
        Only in PREMIUM
      </div>
    </div>
  </div>
</div>
```

---

## 🐛 Debug Tips

### Check permissions in console
```typescript
const session = await getSession();
console.log('Permissions:', session?.permissions);
```

### Check subscription in admin
Go to `/dashboard/admin/subscriptions/usage`
Search for lawyer name
See all their feature usage

### Check API response
```typescript
fetch('/api/profile')
  .then(r => r.json())
  .then(data => console.log('Subscription:', data.subscription))
```

---

## 📞 Support URLs

- **Docs:** `SUBSCRIPTION_USAGE_GUIDE.md`
- **Report:** `SUBSCRIPTION_IMPLEMENTATION_REPORT.md`
- **Code:** Look in `/src/lib/subscription.ts`
- **Routes:** Look in `/src/app/api/admin/subscriptions/`

---

**Keep this handy for quick lookups while developing! 📌**
```

**Check feature usage**
```bash
GET /api/subscriptions/feature-usage/articles_per_month
```

**Verify feature access**
```bash
POST /api/subscriptions/check-feature
Body: { "featureName": "articles_per_month" }
```

### Admin Endpoints

**List all roles**
```bash
GET /api/admin/roles
```

**List all permissions**
```bash
GET /api/admin/permissions
```

**Assign permissions to role**
```bash
POST /api/admin/roles/{roleId}/permissions/assign
Body: { "permissionIds": ["uuid1", "uuid2"] }
```

**Remove permissions from role**
```bash
DELETE /api/admin/roles/{roleId}/permissions/remove
Body: { "permissionIds": ["uuid1"] }
```

**Get feature limits**
```bash
GET /api/admin/roles/{roleId}/feature-limits
```

**Update feature limits**
```bash
POST /api/admin/roles/{roleId}/feature-limits
Body: { "limits": [{"featureName": "articles_per_month", "limit": 50}] }
```

## Permission Slugs

### Articles
- `create_article` - Create new articles
- `edit_article` - Edit own articles
- `delete_article` - Delete articles
- `publish_article` - Publish articles

### Inquiries
- `receive_inquiries` - Receive client inquiries
- `post_inquiry` - Post inquiries to clients
- `manage_inquiries` - Manage all inquiries

### Chat
- `access_chat` - Access chat functionality
- `send_message` - Send messages

### Profile
- `edit_profile` - Edit profile info
- `upload_documents` - Upload documents

### Promotions
- `access_paid_promo` - Access paid promotions
- `create_promo` - Create promotional campaigns

### Analytics
- `view_analytics` - View analytics
- `export_data` - Export data

## Feature Names

- `articles_per_month` - Number of articles per month
- `inquiries_per_month` - Number of inquiries per month
- `chat_messages_per_month` - Number of chat messages per month
- `promo_campaigns_per_month` - Number of promotional campaigns per month
- `storage_gb` - Storage space in GB

## Default Limits

| Feature | BASIC | PROF | PREMIUM | ENTERPRISE |
|---------|-------|------|---------|------------|
| Articles | 2 | 10 | 50 | ∞ |
| Inquiries | 10 | 50 | 200 | ∞ |
| Chat Messages | 50 | 500 | 2000 | ∞ |
| Promos | 0 | 2 | 10 | ∞ |
| Storage (GB) | 1 | 5 | 20 | ∞ |

## Common Patterns

### In API Route
```typescript
import { getSession } from '@/lib/auth'
import { hasPermission, canUseFeature, incrementFeatureUsage } from '@/lib/subscription'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({}, { status: 401 })

  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId: session.userId }
  })

  // Check permission
  const canCreate = await hasPermission(profile.id, 'create_article')
  if (!canCreate) return NextResponse.json({}, { status: 403 })

  // Get subscription
  const sub = await prisma.subscription.findFirst({
    where: { lawyerId: profile.id }
  })

  // Check quota
  const canUse = await canUseFeature(sub.id, 'articles_per_month')
  if (!canUse.allowed) {
    return NextResponse.json({ error: canUse.reason }, { status: 429 })
  }

  // Create resource
  const article = await prisma.article.create({ data })

  // Track usage
  await incrementFeatureUsage(sub.id, 'articles_per_month', 1)

  return NextResponse.json(article)
}
```

### In Frontend Component
```typescript
'use client'

import { useEffect, useState } from 'react'

export function ArticleForm() {
  const [canCreate, setCanCreate] = useState(false)

  useEffect(() => {
    fetch('/api/subscriptions/check-feature', {
      method: 'POST',
      body: JSON.stringify({ featureName: 'articles_per_month' })
    })
    .then(r => r.json())
    .then(data => setCanCreate(data.allowed))
  }, [])

  if (!canCreate) {
    return <div>Upgrade your subscription to create articles</div>
  }

  return <form>{...}</form>
}
```

## Test Users

After running `npx prisma db seed`:

```
Email: admin@lawfinder.lk
Password: password123
Role: ADMIN

Email: lawyer@lawfinder.lk
Password: password123
Role: LAWYER → PROFESSIONAL subscription

Email: citizen@lawfinder.lk
Password: password123
Role: CLIENT
```

## Troubleshooting

### "Feature limit reached"
→ User has hit their monthly/yearly limit
→ Wait for billing cycle reset or upgrade

### "Missing permission"
→ User's subscription tier doesn't include this permission
→ Upgrade to higher tier or assign permission via admin

### "No active subscription"
→ User doesn't have a subscription
→ Create subscription first

### "Feature not found"
→ Feature name typo
→ Check feature exists: run `npx prisma db seed`

## To Add a New Feature

1. Create feature in seed or manually:
```typescript
await prisma.feature.create({
  data: {
    name: 'api_calls_per_day',
    slug: 'api-calls-per-day',
    unit: 'count',
    description: 'API calls per day'
  }
})
```

2. Set limits for each role:
```typescript
await prisma.featureLimitConfig.create({
  data: {
    roleId: premiumRole.id,
    featureName: 'api_calls_per_day',
    limit: 1000
  }
})
```

3. Use in code:
```typescript
await incrementFeatureUsage(subscriptionId, 'api_calls_per_day', 1)
```

## To Add a New Permission

1. Create permission:
```typescript
await prisma.permission.create({
  data: {
    name: 'api_access',
    slug: 'api-access',
    category: 'api',
    description: 'Access REST API'
  }
})
```

2. Assign to roles via admin panel

3. Use in code:
```typescript
const hasAccess = await hasPermission(lawyerId, 'api_access')
```
