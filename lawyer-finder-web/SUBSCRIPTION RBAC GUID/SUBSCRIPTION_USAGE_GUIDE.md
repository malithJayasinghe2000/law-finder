# Subscription Access Control System - Setup & Usage Guide

## Overview

This comprehensive subscription management system provides:
- **RBAC (Role-Based Access Control)** with permissions tied to subscription roles
- **Usage Tracking** for features with limits per subscription tier
- **Soft Delete Pattern** with status management (no hard deletion)
- **Multi-level Validation** (Frontend + Backend)
- **Admin Dashboard** for managing subscriptions, roles, and permissions
- **Lawyer Profile Display** showing active subscription tiers

---

## System Architecture

### Database Models

#### 1. **SubscriptionPlan**
- Stores different subscription tiers (BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE)
- Monthly and yearly pricing
- Linked to subscriptions and feature limits

#### 2. **Subscription**
- User subscription instance
- Status: ACTIVE, EXPIRED, CANCELED, PAST_DUE
- Billing cycle: MONTHLY or YEARLY
- Auto-renewal settings
- Start date, end date, next billing date

#### 3. **SubscriptionRole**
- Maps subscription tiers to roles (BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE)
- Defines what permissions each tier has

#### 4. **Permission**
- System features that can be restricted
- Categories: features, posts, inquiries, reviews, messaging, analytics, billing, settings
- Slug-based identifiers for validation

#### 5. **RolePermission**
- Junction table linking roles to permissions
- Many-to-many relationship

#### 6. **FeatureUsage**
- Tracks usage of limited features
- Counts current usage vs. limits
- Status alerts (safe, warning, exceeded)

#### 7. **SubscriptionCycle**
- Historical record of subscription billing cycles
- Audit trail for billing

---

## Admin Panel - How to Use

### 1. **Access Subscription Management**
Navigate to: `Dashboard > Subscriptions`

### 2. **Manage Subscription Plans**
Path: `/dashboard/admin/subscriptions/plans`

**What you can do:**
- Create new plans (BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE)
- Set monthly and yearly pricing
- Add plan descriptions
- Edit existing plans
- Delete plans (soft delete - status field)

**Example:**
```
Plan: PROFESSIONAL
Tier: PROFESSIONAL
Monthly: $99
Yearly: $999
Features: 50 inquiries/month, custom profiles, basic analytics
```

### 3. **Manage Subscription Roles**
Path: `/dashboard/admin/subscriptions/roles`

**What you can do:**
- Create roles for each subscription tier
- Assign permissions to roles
- Edit role and permission assignments
- Delete roles

**Example Workflow:**
1. Create role "PROFESSIONAL"
2. Assign permissions:
   - features:unlimited_profiles
   - posts:create
   - inquiries:view_all
   - reviews:respond
   - analytics:basic
3. Save

Lawyers with PROFESSIONAL subscription automatically have these permissions.

### 4. **Manage Permissions**
Path: `/dashboard/admin/subscriptions/permissions`

**What you can do:**
- Create new feature permissions
- Organize by category
- Set descriptions
- Edit and delete permissions

**Example Permissions:**
```
Name: Create Unlimited Profiles
Slug: unlimited_profiles
Category: features
Description: Allows lawyer to create multiple practice profiles

Name: Access Advanced Analytics
Slug: advanced_analytics
Category: analytics
Description: View detailed statistics and insights
```

**Permission Categories:**
- `features` - Core feature access
- `posts` - Blog/article creation
- `inquiries` - Client inquiry management
- `reviews` - Review handling
- `messaging` - Communication tools
- `analytics` - Reporting and insights
- `billing` - Subscription management
- `settings` - Configuration access

### 5. **Monitor Usage Tracking**
Path: `/dashboard/admin/subscriptions/usage`

**Metrics displayed:**
- Total lawyers with subscriptions
- Active subscriptions count
- Features being tracked
- Average usage percentage
- Per-lawyer feature usage with status:
  - **Safe** (0-75%): Green
  - **Warning** (75-90%): Yellow  
  - **Exceeded** (90%+): Red

**Example:**
```
Lawyer: John Smith
Tier: PROFESSIONAL
Feature: Monthly Inquiries
Usage: 45/50 (90%) - WARNING
Status: Getting close to limit
```

---

## Middleware - Subscription Checks

### How It Works (Automatic)

Every request goes through the subscription middleware (`/src/lib/subscription-middleware.ts`):

**On User Login:**
1. Check if user is LAWYER
2. Fetch active subscription
3. Get subscription role and permissions
4. Store in session: `subscriptionRole`, `permissions`, `subscriptionStatus`

**On Every API Request:**
1. Verify subscription status
2. Check if subscription is expired or past due
3. Validate user has required permission
4. Track feature usage (if applicable)
5. Block action if limit exceeded

**Status Checks:**
```
- ACTIVE: Full access ✅
- EXPIRED: Prompt to renew ⏰
- PAST_DUE: Access limited ⚠️
- CANCELED: No access ❌
```

---

## Checking Permissions in Code

### Backend (API Routes)

