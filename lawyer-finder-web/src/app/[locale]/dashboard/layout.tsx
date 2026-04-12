import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';

export default async function DashboardLayout({ children, params }: { children: React.ReactNode, params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Query live role from DB so role changes (e.g. admin approving lawyer) take effect without re-login
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, profileImageUrl: true },
  });

  const liveRole = user?.role || session.role;

  if (liveRole !== 'ADMIN' && liveRole !== 'LAWYER') {
    redirect(`/${locale}/login`);
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-neutral-50 relative overflow-hidden">
        <AppSidebar locale={locale} role={liveRole} />
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          {/* Top bar */}
          <header className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <SidebarTrigger />
              </div>
              <span className="text-[13px] font-semibold text-neutral-900 tracking-tight">{liveRole === 'ADMIN' ? 'Admin Dashboard' : 'Lawyer Portal'}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-bold rounded-none cursor-pointer hover:text-neutral-500 border border-neutral-200 px-2 py-2">
                <a href='/'>Back To Home</a>
              </div>
              <div className="w-8 h-8 bg-[#0a0a0a] text-white flex items-center justify-center text-xs font-bold rounded-none">
                {(user?.profileImageUrl || session.profileImageUrl) ? (
                  <img src={user?.profileImageUrl || session.profileImageUrl || ''} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <img src="/avatar.png" alt="Profile" className="h-full w-full object-cover" />
                )}
              </div>

            </div>
          </header>
          <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

