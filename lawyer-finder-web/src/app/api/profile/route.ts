import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { isGoogleMeetLink } from '@/lib/meetings/googleMeet';

// GET: Fetch the logged-in user's profile data
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      console.log('[API PROFILE GET] session is null!');
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        profileImageUrl: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // If lawyer, also fetch lawyer profile data
    let lawyerProfile = null;
    let subscription = null;
    if (user.role === 'LAWYER') {
      lawyerProfile = await prisma.lawyerProfile.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          fullName: true,
          baslNumber: true,
          nic: true,
          address: true,
          contactPhone: true,
          onlineMeetingLink: true,
          profileImageUrl: true,
          bio: true,
          practiceAreas: true,
          languages: true,
          district: true,
          latitude: true,
          longitude: true,
          baseFeeRange: true,
          gender: true,
          yearsOfExperience: true,
          practiceType: true,
          courts: true,
          isNotary: true,
          isVerified: true,
        },
      });

      // Fetch active subscription
      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          lawyer: { userId: user.id },
          status: 'ACTIVE',
        },
        include: {
          plan: true,
          role: true,
        },
      });

      if (activeSubscription) {
        subscription = {
          id: activeSubscription.id,
          tier: activeSubscription.plan.tier,
          planName: activeSubscription.plan.name,
          status: activeSubscription.status,
          billingCycle: activeSubscription.billingCycle,
          startDate: activeSubscription.startDate,
          nextBilling: activeSubscription.nextBilling,
        };
      }
    }

    return NextResponse.json({ user, lawyerProfile, subscription }, { status: 200 });
  } catch (error) {
    console.error('[PROFILE_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// PUT: Update the logged-in user's profile
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, profileImageUrl, currentPassword, newPassword, lawyerProfile } = body;

    // Update user basic info
    const updateData: Record<string, unknown> = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl;

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to change password.' }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { passwordHash: true },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      if (!user.passwordHash) {
        return NextResponse.json({ error: 'Password not set for this account.' }, { status: 400 });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // Update user record
    if (Object.keys(updateData).length > 0) {
      console.log(`[PROFILE_PUT] Updating User ${session.userId}:`, updateData);
      await prisma.user.update({
        where: { id: session.userId },
        data: updateData,
      });
    }

    // If lawyer, update LawyerProfile too
    if (session.role === 'LAWYER' && lawyerProfile) {
      const existingProfile = await prisma.lawyerProfile.findUnique({
        where: { userId: session.userId },
      });

      if (existingProfile) {
        const lawyerUpdateData: Record<string, unknown> = {};
        const allowedFields = [
          'fullName', 'bio', 'practiceAreas', 'languages', 'district',
          'baseFeeRange', 'contactPhone', 'address', 'gender',
          'yearsOfExperience', 'practiceType', 'courts', 'isNotary',
          'onlineMeetingLink', 'profileImageUrl', 'nic', 'latitude', 'longitude',
        ];

        for (const field of allowedFields) {
          if (field === 'onlineMeetingLink' && lawyerProfile[field] !== undefined) {
            const link = lawyerProfile[field] as string | null;
            if (link && !isGoogleMeetLink(link)) {
              return NextResponse.json({ error: 'Please enter a valid Google Meet URL.' }, { status: 400 });
            }
            lawyerUpdateData.onlineMeetingLink = link || null;
            continue;
          }

          // Parse coordinates to float (they arrive as strings from the form)
          if ((field === 'latitude' || field === 'longitude') && lawyerProfile[field] !== undefined) {
            const val = lawyerProfile[field];
            lawyerUpdateData[field] = (val === '' || val === null || val === undefined)
              ? null
              : parseFloat(val as string);
            continue;
          }

          if (lawyerProfile[field] !== undefined) {
            lawyerUpdateData[field] = lawyerProfile[field];
          }
        }

        if (Object.keys(lawyerUpdateData).length > 0) {
          console.log(`[PROFILE_PUT] Updating LawyerProfile for User ${session.userId}:`, lawyerUpdateData);
          await prisma.lawyerProfile.update({
            where: { id: existingProfile.id },
            data: lawyerUpdateData,
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Profile updated successfully.' }, { status: 200 });
  } catch (error) {
    console.error('[PROFILE_UPDATE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
