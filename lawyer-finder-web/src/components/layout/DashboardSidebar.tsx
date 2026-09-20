'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Scale, User, FileText, LogOut, LayoutDashboard, Shield, Star, Menu, BookOpen, Banknote, Landmark, ArrowRightLeft, Building2, Briefcase, MessageSquare, CalendarDays, Receipt, Megaphone, Users } from 'lucide-react';
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

  /**
   * Navigation.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * Every href below resolves to a page that exists. That is worth stating,
   * because before Phase 7 four of the twelve did not: `lawyer/profile`,
   * `lawyer/articles`, `admin/lawyers` and `admin/subscription-conf` were all
   * 404s, and `lawyer/inquiries` pointed at a page that had never existed. At
   * the same time the sidebar did not link to an attorney's **matters**, their
   * **messages**, or their **invoices** — the three screens they actually use.
   *
   * So the primary navigation mostly led nowhere while the real product was
   * reachable only by typing a URL. If someone is lost in a screen, that is a
   * bug in the screen.
   *
   * If you add a link here, open it.
   * ───────────────────────────────────────────────────────────────────────────
   */
  const lawyerLinks = [
    { href: `/${locale}/dashboard/lawyer`, label: 'Overview', icon: LayoutDashboard },
    { href: `/${locale}/dashboard/lawyer/consultations`, label: 'Matters', icon: Briefcase },
    { href: `/${locale}/dashboard/lawyer/consultations/availability`, label: 'Availability', icon: CalendarDays },
    { href: `/${locale}/dashboard/lawyer/chat`, label: 'Messages', icon: MessageSquare },
    { href: `/${locale}/dashboard/lawyer/firm`, label: 'My Firm', icon: Building2 },
    { href: `/${locale}/dashboard/profile`, label: 'My Profile', icon: User },
    { href: `/${locale}/dashboard/blog/my-posts`, label: 'Articles', icon: FileText },
    { href: `/${locale}/dashboard/lawyer/consultations/earnings`, label: 'Consultation Income', icon: Banknote },
    { href: `/${locale}/dashboard/lawyer/consultations/refunds`, label: 'Refunds', icon: ArrowRightLeft },
    { href: `/${locale}/dashboard/lawyer/invoices`, label: 'Software Licence', icon: Receipt },
  ];

  const adminLinks = [
    { href: `/${locale}/dashboard/admin`, label: 'Overview', icon: LayoutDashboard },
    { href: `/${locale}/dashboard/admin/verification`, label: 'Attorney Verification', icon: Shield },
    { href: `/${locale}/dashboard/admin/firms`, label: 'Law Firms', icon: Building2 },
    { href: `/${locale}/dashboard/admin/users`, label: 'Users', icon: Users },
    { href: `/${locale}/dashboard/admin/subscriptions`, label: 'Subscriptions', icon: Star },
    { href: `/${locale}/dashboard/admin/advertisers`, label: 'Advertisers', icon: Megaphone },
    { href: `/${locale}/dashboard/admin/legal-documents`, label: 'Legal Documents', icon: BookOpen },
    { href: `/${locale}/dashboard/admin/finances`, label: 'Financial Reports', icon: Landmark },
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
      <div className="flex h-16 items-center border-b px-5 bg-card">
        <Image
          src="/logo.png"
          alt="TheLawyr Logo"
          width={110}
          height={28}
          className="h-7 w-auto object-contain"
        />
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
