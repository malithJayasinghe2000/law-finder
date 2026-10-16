import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { ADMIN_ROLE_EDIT_ENABLED, ADMIN_SET_PASSWORD_ENABLED } from '@/lib/admin/userTools';
import { sendPasswordResetLink } from '@/lib/passwordReset';
import { AdminUpdateUserSchema, AdminRevokeVerificationSchema } from '@/schemas/adminUser.schema';
import { EmailService } from '@/lib/email/EmailService';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            isVerified: true,
            district: true,
            latitude: true,
            longitude: true,
            baslNumber: true,
          },
        },
        
        application: {
          select: {
            status: true,
          },
        },
      },
    });

    let filtered = users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      // An attorney by their registered name; anyone else by their account name.
      fullName: u.profile?.fullName || u.fullName || null,
      accountStatus: u.status,
      isVerified: u.profile?.isVerified || false,
      district: u.profile?.district || null,
      latitude: u.profile?.latitude || null,
      longitude: u.profile?.longitude || null,
      baslNumber: u.profile?.baslNumber || null,
      profileId: u.profile?.id || null,
      applicationStatus: u.application?.status || null,
    }));

    // Filter by search
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(s) ||
        (u.fullName && u.fullName.toLowerCase().includes(s))
      );
    }

    // Filter by role
    if (role && role !== 'ALL') {
      filtered = filtered.filter(u => u.role === role);
    }

    // Filter by verification status (for lawyers)
    if (status === 'VERIFIED') {
      filtered = filtered.filter(u => u.isVerified === true);
    } else if (status === 'UNVERIFIED') {
      filtered = filtered.filter(u => u.role === 'LAWYER' && u.isVerified === false);
    }

    return NextResponse.json({ users: filtered }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, action, password } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (action === 'update-details') {
      const parsed = AdminUpdateUserSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid details.' }, { status: 400 });
      }
      const d = parsed.data;

      const user = await prisma.user.findUnique({ where: { id: d.userId }, select: { role: true, email: true } });
      if (!user) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      // A role follows from what a person did — see src/lib/admin/userTools.ts.
      if (d.role && d.role !== user.role && !ADMIN_ROLE_EDIT_ENABLED) {
        return NextResponse.json({ error: 'Roles cannot be changed here.' }, { status: 403 });
      }

      const emailChanged = !!d.email && d.email !== user.email;
      if (emailChanged) {
        const taken = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
        if (taken) {
          return NextResponse.json({ error: 'Another account already uses that email address.' }, { status: 409 });
        }
      }

      const updateData: { email?: string; role?: typeof d.role } = {};
      if (emailChanged) updateData.email = d.email;
      if (d.role && ADMIN_ROLE_EDIT_ENABLED) updateData.role = d.role;

      await prisma.user.update({
        where: { id: d.userId },
        data: updateData,
      });

      // Also update lawyer profile if applicable
      if (d.latitude !== undefined || d.longitude !== undefined) {
        const profile = await prisma.lawyerProfile.findFirst({ where: { userId: d.userId } });
        if (profile) {
          await prisma.lawyerProfile.update({
            where: { id: profile.id },
            data: {
              ...(d.latitude !== undefined ? { latitude: d.latitude } : {}),
              ...(d.longitude !== undefined ? { longitude: d.longitude } : {}),
            },
          });
        }
      }

      // The owner of the old address is told. Not awaited: the mail server is
      // slow; sendMailSafe logs a failure and never throws.
      if (emailChanged) {
        void EmailService.sendEmailChangedByAdmin({ oldEmail: user.email, newEmail: d.email! });
      }

      return NextResponse.json({
        message: emailChanged ? 'Details updated. The old address has been told about the change.' : 'User details updated.',
      }, { status: 200 });
    }

    // The person chooses their own password from a link sent to their inbox.
    if (action === 'send-password-reset') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, status: true, authProvider: true },
      });
      if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      if (user.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'This account is closed.' }, { status: 409 });
      }
      if (user.authProvider !== 'LOCAL') {
        return NextResponse.json({ error: 'This account signs in with Google and has no password here.' }, { status: 409 });
      }
      await sendPasswordResetLink(user, { requestedById: session.userId });
      return NextResponse.json({ message: `A reset link has been emailed to ${user.email}. It works once, for one hour.` }, { status: 200 });
    }

    // Off: an admin who chooses someone's password can sign in as them
    // (src/lib/admin/userTools.ts). Replaced by send-password-reset above.
    if (action === 'update-password' && !ADMIN_SET_PASSWORD_ENABLED) {
      return NextResponse.json({ error: 'Passwords are not set by staff. Send the person a reset link instead.' }, { status: 410 });
    }

    if (action === 'update-password') {
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }

      const hash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hash },
      });

      return NextResponse.json({ message: 'Password updated.' }, { status: 200 });
    }

    // Granting verification here is gone: it marked an attorney "Verified" with
    // no application, no BASL check and no record. Verification is granted only
    // on the Verification page, from an application.
    if (action === 'toggle-verification') {
      return NextResponse.json(
        { error: 'Verification is granted from an application on the Verification page. Here it can only be withdrawn.' },
        { status: 410 }
      );
    }

    if (action === 'revoke-verification') {
      const parsed = AdminRevokeVerificationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'A reason is required.' }, { status: 400 });
      }
      const { reason } = parsed.data;

      const profile = await prisma.lawyerProfile.findFirst({
        where: { userId },
        select: { id: true, isVerified: true, fullName: true, user: { select: { email: true } } },
      });
      if (!profile) {
        return NextResponse.json({ error: 'No lawyer profile found.' }, { status: 404 });
      }
      if (!profile.isVerified) {
        return NextResponse.json({ error: 'This attorney is not verified.' }, { status: 409 });
      }

      await prisma.lawyerProfile.update({
        where: { id: profile.id },
        data: {
          isVerified: false,
          verificationRevokedById: session.userId,
          verificationRevokedAt: new Date(),
          verificationRevokedReason: reason,
        },
      });

      // They are entitled to know why. Not awaited: the mail server is slow.
      void EmailService.sendVerificationRevoked({ to: profile.user.email, fullName: profile.fullName, reason });

      return NextResponse.json({ message: 'Verification withdrawn. The attorney has been emailed the reason.' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
