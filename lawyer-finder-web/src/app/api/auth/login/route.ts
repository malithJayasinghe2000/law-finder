import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { createSession, SessionPayload } from '@/lib/auth';
import { loginSchema } from '@/schemas/auth.schema';
import { checkRateLimit, getClientIp } from '@/lib/security';

export async function POST(req: Request) {
  try {
    // Rate limiting: max 5 login attempts per 15 minutes per IP
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`login:${clientIp}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil(rateCheck.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${retryAfterSec} seconds.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid credentials format.' }, { status: 400 });
    }

    const { email, password } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Constant-time pattern: always compare against a dummy hash when user not found
    // This prevents timing-based user enumeration
    const hashToCompare = user?.passwordHash || '$2a$10$dummyhashtopreventtimingattackpadding';
    const passwordValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.passwordHash || !passwordValid) {
      console.warn(`[AUTH] Failed login attempt for email: ${normalizedEmail.substring(0, 3)}*** from IP: ${clientIp}`);
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    if (user.authProvider === 'LOCAL' && !user.isEmailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email address before logging in.', unverifiedEmail: user.email },
        { status: 403 }
      );
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
