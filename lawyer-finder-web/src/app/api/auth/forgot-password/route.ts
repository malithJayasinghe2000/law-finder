import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { forgotPasswordSchema } from '@/schemas/auth.schema';
import { checkRateLimit, getClientIp } from '@/lib/security';
import { sendPasswordResetLink } from '@/lib/passwordReset';

/**
 * POST: email a "choose a new password" link, if the address has an account
 * that signs in with a password.
 *
 * The answer is the same whether or not the address exists, so this cannot be
 * used to find out who has an account here.
 */
const SAME_ANSWER = {
  message: 'If an account uses that address, we have emailed it a link to choose a new password.',
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (process.env.RATE_LIMIT_ENABLED !== 'false') {
    const check = checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
    if (!check.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${Math.ceil(check.retryAfterMs / 1000)} seconds.` },
        { status: 429 }
      );
    }
  }

  const parsed = forgotPasswordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Enter your email address.' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, status: true, authProvider: true },
    });

    // Google accounts have no password here, and a closed account stays closed.
    if (user && user.status === 'ACTIVE' && user.authProvider === 'LOCAL') {
      // One link per address per 15 minutes, so the form cannot flood an inbox.
      const perAddress = process.env.RATE_LIMIT_ENABLED === 'false'
        ? { allowed: true }
        : checkRateLimit(`forgot-password-email:${user.id}`, 1, 15 * 60 * 1000);
      if (perAddress.allowed) {
        const locale = req.headers.get('referer')?.match(/\/(en|si|ta)\//)?.[1];
        await sendPasswordResetLink(user, { locale });
      }
    }
  } catch (error) {
    console.error('[FORGOT_PASSWORD]', error);
  }

  return NextResponse.json(SAME_ANSWER, { status: 200 });
}
