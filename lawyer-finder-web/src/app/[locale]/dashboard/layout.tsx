import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardSidebar from '@/components/layout/DashboardSidebar';

export default async function DashboardLayout({
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

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar role={session.role} locale={locale} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
