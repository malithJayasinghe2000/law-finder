import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children, params }: { children: React.ReactNode, params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  
  if (!session || (session.role !== 'ADMIN' && session.role !== 'LAWYER')) {
    redirect(`/${locale}/login`);
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-[calc(100vh-64px)]">
        <AppSidebar locale={locale} role={session.role} />
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50/30">
          <header className="flex h-14 md:hidden items-center border-b px-4 bg-white sticky top-16 z-30">
            <SidebarTrigger className="shrink-0" />
            <span className="font-bold ml-3 text-sm text-gray-900 line-clamp-1">{session.role === 'ADMIN' ? 'Control Panel' : 'Lawyer Portal'}</span>
          </header>
          <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-x-hidden">
            <div className="mx-auto w-full max-w-7xl">
               {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
