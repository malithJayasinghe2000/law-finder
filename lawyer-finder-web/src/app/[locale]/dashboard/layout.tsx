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

  if (liveRole !== 'ADMIN' && liveRole !== 'LAWYER' && liveRole !== 'CLIENT') {
    redirect(`/${locale}/login`);
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-[#f5f5f7] relative overflow-hidden">
        <AppSidebar locale={locale} role={liveRole} userId={session.userId} />
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          {/* Top bar */}
          <header className="h-16 border-b border-neutral-200/60 bg-white/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <SidebarTrigger />
              </div>
              <span className="text-[13px] font-semibold text-neutral-900 tracking-tight">{liveRole === 'ADMIN' ? 'Admin Dashboard' : (liveRole === 'LAWYER' ? 'Lawyer Portal' : 'Client Portal')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-bold rounded-full cursor-pointer hover:text-neutral-500 border border-neutral-200 px-4 py-2 transition-colors hover:bg-neutral-50">
                <a href='/'>Back To Home</a>
              </div>
              <div className="w-9 h-9 bg-[#0d1017] text-white flex items-center justify-center text-xs font-bold rounded-full overflow-hidden">
                {(user?.profileImageUrl || session.profileImageUrl) ? (
                  <img src={user?.profileImageUrl || session.profileImageUrl || ''} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <img src="/avatar.png" alt="Profile" className="h-full w-full object-cover" />
                )}
              </div>

            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
