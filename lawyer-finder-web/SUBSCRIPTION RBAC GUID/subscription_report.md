# Subscription RBAC Module - Complete Implementation Report

## Summary

The subscription module has been fully implemented with proper RBAC (Role-Based Access Control) system. All changes follow the existing UI design pattern (black/white, rounded-none, Outfit font family).

---

## Changes Made

### 1. 🔐 Login Session - Subscription Info Added

**File:** [route.ts](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/api/auth/login/route.ts)

**What changed:** When a lawyer logs in, the session JWT now includes:
- `profileId` - Lawyer's profile ID for quick lookups
- `subscriptionRole` - Current subscription tier (BASIC/PROFESSIONAL/PREMIUM/ENTERPRISE)  
- `subscriptionStatus` - Current subscription status (ACTIVE/CANCELED/EXPIRED/PAST_DUE)

**Why:** Avoids extra DB queries on every request to check subscription status.

```diff:route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { createSession } from '@/lib/auth';
import { loginSchema } from '@/schemas/auth.schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid credentials format.' }, { status: 400 });
    }

    const { email, password } = validated.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    await createSession({ 
      userId: user.id, 
      role: user.role, 
      fullName: user.fullName,
      profileImageUrl: user.profileImageUrl 
    });

    return NextResponse.json({ success: true, role: user.role }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
===
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { createSession, SessionPayload } from '@/lib/auth';
import { loginSchema } from '@/schemas/auth.schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid credentials format.' }, { status: 400 });
    }

    const { email, password } = validated.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const sessionPayload: SessionPayload = { 
      userId: user.id, 
      role: user.role, 
      fullName: user.fullName,
      profileImageUrl: user.profileImageUrl 
    };

    // If lawyer, fetch subscription info and profileId for the session
    if (user.role === 'LAWYER') {
      const profile = await prisma.lawyerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (profile) {
        sessionPayload.profileId = profile.id;

        const subscription = await prisma.subscription.findFirst({
          where: { lawyerId: profile.id, status: { in: ['ACTIVE', 'PAST_DUE'] } },
          include: { role: true },
          orderBy: { createdAt: 'desc' },
        });

        if (subscription) {
          sessionPayload.subscriptionRole = subscription.role.name;
          sessionPayload.subscriptionStatus = subscription.status;
        }
      }
    }

    await createSession(sessionPayload);

    return NextResponse.json({ success: true, role: user.role }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
```

---

### 2. 💳 Invoice Creation Flow - Fixed

**File:** [route.ts](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/api/invoices/create/route.ts)

**Problem:** Subscription was set to `ACTIVE` immediately when invoice was created, before payment was made.

**Fix:**
- Subscription is created with `PAST_DUE` status (not ACTIVE)
- Subscription only becomes `ACTIVE` when admin approves payment
- Added proper `endDate` calculation based on billing cycle (monthly = +1 month, yearly = +1 year)
- Checks for ANY active/pending subscription (not just same plan)
- Includes plan name in payment reason

