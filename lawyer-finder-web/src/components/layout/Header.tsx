'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Scale, Menu, Search, BookOpen, LogOut, FileText, UserCircle, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface HeaderProps {
  locale: string;
  userRole?: string | null;
  appStatus?: string | null;
}

export default function Header({ locale, userRole = null, appStatus = null }: HeaderProps) {
  const t = useTranslations('Navigation');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: `/${locale}/lawyers`, label: t('directory'), icon: Search },
    { href: `/${locale}/blog`, label: t('blog'), icon: BookOpen },
  ];

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        toast.success("Logged out successfully");
        window.location.href = `/${locale}`;
      }
    } catch {
      toast.error('Failed to logout');
    }
  };

  const isActive = (href: string) => pathname === href;

  const renderAuthAction = (isMobile: boolean = false) => {
    if (!userRole) {
      return (
        <Link href={`/${locale}/login`} onClick={() => setOpen(false)} className={isMobile ? "w-full block" : "ml-2"}>
          <Button size={isMobile ? "default" : "sm"} className={isMobile ? "w-full gap-2 font-semibold" : "gap-2 font-semibold shadow-md"}>
            <UserCircle className="h-4 w-4" />
            {t('login')}
          </Button>
        </Link>
      );
    }
    
    // Authenticated Users (Avatar Dropdown)
    if (isMobile) {
      // Mobile simplistic render
      return (
        <div className="flex flex-col gap-2 mt-4">
          <DropdownMenuSeparator className="bg-border my-2" />
          <Button variant="ghost" className="w-full justify-start gap-2" disabled>
             <UserCircle className="h-5 w-5" /> Account Menu
          </Button>
          {userRole === 'ADMIN' && <Link href={`/${locale}/dashboard/admin`}><Button variant="outline" className="w-full justify-start gap-2 text-primary border-primary/20 hover:bg-primary/5">Admin Panel</Button></Link>}
          {userRole === 'LAWYER' && <Link href={`/${locale}/dashboard/lawyer`}><Button variant="outline" className="w-full justify-start gap-2 text-primary border-primary/20 hover:bg-primary/5">Lawyer Dashboard</Button></Link>}
          {userRole === 'CLIENT' && appStatus === 'DRAFT' && <Link href={`/${locale}/apply`}><Button className="w-full justify-start gap-2 bg-amber-500 hover:bg-amber-600">Resume App</Button></Link>}
          {userRole === 'CLIENT' && (appStatus === 'SUBMITTED' || appStatus === 'IN_REVIEW') && <Button variant="secondary" className="w-full justify-start gap-2" disabled>App Pending</Button>}
          {userRole === 'CLIENT' && (!appStatus || appStatus === 'REJECTED') && <Link href={`/${locale}/apply`}><Button className="w-full justify-start gap-2 bg-blue-600 text-white">Become a Lawyer</Button></Link>}
          <Button variant="destructive" className="w-full justify-start gap-2 mt-2" onClick={handleLogout}>
             <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      );
    }

    // Desktop Dropdown
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="relative h-9 w-9 rounded-full ml-4 shadow-sm border border-border/50 outline-none hover:ring-2 hover:ring-primary/20 transition-all">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary font-bold">{userRole[0]}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <div className="px-2 py-1.5 font-normal border-b pb-2 mb-2">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none tracking-tight">Account</p>
              <p className="text-xs leading-none text-muted-foreground font-mono bg-muted p-1 rounded-sm w-fit mt-1">{userRole}</p>
            </div>
          </div>
          
          {userRole === 'ADMIN' && (
            <Link href={`/${locale}/dashboard/admin`}>
              <DropdownMenuItem className="cursor-pointer font-medium text-primary">
                <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Panel
              </DropdownMenuItem>
            </Link>
          )}

          {userRole === 'LAWYER' && (
            <Link href={`/${locale}/dashboard/lawyer`}>
              <DropdownMenuItem className="cursor-pointer font-medium text-primary">
                <LayoutDashboard className="mr-2 h-4 w-4" /> My Dashboard
              </DropdownMenuItem>
            </Link>
          )}

          {userRole === 'CLIENT' && (
            <>
              {appStatus === 'DRAFT' && (
                <Link href={`/${locale}/apply`}>
                  <DropdownMenuItem className="cursor-pointer text-amber-600 focus:text-amber-700 font-medium">
                    <FileText className="mr-2 h-4 w-4" /> Resume Application
                  </DropdownMenuItem>
                </Link>
              )}
              {(appStatus === 'SUBMITTED' || appStatus === 'IN_REVIEW') && (
                <DropdownMenuItem disabled className="opacity-80 font-medium">
                   <FileText className="mr-2 h-4 w-4" /> Application Pending
                </DropdownMenuItem>
              )}
              {(!appStatus || appStatus === 'REJECTED') && (
                <Link href={`/${locale}/apply`}>
                  <DropdownMenuItem className="cursor-pointer text-blue-600 focus:text-blue-700 font-bold">
                    <Scale className="mr-2 h-4 w-4" /> Become a Lawyer
                  </DropdownMenuItem>
                </Link>
              )}
            </>
          )}

          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700 cursor-pointer font-semibold">
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <Scale className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            LawFinder<span className="text-muted-foreground font-normal ml-0.5">SL</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
          <div className="mx-3 h-6 w-px bg-border" />
          {renderAuthAction(false)}
        </nav>

        {/* Mobile Nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="md:hidden">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="flex items-center gap-2 px-1 mb-2">
              <Scale className="h-5 w-5" />
              LawFinder SL
            </SheetTitle>
            <SheetDescription className="sr-only">Mobile navigation menu</SheetDescription>
            <div className="my-4 h-px bg-border" />
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
              {renderAuthAction(true)}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
