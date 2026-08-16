import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { getFirmMembership } from '@/lib/firms/access';

/**
 * The firm-side dashboard.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHO GETS IN, AND WHY IT IS NOT JUST `role === 'LAWYER'`.
 *
 * This used to redirect anyone whose platform role was not LAWYER or ADMIN.
 * That silently excluded every non-attorney member of a law firm — a practice
 * manager and a paralegal are not admitted attorneys, so their platform `Role`
 * is CLIENT — and it was the third layer of the same mistake, alongside
 * `resolveMatterAccess` and the `/api/firms/*` route guards.
 *
 * The effect was that a firm could invite its practice manager, the invitation
 * would be accepted, the API would answer them correctly, and every page would
 * bounce them to the client dashboard. Membership that grants nothing is worse
 * than no membership, because the firm believes their staff have access.
 *
 * Being *in* this section is not authority to do anything: what each person can
 * actually read or change is decided per route by `src/lib/firms/access.ts`.
 * This layout only answers "is this a firm-side person at all".
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default async function LawyerDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Queried live so a role change (an admin approving an attorney) takes effect
  // without the person having to sign out and back in.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  const liveRole = user?.role || session.role;

  if (liveRole === 'LAWYER' || liveRole === 'ADMIN') {
    return <>{children}</>;
  }

  // Not an attorney — but possibly firm staff. An ACTIVE membership of an active
  // firm is what makes someone firm-side.
  const membership = await getFirmMembership(session.userId);
  if (membership) {
    return <>{children}</>;
  }

  redirect(`/${locale}/dashboard`);
}