```typescript
// In your API route
import { checkPermission } from '@/lib/subscription-middleware';

export async function POST(req: Request) {
  const session = await getSession();
  
  // Check if user has permission
  const hasPermission = await checkPermission(
    session.userId,
    'create_posts'
  );

  if (!hasPermission) {
    return NextResponse.json(
      { error: 'Insufficient subscription for this feature' },
      { status: 403 }
    );
  }

  // Proceed with action
}
```

### Track Feature Usage

```typescript
import { trackFeatureUsage } from '@/lib/subscription.ts';

// When user performs an action
await trackFeatureUsage(lawyerId, 'inquiries_received', 1);

// System automatically:
// - Increments usage count
// - Checks against limit
// - Sets status (safe/warning/exceeded)
// - Logs usage record
```

### Frontend (UI Components)

```typescript
// Check if feature is available
const hasPermission = userPermissions?.includes('create_posts');

if (!hasPermission) {
  return <DisabledFeature message="Upgrade your plan" />;
}
```

---

## Lawyer Profile - Displaying Subscriptions

### Public Lawyer Profile
Path: `/lawyers/[id]`

**Shows:**
- Subscription tier badge (e.g., "PROFESSIONAL")
- Verified status badge
- Only active subscriptions displayed

**Example Display:**
```
[VERIFIED BADGE] [PROFESSIONAL BADGE]
John Smith
Criminal Defense Lawyer
```

### Header Profile Icon
When a lawyer clicks their profile icon:
1. Shows current subscription tier
2. Shows next billing date
3. Link to upgrade if no subscription
4. Link to subscription management

**Example:**
```
John Smith
LAWYER

⚡ PROFESSIONAL
Next billing: April 15, 2024
```

### Lawyer's Own Profile Page
Path: `/profile`

**Displays:**
- Full subscription details
- Billing information
- Subscription history
- Usage statistics
- Upgrade/manage buttons

---

## Database Seeding - Initial Setup

The `seed.ts` file creates initial data:

### 1. **Default Subscription Plans**
```
BASIC: $9/month, $90/year
PROFESSIONAL: $29/month, $290/year
PREMIUM: $79/month, $790/year
ENTERPRISE: Contact us (custom pricing)
```

### 2. **Default Permissions** (30+ permissions)
Categories:
- **Features**: unlimited_profiles, bulk_posting, etc.
- **Posts**: create, edit, delete, publish
- **Inquiries**: view_all, respond, assign
- **Reviews**: respond, moderate, hide
- **Messaging**: unlimited_messages, 24hr_support
- **Analytics**: basic, advanced, export_data
- **Billing**: manage_cards, view_invoices
- **Settings**: customize_profile, team_management

### 3. **Role-Permission Mappings**
```
BASIC → 10 core features
PROFESSIONAL → 20 features
PREMIUM → 30 features
ENTERPRISE → All features + custom
```

### 4. **Feature Limits** (Sample)
```
BASIC:
  - Max 50 inquiries/month
  - Max 10 posts/month
  - Basic analytics

PROFESSIONAL:
  - Max 500 inquiries/month
  - Max 100 posts/month
  - Advanced analytics

PREMIUM:
  - Unlimited inquiries
  - Unlimited posts
  - All analytics, priority support

ENTERPRISE:
  - Everything
  - Custom limits
  - Dedicated account manager
```

---

## API Endpoints Reference

### Public Endpoints
```
GET  /api/subscriptions/plans          - List all plans
GET  /api/subscriptions/plans/:id      - Get plan details
```

### Protected Endpoints (Admin)
```
POST   /api/admin/subscriptions/plans           - Create plan
PUT    /api/admin/subscriptions/plans/:id       - Update plan
DELETE /api/admin/subscriptions/plans/:id       - Delete plan

POST   /api/admin/subscriptions/roles           - Create role
PUT    /api/admin/subscriptions/roles/:id       - Update role
DELETE /api/admin/subscriptions/roles/:id       - Delete role

POST   /api/admin/subscriptions/permissions           - Create permission
PUT    /api/admin/subscriptions/permissions/:id       - Update permission
DELETE /api/admin/subscriptions/permissions/:id       - Delete permission

GET  /api/admin/subscriptions/usage            - Get usage data
GET  /api/admin/subscriptions/usage/stats      - Get usage stats
GET  /api/admin/subscriptions/stats            - Get subscription stats
```

### User Endpoints
```
GET  /api/profile                    - Get current user's profile + subscription
GET  /api/profile/permissions        - Get current user's permissions
GET  /api/profile/usage              - Get current user's feature usage
```

---

## Common Use Cases

### 1. **Limit Feature Access Based on Tier**

```typescript
// API Route
export async function POST(req: Request) {
  const session = await getSession();
  
  // Check permission
  if (!session.permissions.includes('create_paid_promoting')) {
    return NextResponse.json(
      { error: 'Available in PREMIUM plan' },
      { status: 403 }
    );
  }

  // Proceed...
}

// Frontend Component
export function PaidPromoButton() {
  const { permissions } = useUser();
  
  if (!permissions?.includes('create_paid_promoting')) {
    return <LockedButton tooltip="Upgrade to PREMIUM" />;
  }

  return <CreatePromoButton />;
}
```

