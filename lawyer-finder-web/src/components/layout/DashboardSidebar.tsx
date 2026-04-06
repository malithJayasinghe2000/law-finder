'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Scale, User, Inbox, FileText, LogOut, LayoutDashboard, Shield, Star, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useState } from 'react';
import { toast } from 'sonner';

interface DashboardSidebarProps {
  role: string;
  locale: string;
}

export default function DashboardSidebar({ role, locale }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const lawyerLinks = [
    { href: `/${locale}/dashboard/lawyer`, label: 'Overview', icon: LayoutDashboard },
    { href: `/${locale}/dashboard/lawyer/profile`, label: 'My Profile', icon: User },
    { href: `/${locale}/dashboard/lawyer/inquiries`, label: 'Inquiries', icon: Inbox },
    { href: `/${locale}/dashboard/lawyer/articles`, label: 'Articles', icon: FileText },
  ];

  const adminLinks = [
    { href: `/${locale}/dashboard/admin`, label: 'Overview', icon: LayoutDashboard },
    { href: `/${locale}/dashboard/admin/lawyers`, label: 'Manage Lawyers', icon: Shield },
    { href: `/${locale}/dashboard/admin/reviews`, label: 'Manage Reviews', icon: Star },
    { href: `/${locale}/dashboard/admin/subscription-conf`, label: 'Subscription Config', icon: Star },
  ];

  const links = role === 'ADMIN' ? adminLinks : lawyerLinks;

  const isActive = (href: string) => pathname === href;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Signed out successfully.');
      window.location.href = `/${locale}/login`;
    } catch {
      toast.error('Failed to sign out.');
    }
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Scale className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold tracking-tight">
          LawFinder<span className="text-muted-foreground font-normal ml-0.5">SL</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(link.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* Bottom */}
      <div className="p-3 space-y-1">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Scale className="h-4 w-4" />
          Back to Site
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar trigger */}
      <div className="fixed bottom-4 right-4 z-50 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger>
            <Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
