import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSubscriptionForProfile } from '@/lib/firms/billing';
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
          gender: true,
          yearsOfExperience: true,
          practiceType: true,
          courts: true,
          isNotary: true,
          isVerified: true,
        },
      });

      // The licence belongs to the attorney's firm (Phase 3).
      const activeSubscription = await getSubscriptionForProfile(lawyerProfile?.id);

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

import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';
import { DISTRICTS, PRACTICE_AREAS, LANGUAGES } from '@/schemas/profile.schema';

const updateBasicProfileSchema = z.object({
  fullName: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(3, 'Full name must be at least 3 characters.').max(120, 'Full name cannot exceed 120 characters.').optional()
  ),
  profileImageUrl: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional().nullable()
  ),
});

const passwordUpdateSchema = z.string()
  .min(8, "Password must be at least 8 characters long.")
  .max(100, "Password cannot be longer than 100 characters.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[0-9]/, "Password must contain at least one number.")
  .regex(/[@$!%*?&]/, "Password must contain at least one special character (@$!%*?&).");

const updateLawyerProfileSchema = z.object({
  fullName: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(3).max(120).optional()
  ),
  bio: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(2000).optional().nullable()
  ),
  practiceAreas: z.preprocess(
    (val) => Array.isArray(val) ? val.filter(v => PRACTICE_AREAS.includes(v as any)) : val,
    z.array(z.enum(PRACTICE_AREAS as unknown as [string, ...string[]])).optional()
  ),
  languages: z.preprocess(
    (val) => Array.isArray(val) ? val.filter(v => LANGUAGES.includes(v as any)) : val,
    z.array(z.enum(LANGUAGES as unknown as [string, ...string[]])).optional()
  ),
  district: z.enum(DISTRICTS as unknown as [string, ...string[]]).optional().or(z.literal('')),
  contactPhone: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().regex(/^(?:0|(?:\+94))7[0-9]{8}$/, 'Enter a valid Sri Lankan mobile number.').optional().or(z.literal(''))
  ),
  address: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(10).max(300).optional().or(z.literal(''))
  ),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'Male', 'Female', 'Other', '']).optional(),
  yearsOfExperience: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.coerce.number().int().min(0).max(70).optional()
  ),
  practiceType: z.enum(['Independent', 'Law Firm', '']).optional(),
  courts: z.array(z.string()).optional(),
  isNotary: z.boolean().optional(),
  onlineMeetingLink: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional().nullable()
  ),
  profileImageUrl: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional().nullable()
  ),
  nic: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(20).optional()
  ),
  latitude: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional().nullable()
  ),
  longitude: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional().nullable()
  ),
});

// PUT: Update the logged-in user's profile
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const basicParsed = updateBasicProfileSchema.safeParse(body);
    if (!basicParsed.success) {
      return NextResponse.json({ error: basicParsed.error.issues[0]?.message || 'Invalid basic profile data.' }, { status: 400 });
    }

    const { fullName, profileImageUrl, currentPassword, newPassword, lawyerProfile } = body;

    // Update user basic info
    const updateData: Record<string, unknown> = {};
    if (basicParsed.data.fullName !== undefined) updateData.fullName = basicParsed.data.fullName;
    if (basicParsed.data.profileImageUrl !== undefined) updateData.profileImageUrl = basicParsed.data.profileImageUrl;

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to change password.' }, { status: 400 });
      }

      const passParsed = passwordUpdateSchema.safeParse(newPassword);
      if (!passParsed.success) {
        return NextResponse.json({ error: passParsed.error.issues[0]?.message || 'Invalid password complexity.' }, { status: 400 });
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

      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
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
        const lawyerParsed = updateLawyerProfileSchema.safeParse(lawyerProfile);
        if (!lawyerParsed.success) {
          return NextResponse.json({ error: lawyerParsed.error.issues[0]?.message || 'Invalid lawyer profile data.' }, { status: 400 });
        }

        const lawyerUpdateData: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(lawyerParsed.data)) {
          if (value === undefined) continue;

          if (key === 'onlineMeetingLink') {
            const link = value as string | null;
            if (link && !isGoogleMeetLink(link)) {
              return NextResponse.json({ error: 'Please enter a valid Google Meet URL.' }, { status: 400 });
            }
            lawyerUpdateData.onlineMeetingLink = link || null;
            continue;
          }

          // Parse coordinates to float
          if (key === 'latitude' || key === 'longitude') {
            const val = value;
            lawyerUpdateData[key] = (val === '' || val === null)
              ? null
              : parseFloat(val as string);
            continue;
          }

          lawyerUpdateData[key] = value;
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
    console.error('[PROFILE_UPDATE_ERROR]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
