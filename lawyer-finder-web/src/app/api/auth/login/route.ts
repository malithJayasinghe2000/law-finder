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

    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
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
