'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Send, Lock, MessageCircle, Search, ArrowLeft } from 'lucide-react';
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
  const [searchFilter, setSearchFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastConvIdRef = useRef<string | null>(null);
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
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 50);
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
      
      if (initialConvId && !activeConvId) {
        const targetConv = loadedConversations.find((c: Conversation) => c.id === initialConvId);
        if (targetConv) {
          selectConversation(targetConv);
        }
      }
    }
  };

  const fetchMessages = async (convId: string) => {
    const res = await fetch(`/api/chat/conversations/${convId}/messages`);
    if (res.ok) {
      setMessages(await res.json());
      // Explicitly set the active conversation ref to skip general auto-scroll
      lastConvIdRef.current = convId;
    }
  };

  const markAsRead = async (convId: string) => {
    await fetch(`/api/chat/conversations/${convId}/read`, { method: 'PATCH' });
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
    if (socket && userId) {
      socket.emit('mark_read', { userId });
    }
  };

  const selectConversationId = (convId: string, unreadCount: number) => {
    if (activeConvId && socket) {
      socket.emit('leave_conversation', activeConvId);
    }
    
    setActiveConvId(convId);
    fetchMessages(convId);
    if (unreadCount > 0) markAsRead(convId);
  };

  // Phones show the list or one conversation, not both; this goes back to the list.
  const closeConversation = () => {
    if (activeConvId && socket) socket.emit('leave_conversation', activeConvId);
    setActiveConvId(null);
  };

  const selectConversation = (conv: Conversation) => {
    selectConversationId(conv.id, conv.unreadCount);
  };

  const handleSendMessage = async () => {
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
        socket.emit('send_message', sentMsg);
        setMessages(prev => [...prev, sentMsg]);
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      fetchConversations();
    }
  };

  useEffect(() => {
    // Only auto scroll for active conversation updates when conversations IDs match
    if (activeConvId !== lastConvIdRef.current) {
      lastConvIdRef.current = activeConvId;
      return;
    }
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, activeConvId]);

  const activeConv = conversations.find(c => c.id === activeConvId);

  // Filter conversations
  const filteredConversations = conversations.filter(c =>
    c.otherUser?.fullName?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex bg-[#faf8f6] border border-[#efeae0] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.025)] font-sans relative selection:bg-[#bfa37a]/30">
      {/* Sidebar - Sticky layout */}
      {/* Side by side from md up. On a phone the list and the open conversation
          take turns — side by side, the conversation was cut off at the edge. */}
      <aside className={`${activeConvId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 shrink-0 bg-[#fbf9f6] md:border-r border-[#efeae0] sticky top-24 h-[calc(100vh-10rem)] min-h-[500px] flex-col rounded-2xl md:rounded-r-none`}>
        {/* Sidebar Header */}
        <div className="px-5 py-4.5 flex items-center justify-between border-b border-[#efeae0] bg-[#fbf9f6] shrink-0 rounded-tl-2xl">
          <h2 className="text-xs font-bold text-neutral-800 uppercase tracking-widest font-serif">Messages</h2>
          <div className="relative flex items-center bg-neutral-100 px-2 py-1 border border-[#efeae0]">
            <Search className="h-3 w-3 text-neutral-450 mr-1" />
            <input
              type="text"
              placeholder="Search..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-transparent text-[10px] outline-none text-neutral-800 font-light w-20"
            />
          </div>
        </div>

        {/* Sidebar Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 p-6 text-center">
              <MessageCircle className="w-10 h-10 mb-3 opacity-20 text-[#bfa37a]" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">No conversations yet</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`group flex items-center gap-3 p-3 cursor-pointer transition-all duration-200 border rounded-xl ${
                  activeConvId === conv.id
                    ? 'bg-white border-[#efeae0] shadow-sm font-semibold text-neutral-900'
                    : 'bg-transparent border-transparent hover:bg-white/50 text-neutral-500 hover:text-neutral-850'
                }`}
              >
                <div className="relative">
                  <Avatar className="h-9 w-9 border border-[#efeae0] rounded-full overflow-hidden shrink-0">
                    {conv.otherUser?.profileImageUrl ? (
                      <img src={conv.otherUser.profileImageUrl} alt="Profile" className="object-cover h-full w-full" />
                    ) : (
                      <img src="/avatar.png" alt="Profile" className="object-cover h-full w-full" />
                    )}
                  </Avatar>
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-white">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold font-serif text-neutral-900 truncate">
                      {conv.otherUser?.fullName || 'User'}
                    </p>
                    {conv.lastMessage && (
                      <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider shrink-0">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-450 truncate mt-0.5 font-light">
                    {conv.lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className={`${activeConvId ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col bg-[#faf8f6] rounded-2xl md:rounded-l-none min-h-[500px]`}>
        {activeConvId ? (
          <>
            {/* Sticky Chat Header */}
            <div className="sticky top-24 z-20 h-16 border-b border-[#efeae0] flex items-center justify-between px-4 md:px-6 bg-[#faf8f6]/95 backdrop-blur-sm shrink-0 rounded-t-2xl md:rounded-tl-none">
              <div className="flex items-center min-w-0">
                <button
                  type="button"
                  onClick={closeConversation}
                  className="md:hidden mr-2 p-1 -ml-1 text-neutral-600 hover:text-neutral-900"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar className="h-9 w-9 border border-[#efeae0] rounded-full mr-3 overflow-hidden shrink-0">
                  {activeConv?.otherUser?.profileImageUrl ? (
                    <img src={activeConv.otherUser.profileImageUrl} alt="Profile" className="object-cover h-full w-full" />
                  ) : (
                    <img src="/avatar.png" alt="Profile" className="object-cover h-full w-full" />
                  )}
                </Avatar>
                <div>
                  <h3 className="font-serif font-bold text-sm text-neutral-950 leading-tight">{activeConv?.otherUser?.fullName || 'User'}</h3>
                  <p className="text-[9px] text-[#bfa37a] font-bold uppercase tracking-wider mt-0.5">Secure Consultation</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-emerald-100 bg-emerald-50 text-emerald-700 rounded-full text-[8px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                </span>
              </div>
            </div>
            
            {/* Messages list - grows naturally supporting main page scroll */}
            <div className="flex-1 p-6 scroll-smooth space-y-6 pb-24">
              {messages.map(msg => {
                const isMe = msg.senderId === userId;
                return (
                  <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] min-w-[50px] flex flex-col gap-1">
                      <div className={`relative flex flex-col p-4.5 shadow-[0_4px_12px_rgba(0,0,0,0.015)] border text-sm leading-relaxed ${
                        isMe 
                          ? 'bg-[#161616] text-white border-[#161616] rounded-2xl rounded-tr-none' 
                          : 'bg-[#fdfbf7] border-[#efeae0] text-neutral-850 rounded-2xl rounded-tl-none'
                      }`}>
                        <p className="whitespace-pre-wrap text-left font-light leading-relaxed">{msg.content}</p>
                      </div>
                      <span className={`text-[8px] text-neutral-450 font-bold uppercase tracking-wider mt-1 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Sticky Card-like input area */}
            <div className="sticky bottom-0 z-10 shrink-0 bg-[#faf8f6]/95 backdrop-blur-sm border-t border-[#efeae0] py-4 px-6 rounded-br-2xl">
              <div className="mx-auto w-full">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="bg-white border border-[#efeae0] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col gap-3 transition-all focus-within:border-[#bfa37a]/60"
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message securely..."
                    className="w-full resize-none bg-transparent py-1 text-sm outline-none placeholder:text-neutral-400 text-neutral-850 font-light min-h-[50px] max-h-32 leading-relaxed"
                    rows={2}
                  />
                  
                  <div className="flex items-center justify-between border-t border-[#efeae0]/60 pt-3">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-neutral-400 uppercase tracking-[0.18em]">
                      <Lock className="h-3.5 w-3.5 text-[#bfa37a]" />
                      <span>Encrypted Session</span>
                    </div>

                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="flex items-center justify-center gap-1.5 px-5 py-2 bg-[#bfa37a] hover:bg-[#a68d67] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm shrink-0"
                    >
                      <Send className="h-3 w-3" />
                      <span>Send</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        ) : (
          /* Empty state matching RAG chat client look */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#faf8f6] rounded-r-2xl">
            <div className="space-y-4 max-w-md">
              <span className="text-[10px] text-[#bfa37a] uppercase tracking-[0.25em] font-bold">Secure Portal</span>
              <h2 className="text-3xl font-serif text-neutral-900 leading-tight">Your Secure Consultations</h2>
              <p className="text-neutral-500 text-sm font-light leading-relaxed">
                Connect with verified legal professionals. All messages and documents exchanged here are fully encrypted and confidential.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-[#efeae0] bg-white text-neutral-500 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm">
                  <Lock className="w-3.5 h-3.5 text-[#bfa37a]" /> End-To-End Secure
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
