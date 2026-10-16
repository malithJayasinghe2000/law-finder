'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Home, UserCircle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import AttorneyPhoto from '@/components/lawyer/AttorneyPhoto';

interface DashboardUserMenuProps {
  locale: string;
  fullName: string | null;
  profileImageUrl: string | null;
  role: string;
  /** The role in words, for display ("Attorney", not "LAWYER"). */
  roleLabel?: string;
}

export default function DashboardUserMenu({ locale, fullName, profileImageUrl, role, roleLabel }: DashboardUserMenuProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        toast.success("Logged out successfully");
        window.location.href = `/${locale}`;
      } else {
        toast.error('Failed to logout');
      }
    } catch {
      toast.error('Failed to logout');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative flex items-center justify-center h-10 w-10 rounded-full shadow-sm outline-none hover:ring-2 hover:ring-primary/20 transition-all border border-border/50 cursor-pointer overflow-hidden">
        <Avatar className="h-10 w-10 rounded-full overflow-hidden border">
          {/* Their photo or their initials; never a stock figure. */}
          <AttorneyPhoto src={profileImageUrl} name={fullName || 'Account'} className="h-full w-full" />
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 rounded-2xl shadow-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-md p-1.5" align="end" sideOffset={8}>
        <div className="px-4 py-3 border-b border-neutral-100">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold text-neutral-900 leading-none">{fullName || 'Account'}</p>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{roleLabel ?? role}</p>
          </div>
        </div>

        <div className="py-1 space-y-0.5">
          <Link href={`/${locale}/dashboard/profile`}>
            <DropdownMenuItem className="cursor-pointer font-medium py-2.5 px-4 rounded-xl text-neutral-700 focus:bg-neutral-50 focus:text-neutral-900 group transition-all duration-200">
              <UserCircle className="mr-3.5 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> 
              <span>Profile Settings</span>
            </DropdownMenuItem>
          </Link>

          <Link href={`/${locale}`}>
            <DropdownMenuItem className="cursor-pointer font-medium py-2.5 px-4 rounded-xl text-neutral-700 focus:bg-neutral-50 focus:text-neutral-900 group transition-all duration-200">
              <Home className="mr-3.5 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> 
              <span>Home Page</span>
            </DropdownMenuItem>
          </Link>


          {role === 'CLIENT' && (
            <Link href={`/${locale}/messages`}>
              <DropdownMenuItem className="cursor-pointer font-medium py-2.5 px-4 rounded-xl text-neutral-700 focus:bg-neutral-50 focus:text-neutral-900 group transition-all duration-200">
                <MessageCircle className="mr-3.5 h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" /> 
                <span>Messages</span>
              </DropdownMenuItem>
            </Link>
          )}

          <DropdownMenuSeparator className="my-1.5 border-neutral-100" />

          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer font-semibold py-2.5 px-4 rounded-xl group transition-all duration-200">
            <LogOut className="mr-3.5 h-4 w-4 text-red-500/60 group-hover:text-red-600 transition-colors" /> 
            <span>Log out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
