import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import DashboardUserMenu from '@/components/layout/DashboardUserMenu';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';

export default async function DashboardLayout({ children, params }: { children: React.ReactNode, params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Query live role from DB so role changes (e.g. admin approving lawyer) take effect without re-login
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, profileImageUrl: true, fullName: true },
  });

  const liveRole = user?.role || session.role;

  if (liveRole !== 'ADMIN' && liveRole !== 'LAWYER' && liveRole !== 'CLIENT') {
    redirect(`/${locale}/login`);
  }

  /*
   * Authority inside a firm comes from an ACTIVE `FirmMember` row, never from
   * the platform role — a practice manager and a paralegal are not admitted
   * attorneys, so their platform `Role` is CLIENT.
   *
   * Phase 7 fixed that in `resolveMatterAccess`, the `/api/firms/*` guards, the
   * lawyer layout and the Edge middleware. It missed the navigation: this
   * sidebar chose its menu from the platform role alone, so a practice manager
   * was admitted by the layout and then shown the client menu, with no link to
   * their own firm. The pages worked and were reachable only by typing a URL —
   * the same "membership that grants nothing" shape, one layer further out.
   */
  const membership = await getFirmMembership(session.userId);

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-neutral-50 relative overflow-hidden">
        <AppSidebar
          locale={locale}
          role={liveRole}
          userId={session.userId}
          isFirmMember={!!membership}
          canManageFirm={canManageFirm(membership)}
        />
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          {/* Top bar */}
          <header className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40 print:hidden">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <SidebarTrigger />
              </div>
              <span className="text-[13px] font-semibold text-neutral-900 tracking-tight">{liveRole === 'ADMIN' ? 'Admin Dashboard' : (liveRole === 'LAWYER' ? 'Lawyer Portal' : (membership ? 'Firm Portal' : 'Client Portal'))}</span>
            </div>
            <div className="flex items-center gap-3">
              <DashboardUserMenu
                locale={locale}
                fullName={user?.fullName || session.fullName || null}
                profileImageUrl={user?.profileImageUrl || session.profileImageUrl || null}
                role={liveRole}
              />
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

