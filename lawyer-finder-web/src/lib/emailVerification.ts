import { createHash, randomBytes } from 'crypto';
import prisma from '@/lib/db';
import { EmailService } from '@/lib/email/EmailService';
import { safeRedirect } from '@/lib/safeRedirect';
import { routing } from '@/i18n/routing';

/**
 * Email-verification links: one place for sign-up and "resend".
 *
 * - The database keeps only a SHA-256 of the token, as for password-reset links
 *   (src/lib/passwordReset.ts). A copy of the table must not be a set of working
 *   verification links. Before 2026-10-16 the token was stored as sent.
 * - The email goes out after the response. The mail server here takes 5-18 s per
 *   message; sign-up used to make the person wait for it (16.8 s measured).
 *   sendMailSafe never throws, so a failed send leaves the account in place and
 *   the person can ask for another link from the sign-in page.
 * - The link carries where the person was going (`redirect`, a path on this
 *   site only) and their language, so after verifying and signing in they land
 *   back where they started — e.g. a firm's request form — not on the home page.
 */

const LINK_TTL_MS = 24 * 60 * 60 * 1000;

export const hashVerificationToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export function verificationLocale(value: unknown): string {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value)
    ? value
    : routing.defaultLocale;
}

export async function issueVerificationLink(
  user: { id: string; email: string; fullName: string | null },
  options: { redirect?: unknown; locale?: unknown } = {}
): Promise<void> {
  const token = randomBytes(32).toString('hex');

  await prisma.verificationToken.create({
    data: {
      token: hashVerificationToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  });

  const params = new URLSearchParams({ token, l: verificationLocale(options.locale) });
  const redirect = safeRedirect(typeof options.redirect === 'string' ? options.redirect : null);
  if (redirect) params.set('redirect', redirect);

  // Not awaited: see the header comment.
  void EmailService.sendEmailVerification(user.email, params.toString(), user.fullName || 'User');
}