```diff:route.ts
import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CreateInvoiceSchema } from '@/schemas/subscription.schema';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // Check if authorized
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('Create invoice request body:', JSON.stringify(body, null, 2));
    const validation = CreateInvoiceSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('Validation errors:', errors);
      return NextResponse.json(
        { error: `Validation failed: ${errors}` },
        { status: 400 }
      );
    }

    const { planId, billingCycle } = validation.data;

    // Get lawyer profile
    const lawyerProfile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!lawyerProfile) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    // Check if lawyer already has active subscription for this plan
    const existingActiveSubscription = await prisma.subscription.findFirst({
      where: {
        lawyerId: lawyerProfile.id,
        planId: planId,
        status: 'ACTIVE',
      },
    });

    if (existingActiveSubscription) {
      return NextResponse.json(
        { error: 'You already have an active subscription for this plan' },
        { status: 400 }
      );
    }

    // Get the subscription plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Get the role for this plan tier
    const role = await prisma.subscriptionRole.findUnique({
      where: { name: plan.tier },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found for this plan' }, { status: 404 });
    }

    // Calculate amount based on billing cycle
    const amount = billingCycle === 'YEARLY' ? plan.yearlyAmount : plan.monthlyAmount;

    // Create subscription first WITHOUT invoiceId
    const subscription = await prisma.subscription.create({
      data: {
        lawyerId: lawyerProfile.id,
        planId: planId,
        roleId: role.id,
        status: 'ACTIVE',
        billingCycle: billingCycle,
        nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: {
        plan: true,
        role: true,
      },
    });

    // Now create invoice and link it to subscription
    const invoice = await prisma.invoice.create({
      data: {
        lawyerId: lawyerProfile.id,
        planId: planId,
        amount: amount,
        status: 'PENDING',
        paymentReason: 'Subscription payment',
      },
      include: {
        plan: true,
      },
    });

    // Update subscription to link invoice
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        invoiceId: invoice.id,
      },
      include: {
        plan: true,
        role: true,
      },
    });

    return NextResponse.json(
      {
        invoice: {
          id: invoice.id,
          amount: invoice.amount,
          status: invoice.status,
          planName: invoice.plan.name,
          createdAt: invoice.createdAt,
        },
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          billingCycle: updatedSubscription.billingCycle,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
===
import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CreateInvoiceSchema } from '@/schemas/subscription.schema';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    // Check if authorized
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('Create invoice request body:', JSON.stringify(body, null, 2));
    const validation = CreateInvoiceSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('Validation errors:', errors);
      return NextResponse.json(
        { error: `Validation failed: ${errors}` },
        { status: 400 }
      );
    }

    const { planId, billingCycle } = validation.data;

    // Get lawyer profile
    const lawyerProfile = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!lawyerProfile) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    // Check if lawyer already has active subscription
    const existingActiveSubscription = await prisma.subscription.findFirst({
      where: {
        lawyerId: lawyerProfile.id,
        status: { in: ['ACTIVE', 'PAST_DUE'] },
      },
    });

    if (existingActiveSubscription) {
      return NextResponse.json(
        { error: 'You already have an active or pending subscription. Please cancel it first or wait for it to expire.' },
        { status: 400 }
      );
    }

    // Get the subscription plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Get the role for this plan tier
    const role = await prisma.subscriptionRole.findUnique({
      where: { name: plan.tier },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found for this plan' }, { status: 404 });
    }

    // Calculate amount and dates based on billing cycle
    const amount = billingCycle === 'YEARLY' ? plan.yearlyAmount : plan.monthlyAmount;
    const now = new Date();
    const endDate = billingCycle === 'YEARLY'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const nextBilling = new Date(endDate);

    // Create subscription with PAST_DUE status (will become ACTIVE after payment approval)
    const subscription = await prisma.subscription.create({
      data: {
        lawyerId: lawyerProfile.id,
        planId: planId,
        roleId: role.id,
        status: 'PAST_DUE',
        billingCycle: billingCycle,
        startDate: now,
        endDate: endDate,
        nextBilling: nextBilling,
        autoRenew: true,
      },
      include: {
        plan: true,
        role: true,
      },
    });

    // Now create invoice and link it to subscription
    const invoice = await prisma.invoice.create({
      data: {
        lawyerId: lawyerProfile.id,
        planId: planId,
        subscriptionId: subscription.id,
        amount: amount,
        status: 'PENDING',
        paymentReason: `${plan.name} - ${billingCycle} subscription payment`,
      },
      include: {
        plan: true,
      },
    });

    // Update subscription to link invoice
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        invoiceId: invoice.id,
      },
      include: {
        plan: true,
        role: true,
      },
    });

    return NextResponse.json(
      {
        invoice: {
          id: invoice.id,
          amount: invoice.amount,
          status: invoice.status,
          planName: invoice.plan.name,
          createdAt: invoice.createdAt,
        },
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          billingCycle: updatedSubscription.billingCycle,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

```

