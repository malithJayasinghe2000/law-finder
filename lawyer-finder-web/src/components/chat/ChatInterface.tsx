'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Lock, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface UserData {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  role: string;
}

interface Conversation {
  id: string;
  isDummy: boolean;
  otherUser: UserData;
  lastMessage: { content: string, createdAt: string } | null;
  unreadCount: number;
  updatedAt: string;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export default function ChatInterface({ userId, locale }: { userId: string; locale: string }) {
  const socket = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLimited, setIsLimited] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get('conv');

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (socket && userId) {
      socket.emit('join_user', userId);

      socket.on('new_message', (message: Message & { conversationId: string }) => {
        if (message.conversationId === activeConvId) {
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          markAsRead(activeConvId);
        }
        // Always refresh conversations to update sidebar previews and sorting
        fetchConversations();
      });

      socket.on('unread_update', () => {
        fetchConversations();
      });

      return () => {
        socket.off('new_message');
        socket.off('unread_update');
      };
    }
  }, [socket, userId, activeConvId]);

  useEffect(() => {
    if (socket && activeConvId) {
      socket.emit('join_conversation', activeConvId);
      return () => {
        socket.emit('leave_conversation', activeConvId);
      };
    }
  }, [socket, activeConvId]);

  const fetchConversations = async () => {
    const res = await fetch('/api/chat/conversations');
    if (res.ok) {
      const data = await res.json();
      const loadedConversations = data.conversations || [];
      setConversations(loadedConversations);
      setIsLimited(data.isLimited || false);
      
      if (initialConvId && !activeConvId) {
        const targetConv = loadedConversations.find((c: Conversation) => c.id === initialConvId);
        if (targetConv && !targetConv.isDummy) {
          selectConversation(targetConv);
        }
      }
    }
  };

  const fetchMessages = async (convId: string) => {
    const res = await fetch(`/api/chat/conversations/${convId}/messages`);
    if (res.ok) {
      setMessages(await res.json());
      messagesEndRef.current?.scrollIntoView();
    }
  };

  const markAsRead = async (convId: string) => {
    await fetch(`/api/chat/conversations/${convId}/read`, { method: 'PATCH' });
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
    if (socket && userId) {
      socket.emit('mark_read', { userId });
    }
  };

  // Helper function for the initial load auto-select bypasses state dependency race
  const selectConversationId = (convId: string, unreadCount: number) => {
    if (activeConvId && socket) {
      socket.emit('leave_conversation', activeConvId);
    }
    
    setActiveConvId(convId);
    
    fetchMessages(convId);
    if (unreadCount > 0) markAsRead(convId);
  };

  const selectConversation = (conv: Conversation) => {
    if (conv.isDummy) return;
    selectConversationId(conv.id, conv.unreadCount);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConvId) return;

    const tempInput = input;
    setInput('');

    const res = await fetch(`/api/chat/conversations/${activeConvId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: tempInput }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      const sentMsg = await res.json();
      if (socket) {
        // Optimistic append is fine, but since we emit from backend/frontend?
        // Actually the backend API doesn't emit, we emit from frontend!
        socket.emit('send_message', sentMsg);
        setMessages(prev => [...prev, sentMsg]);
      }
      messagesEndRef.current?.scrollIntoView();
      fetchConversations(); // update last message
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages]);

  const activeConv = conversations.find(c => c.id === activeConvId);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white border border-neutral-200 overflow-hidden rounded-none shadow-sm">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-neutral-200 flex flex-col bg-neutral-50/50">
        <div className="p-4 border-b border-neutral-200 bg-white">
          <h2 className="text-lg font-bold tracking-tight">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 p-4 text-center">
              <MessageCircle className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`p-4 border-b border-neutral-100 flex items-center gap-3 transition-colors ${!conv.isDummy ? 'cursor-pointer hover:bg-neutral-100' : ''} ${activeConvId === conv.id ? 'bg-neutral-100' : ''} ${conv.isDummy ? 'opacity-80 select-none' : ''}`}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10 border rounded-full overflow-hidden">
                    {conv.otherUser?.profileImageUrl && !conv.isDummy ? (
                      <img src={conv.otherUser.profileImageUrl} alt="Profile" className="object-cover" />
                    ) : (
                      <img src="/avatar.png" alt="Profile" className="object-cover" />
                    )}
                  </Avatar>
                  {conv.unreadCount > 0 && !conv.isDummy && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <div className={`flex-1 min-w-0 ${conv.isDummy ? 'blur-[3px]' : ''}`}>
                  <p className="text-[14px] font-bold text-neutral-900 truncate">
                    {conv.otherUser?.fullName || 'User'}
                  </p>
                  <p className="text-[12px] text-neutral-500 truncate mt-0.5">
                    {conv.lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
                {conv.isDummy && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center right-4 left-auto">
                    <Lock className="w-4 h-4 text-neutral-500 drop-shadow-sm" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        {isLimited && (
          <div className="p-4 bg-amber-50 border-t border-amber-100 text-center">
            <p className="text-xs text-amber-800 font-medium mb-2">Upgrade to view all conversations</p>
            <Link href={`/${locale}/pricing`}>
              <Button size="sm" className="w-full text-xs font-bold rounded-none bg-[#0a0a0a] text-white hover:bg-neutral-800">
                Upgrade Plan
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {activeConvId ? (
          <>
            <div className="h-16 border-b border-neutral-200 flex items-center px-6 bg-white shrink-0">
              <Avatar className="h-9 w-9 border rounded-full mr-3">
                {activeConv?.otherUser?.profileImageUrl ? (
                    <img src={activeConv.otherUser.profileImageUrl} alt="Profile" className="object-cover" />
                  ) : (
                    <img src="/avatar.png" alt="Profile" className="object-cover" />
                )}
              </Avatar>
              <h3 className="font-bold text-[15px]">{activeConv?.otherUser?.fullName || 'User'}</h3>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-neutral-50/30">
              <div className="space-y-4">
                {messages.map(msg => {
                  const isMe = msg.senderId === userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2.5 shadow-sm text-[14px] ${
                        isMe ? 'bg-[#0a0a0a] text-white rounded-l-xl rounded-tr-xl' : 'bg-white border border-neutral-200 text-neutral-900 rounded-r-xl rounded-tl-xl'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-white shrink-0">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="rounded-none border-neutral-300 focus-visible:ring-1 focus-visible:ring-neutral-900"
                />
                <Button type="submit" className="rounded-none bg-[#0a0a0a] hover:bg-neutral-800 text-white px-6">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 bg-neutral-50/50">
            <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-neutral-300" />
            </div>
            <p className="text-[15px] font-medium text-neutral-500">Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
