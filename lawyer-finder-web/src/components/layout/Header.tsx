'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Scale, Menu, Search, BookOpen, LogOut, FileText, UserCircle, LayoutDashboard, Zap, CheckCircle2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import ChatBadge from '@/components/chat/ChatBadge';

interface HeaderProps {
  locale: string;
  userRole?: string | null;
  appStatus?: string | null;
  userProfile?: { fullName: string | null; profileImageUrl: string | null } | null;
  subscriptionTier?: string | null;
  userId?: string | null;
}

export default function Header({ locale, userRole = null, appStatus = null, userProfile = null, subscriptionTier = null, userId = null }: HeaderProps) {
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
    { href: `/${locale}/about`, label: t('about'), icon: Scale },
  ];

  if (userRole === 'LAWYER' || userRole === 'ADMIN') {
    navLinks.push({ href: `/${locale}/pricing`, label: 'Pricing', icon: Scale });
  }

  if (userRole === 'CLIENT') {
    navLinks.push({ href: `/${locale}/messages`, label: 'Messages', icon: MessageCircle });
  }

  const renderNavLabel = (link: any) => {
    if (link.href === `/${locale}/messages` && userId) {
      return (
        <div className="flex items-center gap-2">
           <ChatBadge userId={userId} />
           <span>{link.label}</span>
        </div>
      );
    }
    return link.label;
  };

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
          {userRole === 'CLIENT' && (!appStatus || appStatus === 'REJECTED') && <Link href={`/${locale}/apply`}><Button className="w-full justify-start gap-2 text-white">Become a Lawyer</Button></Link>}
          <Button variant="destructive" className="w-full justify-start gap-2 mt-2" onClick={handleLogout}>
             <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      );
    }

    // Desktop Dropdown
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={`relative flex items-center justify-center h-10 w-10 rounded-full ml-4 shadow-sm outline-none hover:ring-2 hover:ring-primary/20 transition-all ${isPremiumDesign ? 'border-white/50' : 'border-border/50'}`}>
          <Avatar className="h-10 w-10 rounded-full overflow-hidden border">
            {userProfile?.profileImageUrl ? (
              <img src={userProfile.profileImageUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <img src='/avatar.png' alt="Profile" className="h-full w-full object-cover" />
            )}
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 rounded-none shadow-2xl border-border p-0" align="end" sideOffset={8}>
          <div className="px-6 py-5 bg-neutral-50/50 border-b">
            <div className="flex flex-col space-y-2">
              <p className="text-[15px] font-bold text-neutral-900 leading-none">{userProfile?.fullName || 'Account'}</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.15em]">{userRole}</p>
              {userRole === 'LAWYER' && subscriptionTier && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-200">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-900">{subscriptionTier}</p>
                    <p className="text-neutral-500">Active Subscription</p>
                  </div>
                </div>
              )}
              {userRole === 'LAWYER' && !subscriptionTier && (
                <Link href={`/${locale}/pricing`} className="mt-2 pt-2 border-t border-neutral-200 block">
                  <p className="text-xs font-semibold text-amber-600 hover:text-amber-700">Upgrade your subscription</p>
                </Link>
              )}
            </div>
          </div>
          
          <div className="py-1">
            <Link href={`/${locale}/profile`}>
              <DropdownMenuItem className="cursor-pointer font-medium py-3 px-6 rounded-none focus:bg-neutral-50 group">
                <UserCircle className="mr-3 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> Profile Settings
              </DropdownMenuItem>
            </Link>

            {userRole === 'ADMIN' && (
              <Link href={`/${locale}/dashboard/admin`}>
                <DropdownMenuItem className="cursor-pointer font-medium text-primary py-3 px-6 rounded-none focus:bg-primary/5 group">
                  <LayoutDashboard className="mr-3 h-4 w-4 text-primary/60 group-hover:text-primary transition-colors" /> Admin Panel
                </DropdownMenuItem>
              </Link>
            )}

            {userRole === 'LAWYER' && (
              <>
                <Link href={`/${locale}/dashboard/lawyer`}>
                  <DropdownMenuItem className="cursor-pointer font-medium py-3 px-6 rounded-none focus:bg-neutral-50 group">
                    <LayoutDashboard className="mr-3 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> My Dashboard
                  </DropdownMenuItem>
                </Link>
                <Link href={`/${locale}/profile`}>
                  <DropdownMenuItem className="cursor-pointer font-medium py-3 px-6 rounded-none focus:bg-neutral-50 group">
                    <Zap className="mr-3 h-4 w-4 text-amber-400 group-hover:text-amber-500 transition-colors" /> Subscription Plan
                  </DropdownMenuItem>
                </Link>
              </>
            )}

            {userRole === 'CLIENT' && (
              <>
                <Link href={`/${locale}/messages`}>
                  <DropdownMenuItem className="cursor-pointer font-medium py-3 px-6 rounded-none focus:bg-neutral-50 group">
                    <div className="flex items-center w-full">
                      <MessageCircle className="mr-3 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> 
                      <span>Messages</span>
                    </div>
                  </DropdownMenuItem>
                </Link>
                {appStatus === 'DRAFT' && (
                  <Link href={`/${locale}/apply`}>
                    <DropdownMenuItem className="cursor-pointer text-amber-600 focus:text-amber-700 font-medium py-3 px-6 rounded-none focus:bg-amber-50 group">
                      <FileText className="mr-3 h-4 w-4 text-amber-500/60 group-hover:text-amber-600 transition-colors" /> Resume Application
                    </DropdownMenuItem>
                  </Link>
                )}
                {(appStatus === 'SUBMITTED' || appStatus === 'IN_REVIEW') && (
                  <DropdownMenuItem disabled className="opacity-80 font-medium py-3 px-6">
                     <FileText className="mr-3 h-4 w-4 text-neutral-400" /> Application Pending
                  </DropdownMenuItem>
                )}
                {(!appStatus || appStatus === 'REJECTED') && (
                  <Link href={`/${locale}/apply`}>
                    <DropdownMenuItem className="cursor-pointer font-bold py-3 px-6 rounded-none focus:bg-neutral-50 group">
                      <Scale className="mr-3 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> Become a Lawyer
                    </DropdownMenuItem>
                  </Link>
                )}
              </>
            )}

            <DropdownMenuSeparator className="my-1" />
            
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer font-semibold py-3 px-6 rounded-none group">
              <LogOut className="mr-3 h-4 w-4 text-red-500/60 group-hover:text-red-600 transition-colors" /> Log out
            </DropdownMenuItem>
          </div>
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
              {renderNavLabel(link)}
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
