import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';

export default async function LawyerDashboardLayout({ children, params }: { children: React.ReactNode, params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });

  const liveRole = user?.role || session.role;

  if (liveRole !== 'LAWYER' && liveRole !== 'ADMIN') {
    redirect(`/${locale}/dashboard`);
  }

  return <>{children}</>;
}