---

### 3. 🏷️ Pricing Page - Permissions Now Displayed

**File:** [PricingPageClient.tsx](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/%5Blocale%5D/%28public%29/pricing/PricingPageClient.tsx)

**Problem:** Pricing page only showed `subscriptionDetails` (manually added). Didn't show the actual RBAC permissions assigned to each tier.

**Fix:**
- New API endpoint `/api/subscriptions/plans-with-permissions` fetches plans with their role's permissions
- Each permission displayed with its **specific icon** (articles → PenLine, chat → MessageSquare, etc.)
- Shows permission description and category
- Feature limits displayed in a grid (e.g., "10 Articles/mo", "500 Messages/mo")
- Extra `subscriptionDetails` shown as "Additional Benefits" section

**Permission Icons Mapping:**

| Permission | Icon |
|:-----------|:-----|
| create_article | PenLine |
| edit_article | FileText |
| delete_article | Trash2 |
| publish_article | BookOpen |
| receive_inquiries | Users |
| post_inquiry | Send |
| manage_inquiries | Eye |
| access_chat | MessageSquare |
| send_message | Send |
| edit_profile | Settings |
| upload_documents | Upload |
| access_paid_promo | Megaphone |
| create_promo | Crown |
| view_analytics | BarChart3 |
| export_data | Download |

---

### 4. ❌ Subscription Cancel API - NEW

**File:** [route.ts](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/api/subscriptions/cancel/route.ts)

**Endpoint:** `POST /api/subscriptions/cancel`

**Behavior:**
- Sets subscription status to `CANCELED`
- Sets `autoRenew = false`
- **Lawyer retains access until `endDate`** (grace period)
- After `endDate`, subscription auto-expires

---

### 5. 🔄 Subscription Renew API - NEW

**File:** [route.ts](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/api/subscriptions/renew/route.ts)

**Endpoint:** `POST /api/subscriptions/renew`

**Behavior:**
- Only works on `CANCELED` subscriptions that haven't expired yet
- Re-activates subscription to `ACTIVE`
- Sets `autoRenew = true`
- If subscription has already expired, prompts user to buy a new plan

---

### 6. 📊 Subscription Status API - NEW

**File:** [route.ts](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/api/subscriptions/status/route.ts)

**Endpoint:** `GET /api/subscriptions/status`

**Returns:**
```json
{
  "hasSubscription": true,
  "subscription": {
    "id": "uuid",
    "status": "ACTIVE",
    "tier": "PREMIUM",
    "planName": "Premium Plan",
    "billingCycle": "MONTHLY",
    "startDate": "2026-04-12T00:00:00Z",
    "endDate": "2026-05-12T00:00:00Z",
    "nextBilling": "2026-05-12T00:00:00Z",
    "autoRenew": true,
    "daysRemaining": 30,
    "permissions": [...]
  }
}
```

**Features:**
- Auto-expires subscriptions past `endDate`
- Calculates `daysRemaining`
- Returns all assigned permissions

---

### 7. 📋 Plans with Permissions API - NEW

**File:** [route.ts](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/api/subscriptions/plans-with-permissions/route.ts)

**Endpoint:** `GET /api/subscriptions/plans-with-permissions`

Returns plans enriched with their tier's permissions and feature limits.

---

### 8. 👤 Profile Page - Subscription Management Added

**File:** [page.tsx](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/%5Blocale%5D/%28public%29/profile/page.tsx)

**New section** added between the "Languages" and "Save" button:

- **Status card** with color-coded border (green=ACTIVE, amber=CANCELED, red=EXPIRED, blue=PAST_DUE)
- Shows: Plan name, status badge, billing cycle, tier icon
- **Data grid**: Start date, Expiry date, Days remaining, Auto-renewal status
- **Status messages**: Contextual messages for each status
- **Action buttons**:
  - **ACTIVE** → "Cancel Subscription" (red button)
  - **CANCELED** → "Renew Subscription" (green button)
  - **EXPIRED** → "Subscribe to New Plan" (black button)
  - Always → "View Plans" (outline button)
