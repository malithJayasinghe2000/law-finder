import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { getSubscriptionForProfile } from '@/lib/firms/billing';
import { createSession, SessionPayload } from '@/lib/auth';
import { loginSchema } from '@/schemas/auth.schema';
import { checkRateLimit, getClientIp } from '@/lib/security';

export async function POST(req: Request) {
  try {
    // Hoisted so the failed-attempt log below can reference it. Previously
    // clientIp was block-scoped to the rate-limit check, so the failure log threw
    // a ReferenceError and every bad password returned 500 instead of 401.
    const clientIp = getClientIp(req);

    // Rate limiting, per network: generous, because mobile networks put many
    // phones behind one address - at 5 per IP one person's typos locked out
    // everyone on it. The tight limit is per account, below.
    // Can be disabled via env var (e.g., RATE_LIMIT_ENABLED=false)
    const limitsOn = process.env.RATE_LIMIT_ENABLED !== 'false';
    if (limitsOn) {
      const rateCheck = checkRateLimit(`login:${clientIp}`, 50, 15 * 60 * 1000);
      if (!rateCheck.allowed) {
        const retryAfterSec = Math.ceil(rateCheck.retryAfterMs / 1000);
        return NextResponse.json(
          { error: `Too many login attempts. Please try again in ${retryAfterSec} seconds.` },
          { status: 429 }
        );
      }
    }

    const body = await req.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid credentials format.' }, { status: 400 });
    }

    const { email, password } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 5 tries per account per 15 minutes: guessing one person's password is
    // what this limit is for.
    if (limitsOn) {
      const perAccount = checkRateLimit(`login-account:${normalizedEmail}`, 5, 15 * 60 * 1000);
      if (!perAccount.allowed) {
        return NextResponse.json(
          { error: `Too many attempts for this account. Please try again in ${Math.ceil(perAccount.retryAfterMs / 60000)} minutes, or reset your password.` },
          { status: 429 }
        );
      }
    }
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Constant-time pattern: always compare against a dummy hash when user not found
    // This prevents timing-based user enumeration
    const hashToCompare = user?.passwordHash || '$2a$10$dummyhashtopreventtimingattackpadding';
    const passwordValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.passwordHash || !passwordValid) {
      console.warn(`[AUTH] Failed login attempt for email: ${normalizedEmail.substring(0, 3)}*** from IP: ${clientIp}`);
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // A deactivated or erased account cannot sign in (it could, until 2026-10-16).
    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This account is closed. If you think this is a mistake, write to hello@thelawyr.lk.' },
        { status: 403 }
      );
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

        // The licence belongs to the attorney's firm, not to the attorney.
        const subscription = await getSubscriptionForProfile(profile.id);

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
