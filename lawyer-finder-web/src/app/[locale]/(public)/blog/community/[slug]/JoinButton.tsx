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
      router.push(`/${locale}/login`);
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
      variant={member ? 'outline' : 'default'}
      className="font-semibold min-w-[100px]"
    >
      {loading ? '...' : member ? 'Joined ✓' : 'Join'}
    </Button>
  );
}