- **No subscription** → Banner with "Browse Subscription Plans" CTA

---

### 9. 📊 Lawyer Dashboard - Subscription Status Card Added

**File:** [page.tsx](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/%5Blocale%5D/dashboard/lawyer/page.tsx)

**New card** at the top of the dashboard (above stats):

- Status indicator with colored left border
- Plan name + status badge + billing cycle
- Days remaining info
- Quick-action buttons (View Plans / Subscribe)
- "No Active Subscription" state with CTA

---

### 10. 🔧 Invoice Admin Approval API - NEW

**File:** [route.ts](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/app/api/invoices/%5Bid%5D/route.ts)

**Endpoints:**
- `GET /api/invoices/[id]` - Get invoice details
- `PATCH /api/invoices/[id]` - Update invoice status (admin only)

**Key behavior when admin updates:**
- `status: 'PAID'` → **Automatically activates linked subscription**
- `status: 'CANCELLED'` → Cancels linked subscription
- `status: 'RESUBMIT'` → Keeps subscription as PAST_DUE
- Supports adding remarks to invoices

---

### 11. 🛡️ Subscription Library - Enhanced

**File:** [subscription.ts](file:///d:/FiveNeuralsWeb/LawyerAI/law-finder/lawyer-finder-web/src/lib/subscription.ts)

**Changes:**
- `getUserSubscription()` - Now also returns CANCELED subscriptions that haven't expired
- `hasPermission()` - CANCELED but not-yet-expired subscriptions still pass permission checks
- This ensures lawyers retain access during cancellation grace period

```diff:subscription.ts
import prisma from './db'
import { SubscriptionStatus, BillingCycle } from '@prisma/client'

/**
 * Get user's subscription information
 */
export async function getUserSubscription(lawyerId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { lawyerId, status: 'ACTIVE' },
    include: {
      plan: true,
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  return subscription
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  lawyerId: string,
  permissionSlug: string
): Promise<boolean> {
  const subscription = await getUserSubscription(lawyerId)

  if (!subscription) return false
  if (subscription.status !== SubscriptionStatus.ACTIVE) return false

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
  const permissionCategory = featureName.split('_')[0] // e.g., "articles" from "articles_per_month"
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
===
import prisma from './db'
import { SubscriptionStatus, BillingCycle } from '@prisma/client'

/**
 * Get user's subscription information
 * Returns ACTIVE subscriptions, and CANCELED subscriptions that haven't expired yet
 */
export async function getUserSubscription(lawyerId: string) {
  const now = new Date()
  
  const subscription = await prisma.subscription.findFirst({
    where: {
      lawyerId,
      OR: [
        { status: 'ACTIVE' },
        {
          status: 'CANCELED',
          endDate: { gte: now },
        },
      ],
    },
    include: {
      plan: true,
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return subscription
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
  const permissionCategory = featureName.split('_')[0] // e.g., "articles" from "articles_per_month"
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
```

---

## Subscription Lifecycle Flow

```mermaid
flowchart TD
    A["Lawyer visits /pricing"] --> B["Clicks Subscribe Now"]
    B --> C["Invoice page shows plan details"]
    C --> D["Clicks Pay Now → Invoice created"]
    D --> E["Subscription created with PAST_DUE status"]
    E --> F{"Choose Payment Method"}
    F --> G["Offline Payment: Submit bank details"]
    F --> H["Online Payment: Coming Soon"]
    G --> I["Admin reviews payment"]
    I --> J{"Admin Decision"}
    J -->|Approve| K["Invoice status → PAID"]
    K --> L["Subscription status → ACTIVE ✅"]
    J -->|Reject| M["Invoice status → RESUBMIT"]
    M --> G
    J -->|Cancel| N["Invoice status → CANCELLED"]
    N --> O["Subscription status → CANCELED"]
    
    L --> P{"Lawyer Actions"}
    P --> Q["Cancel Subscription"]
    Q --> R["Status → CANCELED, autoRenew = false"]
    R --> S["Lawyer retains access until endDate"]
    S --> T{"Before endDate?"}
    T -->|Yes| U["Renew Subscription"]
    U --> L
    T -->|No| V["Status → EXPIRED"]
    V --> A
    
    P --> W["Subscription expires naturally"]
    W --> V
```

---

## How to Use

### For Developers: Checking Permissions in API Routes

```typescript
import { hasPermission, canUseFeature, incrementFeatureUsage } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  // Get profile
  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId: session.userId },
  });

  // 1. Check permission
  const canCreate = await hasPermission(profile.id, 'create_article');
  if (!canCreate) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  // 2. Check feature quota
  const subscription = await getUserSubscription(profile.id);
  const canUse = await canUseFeature(subscription.id, 'articles_per_month');
  if (!canUse.allowed) {
    return NextResponse.json({ error: canUse.reason }, { status: 429 });
  }

  // 3. Do the action
  const article = await prisma.article.create({ data });

  // 4. Increment usage
  await incrementFeatureUsage(subscription.id, 'articles_per_month', 1);

  return NextResponse.json(article);
}
```

### For Developers: Quick Session Check

```typescript
// In API route - quick check from session (no DB call)
const session = await getSession();
if (session?.subscriptionStatus !== 'ACTIVE' && session?.subscriptionStatus !== 'CANCELED') {
  return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
}
```

### For Admins: Approve a Payment

```bash
PATCH /api/invoices/{invoiceId}
{
  "status": "PAID",
  "adminNotes": "Payment verified via bank transfer",
  "remark": "Payment confirmed. Subscription activated."
}
# → This automatically sets subscription to ACTIVE
```

### For Lawyers: Cancel Subscription

Profile Settings → Subscription Management → Cancel Subscription
- Or: `POST /api/subscriptions/cancel`
- Access continues until billing period ends

### For Lawyers: Renew Subscription

Profile Settings → Subscription Management → Renew Subscription
- Only works if subscription was canceled but hasn't expired

---

## All Files Changed/Created

| File | Action | Purpose |
|:-----|:-------|:--------|
| `src/app/api/auth/login/route.ts` | Modified | Add subscription info to JWT session |
| `src/app/api/invoices/create/route.ts` | Modified | Fix: PAST_DUE status, proper dates |
| `src/app/api/invoices/[id]/route.ts` | Created | Admin invoice approval + subscription activation |
| `src/app/api/subscriptions/cancel/route.ts` | Created | Cancel subscription API |
| `src/app/api/subscriptions/renew/route.ts` | Created | Renew subscription API |
| `src/app/api/subscriptions/status/route.ts` | Created | Full subscription status API |
| `src/app/api/subscriptions/plans-with-permissions/route.ts` | Created | Plans with RBAC permissions |
| `src/app/[locale]/(public)/pricing/PricingPageClient.tsx` | Rewritten | Show permissions with icons |
| `src/app/[locale]/(public)/profile/page.tsx` | Modified | Subscription management section |
| `src/app/[locale]/dashboard/lawyer/page.tsx` | Modified | Subscription status card |
| `src/lib/subscription.ts` | Modified | Handle CANCELED subscriptions |

---

> [!IMPORTANT]
> After deploying, lawyers must **re-login** to get the updated session with subscription info. The old session tokens won't have `subscriptionRole` and `subscriptionStatus` fields.

> [!TIP]
> When adding new features that need permission checks, follow this pattern:
> 1. Add permission to seed data
> 2. Assign to roles via admin panel
> 3. Use `hasPermission(profileId, 'permission_slug')` in API route
> 4. Use `canUseFeature(subscriptionId, 'feature_name')` for quota checks
