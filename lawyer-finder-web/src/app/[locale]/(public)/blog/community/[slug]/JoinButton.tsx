'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface JoinButtonProps {
  communityId: string;
  isMember: boolean;
  isLoggedIn: boolean;
  locale: string;
}

export default function JoinButton({ communityId, isMember, isLoggedIn, locale }: JoinButtonProps) {
  const [member, setMember] = useState(isMember);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${communityId}/join`, {
        method: member ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        setMember(!member);
        router.refresh();
      }
    } catch (error) {
      console.error('Failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className={`min-w-[100px] rounded-none px-6 py-5 text-xs font-bold uppercase tracking-widest transition-all ${
        member
          ? 'bg-transparent border border-[#bfa37a] text-[#bfa37a] hover:bg-[#bfa37a]/5'
          : 'bg-[#bfa37a] text-white hover:bg-[#a68d67]'
      }`}
    >
      {loading ? '...' : member ? 'Joined' : 'Join'}
    </Button>
  );
}
