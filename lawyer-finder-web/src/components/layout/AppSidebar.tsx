'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarFooter, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, FileText, Settings, Star, ShieldCheck, LogOut, Megaphone, Image, ShieldPlus, ChevronDown, History } from 'lucide-react';
import { toast } from 'sonner';

export function AppSidebar({ locale, role }: { locale: string; role: string }) {
  const pathname = usePathname();

  const adminLinks = [
    { href: `/${locale}/dashboard/admin`, icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { href: `/${locale}/dashboard/admin/verification`, icon: ShieldCheck, label: 'Verification' },
    { href: `/${locale}/dashboard/admin/paymentTemplate`, icon: ShieldCheck, label: 'Payment Templates' },
    { href: `/${locale}/dashboard/admin/paid-promo`, icon: Megaphone, label: 'Paid Promo' },
    { href: `/${locale}/dashboard/admin/advertisements`, icon: Image, label: 'Advertisements' },
    { href: `/${locale}/dashboard/admin/users`, icon: Users, label: 'User Management' },
    { href: `/${locale}/dashboard/admin/reviews`, icon: Star, label: 'Reviews' },
    { href: `/${locale}/dashboard/admin/settings`, icon: Settings, label: 'Settings' },
    { href: `/${locale}/dashboard/admin/subscription-conf`, icon: ShieldPlus, label: 'Subscription Config' },
  ];

  const lawyerLinks = [
    { href: `/${locale}/dashboard/lawyer`, icon: LayoutDashboard, label: 'Overview' },
    { 
      href: `/${locale}/dashboard/lawyer/payments`, 
      icon: ShieldPlus, 
      label: 'Payments',
      subLinks: [
        { href: `/${locale}/dashboard/lawyer/payments/history`, icon: History, label: 'Payment History' },
      ]
    },
    { href: `/${locale}/dashboard/lawyer/inquiries`, icon: Users, label: 'Client Inquiries' },
    { href: `/${locale}/dashboard/lawyer/articles`, icon: FileText, label: 'My Articles' },
    { href: `/${locale}/profile`, icon: Settings, label: 'Profile Settings' },
  ];

  const links = role === 'ADMIN' ? adminLinks : lawyerLinks;

  const isLinkActive = (link: typeof links[0]) => {
    if ('exact' in link && link.exact) {
      return pathname === link.href;
    }
    return pathname === link.href || pathname.startsWith(link.href + '/');
  };

  return (
    <Sidebar className="border-r border-neutral-200 bg-white">
      <SidebarHeader className="px-6 py-5 border-b border-neutral-200 bg-[#0a0a0a]">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold tracking-tight text-white">{role === 'ADMIN' ? 'Control Panel' : 'Lawyer Portal'}</h2>
          <p className="text-[11px] text-neutral-400 font-medium tracking-wide uppercase">{role === 'ADMIN' ? 'Platform Administration' : 'Manage your practice'}</p>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.15em] mb-2 px-3">Menu</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {links.map((link) => {
              const active = isLinkActive(link);
              const hasSublinks = 'subLinks' in link && link.subLinks && link.subLinks.length > 0;
              
              return (
                <SidebarMenuItem key={link.href}>
                  {hasSublinks ? (
                    <div className="flex flex-col">
                      <SidebarMenuButton
                        className={`h-10 rounded-none transition-all duration-150 ${active ? 'bg-[#0a0a0a] text-white font-semibold shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 font-medium'}`}
                      >
                        <div className="flex items-center gap-3 w-full px-1">
                          <link.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-black' : 'text-neutral-400'}`} />
                          <span className="text-[13px]">{link.label}</span>
                          <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${active ? 'rotate-180' : ''}`} />
                        </div>
                      </SidebarMenuButton>
                      <SidebarMenuSub className="border-l border-neutral-200 ml-5 pl-2 mt-1 gap-1">
                        {link.subLinks!.map((sub) => {
                          const subActive = pathname === sub.href;
                          return (
                            <SidebarMenuSubItem key={sub.href}>
                              <SidebarMenuSubButton asChild isActive={subActive}>
                                <Link 
                                  href={sub.href} 
                                  className={`flex items-center gap-3 w-full px-2 py-2 text-[12px] transition-colors rounded-none ${subActive ? 'text-black font-bold bg-neutral-100' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'}`}
                                >
                                  <sub.icon className="w-3.5 h-3.5" />
                                  <span>{sub.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </div>
                  ) : (
                    <SidebarMenuButton
                      isActive={active}
                      className={`h-10 rounded-none transition-all duration-150 ${active ? 'bg-[#0a0a0a] text-white font-semibold shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 font-medium'}`}
                    >
                      <Link href={link.href} className="flex items-center gap-3 w-full px-1">
                        <link.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-black' : 'text-neutral-400'}`} />
                        <span className="text-[13px]">{link.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-neutral-200 p-3">
        <button
          onClick={async () => {
            try {
              const res = await fetch('/api/auth/logout', { method: 'POST' });
              if (res.ok) window.location.href = `/${locale}`;
            } catch { toast.error('Failed to logout'); }
          }}
          className="flex items-center gap-3 w-full h-10 px-3 rounded-none text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold transition-colors text-[13px]"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span>Log out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
