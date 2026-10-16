import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { EmailService } from '@/lib/email/EmailService';

/**
 * "Forgot password" links.
 *
 * Until 2026-10-16 there was no way for a person to reset their own password:
 * the only recovery was an admin typing a new one in User Management, which let
 * platform staff sign in as any attorney and read their clients' matters
 * (guardrail rule 5). Now the person always chooses the password, through a
 * link sent to their own address.
 *
 * Only a SHA-256 hash of the token is stored. A link works once, for one hour,
 * and sending a new link cancels any earlier one.
 */

const LINK_LIFETIME_MS = 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Creates a link for this account and emails it. Returns nothing a caller could
 * pass back to the person who asked: the link goes only to the account's inbox.
 */
export async function sendPasswordResetLink(
  user: { id: string; email: string },
  opts: { requestedById?: string | null; locale?: string } = {}
): Promise<void> {
  const token = randomBytes(32).toString('hex');

  await prisma.$transaction([
    // One live link per account.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + LINK_LIFETIME_MS),
        requestedById: opts.requestedById ?? null,
      },
    }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thelawyr.lk';
  const locale = ['en', 'si', 'ta'].includes(opts.locale ?? '') ? opts.locale : 'en';
  // Not awaited: the mail server takes 5-18 s. sendMailSafe logs a failure.
  void EmailService.sendPasswordReset({
    to: user.email,
    resetUrl: `${appUrl}/${locale}/reset-password?token=${token}`,
    byAdmin: !!opts.requestedById,
  });
}

export type ResetOutcome = 'RESET' | 'INVALID' | 'EXPIRED';

/** Sets a new password from a link. The link is spent whatever the outcome. */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<ResetOutcome> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt) return 'INVALID';
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return 'EXPIRED';
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Claim the link first, so two requests with the same link cannot both win.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return 'INVALID';

  await prisma.user.update({
    where: { id: record.userId },
    // Opening the link proves they hold the inbox, which is what email
    // verification proves too.
    data: { passwordHash, isEmailVerified: true },
  });

  return 'RESET';
}
