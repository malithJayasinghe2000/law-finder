'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, FileText, Settings, Star, ShieldCheck } from 'lucide-react';

export function AppSidebar({ locale, role }: { locale: string; role: string }) {
  const pathname = usePathname();

  const adminLinks = [
    { href: `/${locale}/dashboard/admin`, icon: ShieldCheck, label: 'Verifications' },
    { href: `/${locale}/dashboard/admin/users`, icon: Users, label: 'Platform Users' },
    { href: `/${locale}/dashboard/admin/reviews`, icon: Star, label: 'Reviews' },
    { href: `/${locale}/dashboard/admin/settings`, icon: Settings, label: 'Settings' },
  ];

  const lawyerLinks = [
    { href: `/${locale}/dashboard/lawyer`, icon: LayoutDashboard, label: 'Overview' },
    { href: `/${locale}/dashboard/lawyer/inquiries`, icon: Users, label: 'Client Inquiries' },
    { href: `/${locale}/dashboard/lawyer/articles`, icon: FileText, label: 'My Articles' },
    { href: `/${locale}/dashboard/lawyer/settings`, icon: Settings, label: 'Profile Settings' },
  ];

  const links = role === 'ADMIN' ? adminLinks : lawyerLinks;

  return (
    <Sidebar className="border-r top-16 h-[calc(100vh-64px)] hidden md:flex z-40 bg-white">
      <SidebarHeader className="p-6 border-b">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-black tracking-tight text-gray-900">{role === 'ADMIN' ? 'Control Panel' : 'Lawyer Portal'}</h2>
          <p className="text-xs text-gray-500 font-medium">{role === 'ADMIN' ? 'Platform Administration' : 'Manage your practice'}</p>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Menu</SidebarGroupLabel>
          <SidebarMenu className="gap-2">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton 
                    isActive={active}
                    className={`h-11 rounded-xl transition-all ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'}`}
                  >
                    <Link href={link.href} className="flex items-center gap-3 w-full">
                      <link.icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="text-sm">{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
