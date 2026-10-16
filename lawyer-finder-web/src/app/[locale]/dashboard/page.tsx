import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getFirmMembership } from '@/lib/firms/access';

/**
 * `/dashboard` sends each person to their own home.
 *
 * There was no page here, yet the lawyer, client and admin layouts, the 404 page
 * and the directory-withdrawn notice all send people to `/dashboard` — so each of
 * those ended on "This page could not be found". A practice manager removed from
 * a firm, for example, landed on a 404 instead of their client dashboard.
 *
 * Firm-side is decided by MEMBERSHIP, not the platform role: a practice manager's
 * account is CLIENT. Each destination's layout admits exactly the people routed
 * to it here, so this cannot loop.
 */
export default async function DashboardHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Live role, as the layouts read it, so an approval takes effect at once.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  const role = user?.role || session.role;

  if (role === 'ADMIN') redirect(`/${locale}/dashboard/admin`);
  if (role === 'LAWYER') redirect(`/${locale}/dashboard/lawyer`);
  if (await getFirmMembership(session.userId)) redirect(`/${locale}/dashboard/lawyer`);
  redirect(`/${locale}/dashboard/client`);
}
