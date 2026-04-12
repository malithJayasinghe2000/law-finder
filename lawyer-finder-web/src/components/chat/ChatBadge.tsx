'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { MessageCircle } from 'lucide-react';

export default function ChatBadge({ userId, isSidebar = false }: { userId?: string, isSidebar?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const socket = useSocket();

  const fetchCount = async () => {
    try {
      const res = await fetch('/api/chat/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchCount();
  }, []);

  useEffect(() => {
    if (socket && userId) {
      socket.emit('join_user', userId);
      socket.on('unread_update', fetchCount);
      socket.on('new_message', fetchCount);

      return () => {
        socket.off('unread_update', fetchCount);
        socket.off('new_message', fetchCount);
      };
    }
  }, [socket, userId]);

  if (isSidebar) {
    return unreadCount > 0 ? (
      <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
        {unreadCount}
      </span>
    ) : null;
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <MessageCircle className="w-5 h-5 shrink-0" />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
          {unreadCount}
        </span>
      )}
    </div>
  );
}
