'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarFooter, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, FileText, Settings, Star, ShieldCheck, LogOut, Megaphone, Image, ShieldPlus, ChevronDown, History, CreditCard, MessageCircle, Globe, PenSquare, Flag, CalendarDays, DollarSign, Banknote } from 'lucide-react';
import ChatBadge from '@/components/chat/ChatBadge';
import { toast } from 'sonner';
import React, { useState } from 'react';

export function AppSidebar({ locale, role, userId }: { locale: string; role: string; userId?: string }) {
  const pathname = usePathname();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>(['Payments','Consultations']); // Default open for better UX, or empty

  const adminLinks = [
    { href: `/${locale}/dashboard/admin`, icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { href: `/${locale}/dashboard/admin/verification`, icon: ShieldCheck, label: 'Verification' },
    { href: `/${locale}/dashboard/admin/invoices`, icon: FileText, label: 'Invoices' },
    // { href: `/${locale}/dashboard/admin/paymentTemplate`, icon: ShieldCheck, label: 'Payment Templates' },
    { href: `/${locale}/dashboard/admin/advertisements`, icon: Image, label: 'Ad Campaigns' },
    { href: `/${locale}/dashboard/admin/users`, icon: Users, label: 'User Management' },
    { href: `/${locale}/dashboard/admin/reviews`, icon: Star, label: 'Reviews' },
    { href: `/${locale}/dashboard/admin/communities`, icon: Globe, label: 'Communities' },
    { href: `/${locale}/dashboard/admin/content-moderation`, icon: Flag, label: 'Content Moderation' },
    {
      href: `/${locale}/dashboard/admin/consultations`,
      icon: CalendarDays,
      label: 'Consultations',
      subLinks: [
        { href: `/${locale}/dashboard/admin/consultations`, icon: CalendarDays, label: 'All Bookings' },
        { href: `/${locale}/dashboard/admin/consultations/payments`, icon: DollarSign, label: 'Payments & Commission' },
        { href: `/${locale}/dashboard/admin/consultations/refunds`, icon: Banknote, label: 'Refunds' },
      ]
    },
    { href: `/${locale}/dashboard/admin/settings`, icon: Settings, label: 'Settings' },
    { href: `/${locale}/dashboard/admin/subscriptions`, icon: ShieldPlus, label: 'Subscription Config' },
  ];

  const lawyerLinks = [
    { href: `/${locale}/dashboard/lawyer`, icon: LayoutDashboard, label: 'Overview' },
    {
      href: `/${locale}/dashboard/lawyer/consultations`,
      icon: CalendarDays,
      label: 'Consultations',
      subLinks: [
        { href: `/${locale}/dashboard/lawyer/consultations`, icon: CalendarDays, label: 'Bookings' },
        { href: `/${locale}/dashboard/lawyer/consultations/availability`, icon: History, label: 'Set Availability' },
        { href: `/${locale}/dashboard/lawyer/consultations/pricing`, icon: DollarSign, label: 'Pricing' },
        { href: `/${locale}/dashboard/lawyer/consultations/earnings`, icon: Banknote, label: 'Earnings' },
      ]
    },
    { href: `/${locale}/dashboard/lawyer/chat`, icon: MessageCircle, label: 'Messages', hasBadge: true },
    { href: `/${locale}/dashboard/lawyer/ads`, icon: Image, label: 'My Ads' },
    { 
      href: `/${locale}/dashboard/lawyer/payments`, 
      icon: CreditCard, 
      label: 'Payments',
      subLinks: [
        { href: `/${locale}/dashboard/lawyer/payments/invoices`, icon: FileText, label: 'Invoices' },
        { href: `/${locale}/dashboard/lawyer/payments/history`, icon: History, label: 'Payment History' },
      ]
    },
    { href: `/${locale}/blog/my-posts`, icon: PenSquare, label: 'Community Posts' },
    { href: `/${locale}/profile`, icon: Settings, label: 'Profile Settings' },
  ];

  const clientLinks = [
    { href: `/${locale}/dashboard/client`, icon: LayoutDashboard, label: 'Overview', exact: true },
    { href: `/${locale}/dashboard/client/consultations`, icon: CalendarDays, label: 'My Consultations' },
    { href: `/${locale}/blog/my-posts`, icon: PenSquare, label: 'Community Posts' },
    { href: `/${locale}/profile`, icon: Settings, label: 'Profile Settings' },
  ];

  const links = role === 'ADMIN' ? adminLinks : (role === 'LAWYER' ? lawyerLinks : clientLinks);

  const isLinkActive = (link: any) => {
    if (link.exact) {
      return pathname === link.href;
    }
    return pathname === link.href || pathname.startsWith(link.href + '/');
  };

  const toggleSubmenu = (label: string) => {
    setOpenSubmenus(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label) 
        : [...prev, label]
    );
  };

  return (
    <Sidebar className="border-r border-neutral-200 bg-white">
      <SidebarHeader className="px-6 py-5 border-b border-neutral-200 bg-[#0a0a0a]">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold tracking-tight text-white">{role === 'ADMIN' ? 'Control Panel' : (role === 'LAWYER' ? 'Lawyer Portal' : 'Client Portal')}</h2>
          <p className="text-[11px] text-neutral-400 font-medium tracking-wide uppercase">{role === 'ADMIN' ? 'Platform Administration' : (role === 'LAWYER' ? 'Manage your practice' : 'Manage your account')}</p>
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
                        onClick={() => toggleSubmenu(link.label)}
                        isActive={active}
                        className={`h-10 rounded-none transition-all duration-150 ${active ? 'bg-[#0a0a0a] text-white font-semibold shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 font-medium'}`}
                      >
                        <div className="flex items-center gap-3 w-full px-1">
                          <link.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-black' : 'text-neutral-400'}`} />
                          <span className="text-[13px]">{link.label}</span>
                          <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${openSubmenus.includes(link.label) ? 'rotate-180' : ''}`} />
                        </div>
                      </SidebarMenuButton>
                      {openSubmenus.includes(link.label) && (
                        <SidebarMenuSub className="border-l border-neutral-200 ml-5 pl-2 mt-1 gap-1">
                          {link.subLinks!.map((sub) => {
                            const subActive = pathname === sub.href;
                            return (
                              <SidebarMenuSubItem key={sub.href}>
                      <SidebarMenuSubButton 
                                  isActive={subActive}
                                  render={
                                    <Link 
                                      href={sub.href} 
                                      className={`flex items-center gap-3 w-full px-2 py-2 text-[12px] transition-colors rounded-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 ${subActive ? 'text-black font-bold bg-neutral-100 border-l-2 border-black' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'}`}
                                    />
                                  }
                                >
                                  <sub.icon className={`w-3.5 h-3.5 ${subActive ? 'text-black' : ''}`} />
                                  <span>{sub.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </div>
                  ) : (
                    <SidebarMenuButton
                      isActive={active}
                      className={`h-10 rounded-none transition-all duration-150 outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 ${active ? 'bg-[#0a0a0a] text-white font-semibold shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 font-medium'}`}
                      render={<Link href={link.href} className="flex items-center gap-3 w-full px-1" />}
                    >
                        <link.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-black' : 'text-neutral-400'}`} />
                        <span className="text-[13px]">{link.label}</span>
                        {('hasBadge' in link) && link.hasBadge && userId && (
                          <div className="ml-auto flex items-center">
                            <ChatBadge userId={userId} isSidebar={true} />
                          </div>
                        )}
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
