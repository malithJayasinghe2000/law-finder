import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashVerificationToken, verificationLocale } from '@/lib/emailVerification';
import { safeRedirect } from '@/lib/safeRedirect';

/**
 * The link in the verification email. Always lands on the sign-in page, in the
 * person's language, carrying where they were going, with a message the page
 * shows: verified, or why not (it used to show nothing for a bad link).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = verificationLocale(url.searchParams.get('l'));
  const redirect = safeRedirect(url.searchParams.get('redirect'));

  const land = (outcome: Record<string, string>) => {
    const params = new URLSearchParams(outcome);
    if (redirect) params.set('redirect', redirect);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/login?${params}`);
  };

  try {
    const token = url.searchParams.get('token');
    if (!token) return land({ error: 'InvalidToken' });

    // Only the hash is stored (src/lib/emailVerification.ts).
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token: hashVerificationToken(token) },
    });

    // Unknown covers "already used": the row is deleted on success.
    if (!verificationToken) return land({ error: 'InvalidToken' });

    if (verificationToken.expiresAt < new Date()) {
      await prisma.verificationToken.delete({ where: { id: verificationToken.id } });
      return land({ error: 'TokenExpired' });
    }

    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { isEmailVerified: true },
    });
    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

    return land({ verified: 'true' });
  } catch (error) {
    console.error('Verify email error:', error instanceof Error ? error.message : error);
    return land({ error: 'ServerError' });
  }
}
