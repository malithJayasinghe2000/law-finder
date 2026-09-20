import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * Platform-staff guard, checked against the live role and not only the JWT.
 *
 * The session token lasts 24 hours, so a role taken out of it can be up to a
 * day stale. That is tolerable for rendering a menu and not for writing a legal
 * document, which is the same split the dashboard layout already uses: the
 * Edge middleware stays coarse because it cannot query Prisma, and the thing
 * that actually decides re-reads the database.
 */
export async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, error: 'Unauthorized' };

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  if (session.role !== 'ADMIN' || user?.role !== 'ADMIN') {
    return { ok: false, status: 403, error: 'Administrators only.' };
  }

  return { ok: true, userId: session.userId };
}
