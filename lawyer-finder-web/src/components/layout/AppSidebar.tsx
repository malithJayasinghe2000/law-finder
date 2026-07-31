'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarFooter, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, FileText, Settings, Star, ShieldCheck, LogOut, Megaphone, Image, ShieldPlus, ChevronDown, History, CreditCard, MessageCircle, Globe, PenSquare, Flag, CalendarDays, DollarSign, Banknote, BookOpen } from 'lucide-react';
import ChatBadge from '@/components/chat/ChatBadge';
import { toast } from 'sonner';
import React, { useState } from 'react';

export function AppSidebar({ locale, role, userId }: { locale: string; role: string; userId?: string }) {
  const pathname = usePathname();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>(['Payments','Consultations']); // Default open for better UX, or empty
  const [counts, setCounts] = useState({ pendingInvoicesCount: 0, pendingAdCampaignsCount: 0, pendingBankPaymentsCount: 0 });

  React.useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/dashboard/sidebar-counts');
        if (res.ok) {
          const data = await res.json();
          setCounts(data);
        }
      } catch (err) {
        console.error('Failed to fetch sidebar counts:', err);
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const adminLinks = [
    { href: `/${locale}/dashboard/admin`, icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { href: `/${locale}/dashboard/admin/verification`, icon: ShieldCheck, label: 'Verification' },
    { href: `/${locale}/dashboard/admin/invoices`, icon: FileText, label: 'Invoices' },
    // { href: `/${locale}/dashboard/admin/paymentTemplate`, icon: ShieldCheck, label: 'Payment Templates' },
    {
      href: `/${locale}/dashboard/admin/advertisements`,
      icon: Image,
      label: 'Ad Campaigns',
      subLinks: [
        { href: `/${locale}/dashboard/admin/advertisements`, icon: Image, label: 'Campaigns' },
        { href: `/${locale}/dashboard/admin/ad-config`, icon: Settings, label: 'Placement Config' },
      ]
    },
    { href: `/${locale}/dashboard/admin/users`, icon: Users, label: 'User Management' },
    { href: `/${locale}/dashboard/admin/reviews`, icon: Star, label: 'Reviews' },
    { href: `/${locale}/dashboard/admin/communities`, icon: Globe, label: 'Communities' },
    { href: `/${locale}/dashboard/admin/content-moderation`, icon: Flag, label: 'Content Moderation' },
    { href: `/${locale}/dashboard/admin/legal-documents`, icon: BookOpen, label: 'Legal Documents' },
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
    { href: `/${locale}/dashboard/admin/finances`, icon: DollarSign, label: 'Financial Reports' },
    { href: `/${locale}/dashboard/admin/settings`, icon: Settings, label: 'Settings' },
    { href: `/${locale}/dashboard/admin/subscriptions`, icon: ShieldPlus, label: 'Subscription Config' },
  ];

  const lawyerLinks = [
    { href: `/${locale}/dashboard/lawyer`, icon: LayoutDashboard, label: 'Dashboard' },
    {
      href: `/${locale}/dashboard/lawyer/consultations`,
      icon: CalendarDays,
      label: 'Consultations',
      subLinks: [
        { href: `/${locale}/dashboard/lawyer/consultations`, icon: CalendarDays, label: 'Bookings' },
        { href: `/${locale}/dashboard/lawyer/consultations/availability`, icon: History, label: 'Set Availability' },
        { href: `/${locale}/dashboard/lawyer/consultations/pricing`, icon: DollarSign, label: 'Pricing' },
        { href: `/${locale}/dashboard/lawyer/consultations/earnings`, icon: Banknote, label: 'Consultation Income' },
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
    { href: `/${locale}/dashboard/blog/my-posts`, icon: PenSquare, label: 'Community Posts' },
    { href: `/${locale}/dashboard/profile`, icon: Settings, label: 'Profile Settings' },
  ];

  const clientLinks = [
    { href: `/${locale}/dashboard/client`, icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { href: `/${locale}/dashboard/client/consultations`, icon: CalendarDays, label: 'My Consultations' },
    { href: `/${locale}/dashboard/blog/my-posts`, icon: PenSquare, label: 'Community Posts' },
    { href: `/${locale}/dashboard/profile`, icon: Settings, label: 'Profile Settings' },
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
    <Sidebar className="border-r border-[#efeae0] bg-[#fbf9f6]">
      <SidebarHeader className="h-20 flex flex-col justify-center px-6 border-b border-[#efeae0] bg-[#fbf9f6]">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[13px] font-bold tracking-widest text-neutral-900 uppercase font-serif">{role === 'ADMIN' ? 'Control Panel' : (role === 'LAWYER' ? 'Lawyer Portal' : 'Client Portal')}</h2>
          <p className="text-[9px] text-[#bfa37a] font-bold tracking-wider uppercase">{role === 'ADMIN' ? 'Platform Administration' : (role === 'LAWYER' ? 'Manage your practice' : 'Manage your account')}</p>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-4 py-6 bg-[#fbf9f6]">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-3 px-3">Menu</SidebarGroupLabel>
          <SidebarMenu className="gap-1.5">
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
                        className={`h-11 rounded-2xl border transition-all duration-200 ${
                          active 
                            ? 'bg-white border-[#efeae0] text-[#bfa37a] shadow-[0_4px_12px_rgba(0,0,0,0.03)] font-bold' 
                            : 'border-transparent text-neutral-600 hover:bg-white/50 hover:text-neutral-900 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full px-1.5">
                          <link.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-[#bfa37a]' : 'text-neutral-400'}`} />
                          <span className="text-[13px] tracking-tight">{link.label}</span>
                          {link.label === 'Payments' && role === 'LAWYER' && counts.pendingInvoicesCount > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-[16px]">
                              {counts.pendingInvoicesCount}
                            </span>
                          )}
                          {link.label === 'Ad Campaigns' && role === 'ADMIN' && counts.pendingAdCampaignsCount > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-[16px]">
                              {counts.pendingAdCampaignsCount}
                            </span>
                          )}
                          {link.label === 'Consultations' && role === 'ADMIN' && counts.pendingBankPaymentsCount > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-[16px]">
                              {counts.pendingBankPaymentsCount}
                            </span>
                          )}
                          <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${openSubmenus.includes(link.label) ? 'rotate-180' : ''}`} />
                        </div>
                      </SidebarMenuButton>
                      {openSubmenus.includes(link.label) && (
                        <SidebarMenuSub className="border-l border-[#efeae0] ml-6 pl-3 mt-1.5 gap-1.5">
                          {link.subLinks!.map((sub) => {
                            const subActive = pathname === sub.href;
                            return (
                              <SidebarMenuSubItem key={sub.href}>
                                <SidebarMenuSubButton 
                                  isActive={subActive}
                                  render={
                                    <Link 
                                      href={sub.href} 
                                      className={`h-auto flex items-center gap-3 w-full px-3 py-2 text-[12px] transition-all rounded-xl border ${
                                        subActive 
                                          ? 'text-[#bfa37a] font-bold bg-white border-[#efeae0] shadow-sm' 
                                          : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/40 border-transparent'
                                      }`}
                                    />
                                  }
                                >
                                  <sub.icon className={`w-3.5 h-3.5 shrink-0 ${subActive ? 'text-[#bfa37a]' : 'text-neutral-400'}`} />
                                  <span className="truncate">{sub.label}</span>
                                  {sub.label === 'Invoices' && role === 'LAWYER' && counts.pendingInvoicesCount > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-[16px] shrink-0">
                                      {counts.pendingInvoicesCount}
                                    </span>
                                  )}
                                  {sub.label === 'Campaigns' && role === 'ADMIN' && counts.pendingAdCampaignsCount > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-[16px] shrink-0">
                                      {counts.pendingAdCampaignsCount}
                                    </span>
                                  )}
                                  {sub.label === 'Payments & Commission' && role === 'ADMIN' && counts.pendingBankPaymentsCount > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-[16px] shrink-0">
                                      {counts.pendingBankPaymentsCount}
                                    </span>
                                  )}
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
                      className={`h-11 rounded-2xl border transition-all duration-200 ${
                        active 
                          ? 'bg-white border-[#efeae0] text-[#bfa37a] shadow-[0_4px_12px_rgba(0,0,0,0.03)] font-bold' 
                          : 'border-transparent text-neutral-600 hover:bg-white/50 hover:text-neutral-900 font-medium'
                      }`}
                      render={<Link href={link.href} className="flex items-center gap-3 w-full px-1.5" />}
                    >
                      <link.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-[#bfa37a]' : 'text-neutral-400'}`} />
                      <span className="text-[13px] tracking-tight">{link.label}</span>
                      {link.label === 'Ad Campaigns' && role === 'ADMIN' && counts.pendingAdCampaignsCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                          {counts.pendingAdCampaignsCount}
                        </span>
                      )}
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
      <SidebarFooter className="border-t border-[#efeae0] p-4 bg-[#fbf9f6]">
        <button
          onClick={async () => {
            try {
              const res = await fetch('/api/auth/logout', { method: 'POST' });
              if (res.ok) window.location.href = `/${locale}`;
            } catch { toast.error('Failed to logout'); }
          }}
          className="flex items-center gap-3 w-full h-11 px-4 rounded-2xl text-red-500 hover:bg-red-50 hover:text-red-700 hover:border-red-100 border border-transparent font-semibold transition-all duration-200 text-[13px]"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span>Log out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