### 2. **Track Feature Usage**

```typescript
import { trackFeatureUsage } from '@/lib/subscription';

// When lawyer sends inquiry response
await trackFeatureUsage(lawyerId, 'responses_sent', 1);

// When lawyer views analytics
await trackFeatureUsage(lawyerId, 'analytics_views', 1);

// System blocks if limit reached:
// - PROFESSIONAL: 100/month
// - PREMIUM: 500/month
// - ENTERPRISE: Unlimited
```

### 3. **Suggest Upgrade on Limit**

```typescript
const usageResponse = await fetch('/api/profile/usage');
const usage = await usageResponse.json();

const warning = usage.find(u => u.status === 'warning' || u.status === 'exceeded');

if (warning) {
  toast.warning(
    `You're using ${warning.percentageUsed}% of your ${warning.feature} limit. Upgrade to continue.`
  );
}
```

### 4. **Display Subscription Info in UI**

```typescript
// In Header
{subscription && (
  <Badge className="bg-amber-100 text-amber-800">
    <Zap className="w-4 h-4 mr-1" />
    {subscription.tier}
  </Badge>
)}

// In Profile Page
<div className="subscription-card">
  <h3>Current Plan: {subscription.tier}</h3>
  <p>Next billing: {formatDate(subscription.nextBilling)}</p>
  <p>Billing cycle: {subscription.billingCycle}</p>
  <p>Auto-renewal: {subscription.autoRenew ? 'Enabled' : 'Disabled'}</p>
</div>
```

---

## Billing Cycles

### MONTHLY
- Renews every 30 days
- Amount: `plan.monthlyAmount`
- Example: $29/month for PROFESSIONAL

### YEARLY
- Renews every 365 days  
- Amount: `plan.yearlyAmount`
- Usually 20-30% discount
- Example: $290/year for PROFESSIONAL (vs $348 monthly)

---

## Status Management (Soft Delete)

This system uses **status fields** instead of hard deletion:

```typescript
// Instead of: DELETE FROM subscriptions WHERE id = '123'
// We do:
UPDATE subscriptions SET status = 'CANCELED' WHERE id = '123'

// Instead of: DELETE FROM permissions WHERE id = '456'
// We do:
UPDATE permissions SET status = 'INACTIVE' WHERE id = '456'
```

**Benefits:**
- Preserve audit history
- Easy to restore/reactivate
- Compliance with data preservation
- Query by status instead

---

## Troubleshooting

### Issue: "Insufficient subscription for this feature"
**Solution:**
1. Check user's active subscription exists
2. Verify role has permission assigned
3. Check permission slug matches code

### Issue: Feature usage not tracking
**Solution:**
1. Verify `trackFeatureUsage()` is called
2. Check feature limit exists for tier
3. View usage in admin panel

### Issue: Permission denied but user should have access
**Solution:**
1. Check subscription status (not expired)
2. Verify RolePermission mapping exists
3. Clear session cache and re-login

### Issue: Old subscription config form still showing
**Solution:**
1. Remove/delete the old `/subscriptions/plans` folder
2. Use new `/subscriptions/plans` instead
3. Clear browser cache

---

## Next Steps

1. **Run Database Seed**: `npm run seed` to create initial data
2. **Create Subscription Plans**: Go to admin panel and set up your tiers
3. **Add Permissions**: Define what features each tier has access to
4. **Configure Roles**: Link permissions to subscription roles  
5. **Set Usage Limits**: Define feature limits per tier
6. **Test Flows**: Login as different tier users and test access

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── admin/
│   │       └── subscriptions/
│   │           ├── plans/route.ts
│   │           ├── roles/route.ts
│   │           └── permissions/route.ts
│   └── [locale]/
│       ├── dashboard/admin/subscriptions/
│       │   ├── page.tsx
│       │   ├── plans/page.tsx
│       │   ├── roles/page.tsx
│       │   ├── permissions/page.tsx
│       │   └── usage/page.tsx
│       └── (public)/lawyers/[id]/
│           ├── page.tsx
│           └── LawyerProfileClient.tsx
├── lib/
│   ├── subscription.ts          # Core subscription logic
│   ├── subscription-middleware.ts  # Middleware checks
│   └── auth.ts
├── schemas/
│   └── subscription.schema.ts   # ZOD validation
└── components/
    └── layout/
        └── Header.tsx           # Updated with subscription display
```

---

## Key Features Summary

✅ **RBAC System** - Role-based access with granular permissions
✅ **Usage Tracking** - Monitor feature consumption with alerts  
✅ **Multi-level Validation** - Frontend + Backend checks
✅ **Soft Delete** - Status-based deletion (not hard delete)
✅ **Admin Dashboard** - Full management interface
✅ **Profile Integration** - Show subscription on lawyer profiles  
✅ **Billing Cycles** - Support monthly and yearly plans  
✅ **Middleware Integration** - Automatic subscription verification
✅ **Responsive UI** - Works on desktop and mobile
✅ **Audit Trail** - Full history of subscriptions and changes

---

**That's it! Your subscription system is ready to use.** 🎉
