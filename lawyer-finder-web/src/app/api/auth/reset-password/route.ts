import { NextResponse } from 'next/server';
import { resetPasswordSchema } from '@/schemas/auth.schema';
import { checkRateLimit, getClientIp } from '@/lib/security';
import { resetPasswordWithToken } from '@/lib/passwordReset';

/** POST: choose a new password with a link from /api/auth/forgot-password. */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (process.env.RATE_LIMIT_ENABLED !== 'false') {
    const check = checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000);
    if (!check.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${Math.ceil(check.retryAfterMs / 1000)} seconds.` },
        { status: 429 }
      );
    }
  }

  const parsed = resetPasswordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the form.' }, { status: 400 });
  }

  try {
    const outcome = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    if (outcome === 'RESET') {
      return NextResponse.json({ message: 'Your password has been changed. You can sign in now.' }, { status: 200 });
    }
    return NextResponse.json(
      {
        error: outcome === 'EXPIRED'
          ? 'This link has expired. Ask for a new one.'
          : 'This link is not valid or has already been used. Ask for a new one.',
      },
      { status: 410 }
    );
  } catch (error) {
    console.error('[RESET_PASSWORD]', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
