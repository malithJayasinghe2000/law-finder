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
  const isPremiumDesign = pathname === `/${locale}` || pathname === '/';

  if (pathname.includes('/dashboard')) {
    return null;
  }

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
      if (isPremiumDesign && !isMobile) {
        return (
          <Link href={`/${locale}/login`} onClick={() => setOpen(false)} className="ml-2">
            <Button variant="outline" className="gap-2 rounded-none border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white px-6 font-light">
              <UserCircle className="h-4 w-4" />
              {t('login')}
            </Button>
          </Link>
        );
      }
      return (
        <Link href={`/${locale}/login`} onClick={() => setOpen(false)} className={isMobile ? "w-full block mt-2" : "ml-4"}>
          <Button className={isMobile ? "w-full gap-2 font-semibold rounded-none bg-[#0a0a0a] text-white hover:bg-neutral-800 py-6" : "gap-2 font-medium rounded-none bg-[#0a0a0a] text-white px-7 hover:bg-neutral-800 transition-all hover:scale-105"}>
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
        <DropdownMenuTrigger className={`relative flex items-center justify-center h-9 w-9 rounded-none ml-4 shadow-sm border outline-none hover:ring-2 hover:ring-primary/20 transition-all ${isPremiumDesign ? 'border-white/50' : 'border-border/50'}`}>
          <Avatar className="h-9 w-9 rounded-none">
            <AvatarFallback className={`font-semibold rounded-none ${isPremiumDesign ? 'bg-white/10 text-white' : 'bg-primary/10 text-primary'}`}>
              {userRole[0]}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-none shadow-xl border-border" align="end">
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
    <header className={`${isPremiumDesign ? 'absolute top-0 w-full z-50 bg-transparent border-none' : 'sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl'}`}>
      <div className={`mx-auto flex h-24 max-w-[1400px] items-center justify-between px-6 lg:px-12 xl:px-24 ${isPremiumDesign ? 'border-b border-white/20' : ''}`}>
        <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
          <div className={`flex items-center justify-center ${isPremiumDesign ? 'text-white' : 'text-primary transition-transform group-hover:scale-105'}`}>
            <Scale className="h-7 w-7" />
          </div>
          <span className={`text-xl font-medium tracking-tight ${isPremiumDesign ? 'text-white' : 'text-foreground'}`}>
            LawFinder<span className={isPremiumDesign ? "opacity-70" : "text-muted-foreground font-normal"}>.</span>
          </span>
        </Link>

        {/* Desktop Nav - Centered */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-10">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 text-[15px] transition-colors ${
                isPremiumDesign 
                  ? 'text-white/80 hover:text-white font-light'
                  : isActive(link.href)
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Right Action */}
        <div className="hidden md:block">
          {renderAuthAction(false)}
        </div>

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
                  {link.icon && <link.icon className="h-4 w-4" />}
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
