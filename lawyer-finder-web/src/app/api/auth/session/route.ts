import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { getSubscriptionForProfile } from '@/lib/firms/billing';

// GET: Check current session status with live data from DB
// This avoids requiring re-login when admin approves subscription or role changes
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { 
        fullName: true, 
        profileImageUrl: true, 
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    // Build response with live data
    const responseData: any = {
      authenticated: true,
      role: user.role, // Use live role from DB, not from JWT
      userId: session.userId,
      fullName: user.fullName,
      profileImageUrl: user.profileImageUrl,
      email: user.email,
    };

    // If lawyer, fetch live subscription data from DB
    if (user.role === 'LAWYER') {
      const profile = await prisma.lawyerProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });

      if (profile) {
        responseData.profileId = profile.id;

        // The licence belongs to the attorney's firm, not to the attorney.
        const subscription = await getSubscriptionForProfile(profile.id);

        if (subscription) {
          responseData.subscriptionRole = subscription.role.name;
          responseData.subscriptionStatus = subscription.status;
          responseData.subscriptionPlan = subscription.plan.name;
          responseData.subscriptionTier = subscription.plan.tier;
        }
      }
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}

