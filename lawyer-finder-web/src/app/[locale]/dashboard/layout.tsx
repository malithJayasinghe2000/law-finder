import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import Link from 'next/link';

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
      <div className="flex w-full min-h-screen bg-[#faf8f6] font-sans selection:bg-[#bfa37a]/30 relative overflow-hidden">
        <AppSidebar locale={locale} role={liveRole} userId={session.userId} />
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          {/* Top bar */}
          <header className="h-20 border-b border-[#efeae0] bg-[#faf8f6]/95 backdrop-blur-sm flex items-center justify-between px-6 lg:px-8 sticky top-0 z-40 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <SidebarTrigger className="text-neutral-700 hover:text-neutral-900" />
              </div>
              <span className="text-[14px] font-bold text-neutral-800 tracking-wider uppercase font-serif">{liveRole === 'ADMIN' ? 'Admin Dashboard' : (liveRole === 'LAWYER' ? 'Lawyer Portal' : 'Client Portal')}</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-neutral-700 hover:text-[#bfa37a] bg-white hover:bg-neutral-50 border border-[#efeae0] px-4 py-2.5 rounded-full transition-all duration-300 shadow-sm hover:shadow-md flex items-center gap-1.5">
                Back To Home
              </Link>
              <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center rounded-full overflow-hidden border border-[#efeae0] shadow-sm">
                {(user?.profileImageUrl || session.profileImageUrl) ? (
                  <img src={user?.profileImageUrl || session.profileImageUrl || ''} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <img src="/avatar.png" alt="Profile" className="h-full w-full object-cover" />
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 lg:p-10 overflow-x-hidden">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}


