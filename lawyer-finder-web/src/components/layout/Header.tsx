'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Scale, Menu, Search, BookOpen, LogOut, FileText, UserCircle, LayoutDashboard, Zap, CheckCircle2, MessageCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar } from '@/components/ui/avatar';
import AttorneyPhoto from '@/components/lawyer/AttorneyPhoto';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import ChatBadge from '@/components/chat/ChatBadge';
import { useDirectoryEnabled } from '@/components/directory/DirectoryProvider';
import { LICENSING_ENABLED } from '@/lib/licensing';

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
  const directoryEnabled = useDirectoryEnabled();
  const isPremiumDesign = pathname === `/${locale}` || pathname === '/';

  if (pathname.includes('/dashboard')) {
    return null;
  }
  const navLinks = [
    // One entry, not two. /firms and /lawyers are two lenses on the same
    // population — every attorney belongs to a practice, and a sole
    // practitioner IS their practice — so listing both in the nav showed the
    // same people twice. The toggle on the page switches lens.
    // See docs/restructure/LEGAL-GUARDRAILS.md (rules 4 and 7).
    // Hidden while the public directory is switched off (src/lib/directory.ts).
    ...(directoryEnabled ? [{ href: `/${locale}/firms`, label: t('directory'), icon: Search }] : []),
    { href: `/${locale}/chat`, label: t('chat'), icon: MessageCircle },
    { href: `/${locale}/legal-library`, label: t('legalLibrary'), icon: BookOpen },
    { href: `/${locale}/blog`, label: t('blog'), icon: FileText },
    { href: `/${locale}/about`, label: t('about'), icon: Scale },
  ];

  // Licence pricing is hidden while licensing is off (src/lib/licensing.ts).
  if (LICENSING_ENABLED && (userRole === 'LAWYER' || userRole === 'ADMIN')) {
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
      if (isMobile) {
        return (
          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
            <Link href={`/${locale}/login`} onClick={() => setOpen(false)} className="w-full">
              <Button variant="outline" className="w-full gap-2 font-bold rounded-none border-[#0a0a0a] text-[#0a0a0a] hover:bg-neutral-50 py-5 text-xs uppercase tracking-widest">
                Sign In
              </Button>
            </Link>
            <Link href={`/${locale}/register`} onClick={() => setOpen(false)} className="w-full">
              <Button className="w-full gap-2 font-bold rounded-none bg-[#0a0a0a] text-white hover:bg-neutral-800 py-5 text-xs uppercase tracking-widest">
                Sign Up
              </Button>
            </Link>
          </div>
        );
      }
      if (isPremiumDesign) {
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
        <Link href={`/${locale}/login`} onClick={() => setOpen(false)} className="ml-4">
          <Button className="gap-2 font-medium rounded-none bg-[#0a0a0a] text-white px-7 hover:bg-neutral-800 transition-all hover:scale-105">
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
          {userRole === 'CLIENT' && (!appStatus || appStatus === 'REJECTED') && <Link href={`/${locale}/apply`}><Button className="w-full justify-start gap-2 text-white">Apply as an Attorney</Button></Link>}
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
            {/* Their photo or their initials; never a stock figure. */}
            <AttorneyPhoto src={userProfile?.profileImageUrl} name={userProfile?.fullName || 'Account'} className="h-full w-full" />
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 rounded-none shadow-2xl border-border p-0" align="end" sideOffset={8}>
          <div className="px-6 py-5 bg-neutral-50/50 border-b">
            <div className="flex flex-col space-y-2">
              <p className="text-[15px] font-bold text-neutral-900 leading-none">{userProfile?.fullName || 'Account'}</p>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.15em]">
                {userRole === 'LAWYER' ? 'Attorney' : userRole === 'ADMIN' ? 'Platform admin' : 'Client'}
              </p>
              {LICENSING_ENABLED && userRole === 'LAWYER' && subscriptionTier && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-200">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-900">{subscriptionTier}</p>
                    <p className="text-neutral-500">Active Subscription</p>
                  </div>
                </div>
              )}
              {/* {userRole === 'LAWYER' && !subscriptionTier && (
                <Link href={`/${locale}/pricing`} className="mt-2 pt-2 border-t border-neutral-200 block">
                  <p className="text-xs font-semibold text-amber-600 hover:text-amber-700">Upgrade your subscription</p>
                </Link>
              )} */}
            </div>
          </div>

          <div className="py-1">
            <Link href={`/${locale}/dashboard/profile`}>
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
                {/* <Link href={`/${locale}/profile`}>
                  <DropdownMenuItem className="cursor-pointer font-medium py-3 px-6 rounded-none focus:bg-neutral-50 group">
                    <Zap className="mr-3 h-4 w-4 text-amber-400 group-hover:text-amber-500 transition-colors" /> Subscription Plan
                  </DropdownMenuItem>
                </Link> */}
              </>
            )}

            {userRole === 'CLIENT' && (
              <>
                <Link href={`/${locale}/dashboard/client`}>
                  <DropdownMenuItem className="cursor-pointer font-medium py-3 px-6 rounded-none focus:bg-neutral-50 group">
                    <LayoutDashboard className="mr-3 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> My Dashboard
                  </DropdownMenuItem>
                </Link>
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
                      <Scale className="mr-3 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> Apply as an Attorney
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
      <div className={`mx-auto flex h-24 max-w-[1400px] items-center justify-between px-6 lg:px-12 xl:px-24 ${isPremiumDesign ? 'border-b border-neutral-100' : ''}`}>
        <Link href={`/${locale}`} className="flex items-center gap-2 group">
          <Image
            src="/logo.png"
            alt="TheLawyr Logo"
            width={160}
            height={55}
            className="h-14 w-auto object-contain transition-transform group-hover:scale-105"
            priority
          />
        </Link>

        {/* Desktop Nav - Centered */}
        <nav className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-10">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-bold uppercase tracking-widest transition-colors ${isPremiumDesign
                  ? 'text-neutral-600 hover:text-[#bfa37a]'
                  : isActive(link.href)
                    ? 'text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {renderNavLabel(link)}
            </Link>
          ))}
        </nav>

        {/* Desktop Right Action */}
        <div className="hidden lg:block">
          {userRole ? (
            renderAuthAction(false)
          ) : (
            <div className="flex items-center gap-6">
              {!(pathname === `/${locale}/login` || pathname === '/login') && (
                <Link href={`/${locale}/login`}>
                  <Button className="bg-[#1a1a1a] text-white hover:bg-neutral-800 rounded-none px-6 py-6 text-xs font-bold uppercase tracking-widest transition-all">
                    Sign In
                  </Button>
                </Link>
              )}
              {(pathname === `/${locale}/login` || pathname === '/login') && (
                <Link href={`/${locale}/register`}>
                  <Button className="bg-[#1a1a1a] text-white hover:bg-neutral-800 rounded-none px-6 py-6 text-xs font-bold uppercase tracking-widest transition-all">
                    Sign Up
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Mobile Nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5 text-neutral-800" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-[#fbf9f6] border-l border-[#efeae0] p-6 flex flex-col justify-between">
            <div className="flex flex-col flex-1">
              <SheetTitle className="flex items-center gap-2 px-1 mb-6">
                <Image
                  src="/logo.png"
                  alt="TheLawyr Logo"
                  width={110}
                  height={28}
                  className="h-7 w-auto object-contain"
                />
              </SheetTitle>
              <SheetDescription className="sr-only">Mobile navigation menu</SheetDescription>
              
              <nav className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                      isActive(link.href)
                        ? 'text-[#bfa37a]'
                        : 'text-neutral-600 hover:text-[#bfa37a]'
                    }`}
                  >
                    {/* Messages: ChatBadge draws its own icon, so the link's is not repeated. */}
                    {link.icon && !(link.href === `/${locale}/messages` && userId) && <link.icon className="h-4 w-4 text-[#bfa37a]" />}
                    <span>{renderNavLabel(link)}</span>
                  </Link>
                ))}

                {/* Divider */}
                <div className="my-4 border-t border-[#efeae0]" />

                {/* Account Actions / Auth */}
                {userRole ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1">Account Menu</p>
                    
                    <Link
                      href={`/${locale}/dashboard/profile`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-neutral-600 hover:text-[#bfa37a] py-1 transition-colors"
                    >
                      <UserCircle className="h-4 w-4 text-[#bfa37a]" />
                      <span>Profile Settings</span>
                    </Link>

                    {userRole === 'ADMIN' && (
                      <Link
                        href={`/${locale}/dashboard/admin`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#bfa37a] py-1 transition-colors font-semibold"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Admin Panel</span>
                      </Link>
                    )}

                    {userRole === 'LAWYER' && (
                      <Link
                        href={`/${locale}/dashboard/lawyer`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#bfa37a] py-1 transition-colors font-semibold"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Lawyer Dashboard</span>
                      </Link>
                    )}

                    {userRole === 'CLIENT' && (
                      <Link
                        href={`/${locale}/dashboard/client`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#bfa37a] py-1 transition-colors font-semibold"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>My Dashboard</span>
                      </Link>
                    )}

                    {userRole === 'CLIENT' && appStatus === 'DRAFT' && (
                      <Link
                        href={`/${locale}/apply`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-amber-600 py-1 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-amber-500" />
                        <span>Resume Application</span>
                      </Link>
                    )}

                    {userRole === 'CLIENT' && (appStatus === 'SUBMITTED' || appStatus === 'IN_REVIEW') && (
                      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-neutral-400 py-1 select-none">
                        <FileText className="h-4 w-4 text-neutral-400" />
                        <span>Application Pending</span>
                      </div>
                    )}

                    {userRole === 'CLIENT' && (!appStatus || appStatus === 'REJECTED') && (
                      <Link
                        href={`/${locale}/apply`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-neutral-600 hover:text-[#bfa37a] py-1 transition-colors"
                      >
                        <Scale className="h-4 w-4 text-[#bfa37a]" />
                        <span>Apply as an Attorney</span>
                      </Link>
                    )}

                    <button
                      onClick={() => { setOpen(false); handleLogout(); }}
                      className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-3 bg-[#efeae0]/40 border border-[#efeae0] text-red-600 text-xs font-bold uppercase tracking-widest hover:bg-red-50 hover:border-red-200 transition-all duration-300 rounded-none"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mt-4">
                    {!(pathname === `/${locale}/login` || pathname === '/login') && (
                      <Link href={`/${locale}/login`} onClick={() => setOpen(false)} className="w-full">
                        <button className="w-full py-3 bg-[#1a1a1a] text-white hover:bg-neutral-800 text-xs font-bold uppercase tracking-widest transition-colors rounded-none">
                          Sign In
                        </button>
                      </Link>
                    )}
                    {(pathname === `/${locale}/login` || pathname === '/login') && (
                      <Link href={`/${locale}/register`} onClick={() => setOpen(false)} className="w-full">
                        <button className="w-full py-3 bg-[#1a1a1a] text-white hover:bg-neutral-800 text-xs font-bold uppercase tracking-widest transition-colors rounded-none">
                          Sign Up
                        </button>
                      </Link>
                    )}
                  </div>
                )}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
