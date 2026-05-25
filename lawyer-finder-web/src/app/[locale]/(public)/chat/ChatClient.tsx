'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, Bot, Loader2, Paperclip, Plus, Trash2, Edit3, Check, X, MessageSquare, BookOpen, Globe, Star, ArrowRight, PanelLeftClose, PanelLeft, LogIn } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

// ─── Types ─────────────────────────────────────────────────────────────
interface Source {
  document_name: string;
  document_type: string;
  section: string;
  part: string;
  chapter: string;
  status: string;
  last_updated_year: number | string;
  relevance_score: number;
  chunk_preview: string;
}

interface WebSource {
  title: string;
  url: string;
  snippet: string;
}

interface LawyerSuggestion {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  practiceAreas: string[];
  district: string | null;
  averageRating: number;
  reviewCount: number;
  subscriptionTier: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  webSources?: WebSource[];
  lawyerSuggestions?: LawyerSuggestion[];
}

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || 'http://localhost:5000';
const GUEST_QUERY_LIMIT = 5;

// ─── Component ─────────────────────────────────────────────────────────
export default function ChatClient({
  locale,
  initialQuery,
  isAuthenticated,
  conversationId: initialConversationId,
}: {
  locale: string;
  initialQuery: string;
  isAuthenticated: boolean;
  conversationId?: string;
}) {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [guestQueryCount, setGuestQueryCount] = useState(0);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialQuerySent = useRef(false);

  // ─── Load guest query count from localStorage ──────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem('guestQueryCount');
      if (stored) setGuestQueryCount(parseInt(stored, 10));
    }
  }, [isAuthenticated]);

  // ─── Load conversations list (authenticated users) ─────────────────
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/ai-chat/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ─── Load conversation messages ────────────────────────────────────
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ai-chat/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources || undefined,
          lawyerSuggestions: m.lawyerSuggestions || undefined,
        }));
        setMessages(loadedMessages);
        setActiveConversationId(id);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  }, []);

  // ─── Load initial conversation or show welcome ─────────────────────
  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId);
    } else if (!initialQuery) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: 'Hello! I am **LawyerAI**, your personal legal assistant powered by Sri Lankan legislation and web search.\n\nI can help you understand legal provisions from the **Civil Procedure Code**, **Companies Act**, **Motor Traffic Act**, and more.\n\nHow can I help you today?',
      }]);
    }
  }, [initialConversationId, loadConversation, initialQuery]);

  // ─── Handle initial query from homepage search ─────────────────────
  useEffect(() => {
    if (initialQuery && !initialQuerySent.current) {
      initialQuerySent.current = true;
      handleSend(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // ─── Auto-scroll ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ─── Toggle sources ────────────────────────────────────────────────
  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      next.has(messageId) ? next.delete(messageId) : next.add(messageId);
      return next;
    });
  };

  // ─── Create new conversation ───────────────────────────────────────
  const handleNewChat = () => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: 'Hello! I am **LawyerAI**, your personal legal assistant powered by Sri Lankan legislation and web search.\n\nHow can I help you today?',
    }]);
    setActiveConversationId(null);
    setExpandedSources(new Set());
    window.history.replaceState(null, '', `/${locale}/chat`);
  };

  // ─── Delete conversation ───────────────────────────────────────────
  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/ai-chat/conversations/${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) handleNewChat();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // ─── Rename conversation ───────────────────────────────────────────
  const handleRename = async (id: string) => {
    if (!editTitle.trim()) return;
    try {
      await fetch(`/api/ai-chat/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editTitle } : c));
      setEditingId(null);
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  };

  // ─── Fetch lawyer suggestions ──────────────────────────────────────
  const fetchLawyerSuggestions = async (practiceAreas: string[]): Promise<LawyerSuggestion[]> => {
    if (!practiceAreas || practiceAreas.length === 0) return [];
    try {
      const res = await fetch('/api/ai-chat/suggest-lawyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceAreas }),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.error('Failed to fetch lawyer suggestions:', err);
    }
    return [];
  };

  // ─── Send message ──────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Guest limit check
    if (!isAuthenticated) {
      const currentCount = guestQueryCount + 1;
      if (currentCount > GUEST_QUERY_LIMIT) {
        setShowLoginPrompt(true);
        return;
      }
      setGuestQueryCount(currentCount);
      localStorage.setItem('guestQueryCount', currentCount.toString());
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Call RAG API
      const response = await fetch(`${RAG_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      // Fetch lawyer suggestions based on detected practice areas
      let lawyerSuggestions: LawyerSuggestion[] = [];
      if (data.detected_practice_areas && data.detected_practice_areas.length > 0) {
        lawyerSuggestions = await fetchLawyerSuggestions(data.detected_practice_areas);
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
        webSources: data.web_sources || [],
        lawyerSuggestions,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Save to DB if authenticated
      if (isAuthenticated) {
        let convId = activeConversationId;

        // Create conversation if none exists
        if (!convId) {
          const createRes = await fetch('/api/ai-chat/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: text.slice(0, 80) }),
          });
          if (createRes.ok) {
            const conv = await createRes.json();
            convId = conv.id;
            setActiveConversationId(convId);
            window.history.replaceState(null, '', `/${locale}/chat?id=${convId}`);
          }
        }

        // Save messages
        if (convId) {
          await fetch(`/api/ai-chat/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userMessage: text,
              assistantMessage: data.answer,
              sources: data.sources || [],
              lawyerSuggestions,
            }),
          });
          loadConversations();
        }
      }
    } catch (error) {
      console.error('RAG API Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting to the legal database right now. Please try again in a moment, or consult a qualified lawyer for immediate assistance.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-96px)] overflow-hidden bg-[#fcfcfc] font-sans">
      {/* ─── Sidebar ────────────────────────────────────────── */}
      {isAuthenticated && (
        <aside
          className={`${sidebarOpen ? 'w-72' : 'w-0'} shrink-0 transition-all duration-300 overflow-hidden border-r border-neutral-200 bg-[#f5f5f5] flex flex-col`}
        >
          {/* New Chat button */}
          <div className="p-4 border-b border-neutral-100">
            <button
              onClick={handleNewChat}
              className="flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold uppercase tracking-widest bg-[#0a0d14] text-white rounded-full hover:bg-neutral-800 transition-colors"
            >
              <Plus className="h-4 w-4" /> New Chat
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center text-xs text-neutral-400 font-bold uppercase tracking-widest mt-8 px-4">
                No conversations yet
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all text-sm rounded-2xl ${
                    activeConversationId === conv.id
                      ? 'bg-white border border-[#ffb84f]/20 shadow-[0_4px_12px_rgb(0,0,0,0.03)] font-medium text-[#0a0d14]'
                      : 'hover:bg-white text-neutral-500 hover:text-[#0a0d14]'
                  }`}
                  onClick={() => loadConversation(conv.id)}
                >
                  <MessageSquare className={`h-4 w-4 shrink-0 ${activeConversationId === conv.id ? 'text-[#ffb84f]' : 'text-neutral-400 group-hover:text-[#ffb84f]/70'}`} />

                  {editingId === conv.id ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm border-b border-black min-w-0"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(conv.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id); }} className="p-0.5 text-green-600 hover:text-green-800">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="p-0.5 text-neutral-400 hover:text-neutral-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{conv.title}</span>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title); }}
                          className="p-1 text-neutral-400 hover:text-black transition-colors"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                          className="p-1 text-neutral-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Guest remaining queries */}
          <div className="p-3 border-t border-neutral-200 text-center">
            <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
              AI Legal Assistant
            </span>
          </div>
        </aside>
      )}

      {/* ─── Main Chat Area ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#fafafa]">
        {/* Chat header bar */}
        <div className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-neutral-100 bg-white">
          {isAuthenticated && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-neutral-400 hover:text-[#0a0d14] bg-neutral-50 rounded-full transition-colors"
            >
              {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#0a0d14] text-[#ffb84f] rounded-full shadow-[0_4px_12px_rgb(0,0,0,0.05)]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#0a0d14] leading-none mb-1">LawyerAI</h2>
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest leading-none">Online • Web Enabled</p>
            </div>
          </div>
          {!isAuthenticated && (
            <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500 bg-neutral-50 pr-2 pl-4 py-1.5 rounded-full border border-neutral-100">
              <span className="font-medium text-[#0a0d14]">{Math.max(0, GUEST_QUERY_LIMIT - guestQueryCount)}</span>
              <span className="text-neutral-400 font-bold uppercase tracking-widest text-[9px]">queries left</span>
              <Link
                href={`/${locale}/login`}
                className="ml-2 flex items-center gap-1.5 px-4 py-2 bg-[#0a0d14] text-white text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-neutral-800 transition-colors"
              >
                <LogIn className="h-3 w-3" /> Login
              </Link>
            </div>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="mx-auto max-w-4xl space-y-8">
            {messages.length <= 1 && !initialQuery && (
              <div className="text-center mt-12 mb-8">
                <div className="inline-flex h-20 w-20 items-center justify-center bg-white border border-neutral-100 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-[#ffb84f] mb-6">
                  <Bot className="h-10 w-10" />
                </div>
                <h1 className="text-3xl font-medium tracking-tight text-[#0a0d14] mb-3">Hi, I&apos;m Your Personal Lawyer</h1>
                <p className="text-neutral-500 font-light text-lg">Ask me any legal question regarding Sri Lankan law.</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center shadow-sm z-10 ${
                    message.role === 'user' ? 'bg-[#ffb84f] text-[#0a0d14] rounded-full' : 'bg-[#0a0d14] text-[#ffb84f] rounded-full'
                  }`}>
                    {message.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                  </div>

                  {/* Bubble + Sources + Lawyers */}
                  <div className="flex flex-col gap-3 min-w-0 mt-1">
                    <div
                      className={`relative flex flex-col p-6 shadow-[0_4px_20px_rgb(0,0,0,0.02)] ${
                        message.role === 'user'
                          ? 'bg-[#0a0d14] text-white rounded-3xl rounded-tr-sm'
                          : 'bg-white text-[#0a0d14] border border-neutral-100 rounded-3xl rounded-tl-sm'
                      }`}
                    >
                      <div className="prose-h-none text-sm leading-relaxed text-left font-light markdown-content">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Source Citations */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => toggleSources(message.id)}
                          className="flex items-center gap-2 text-[11px] font-bold text-neutral-500 hover:text-black uppercase tracking-widest transition-colors self-start"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          {expandedSources.has(message.id) ? 'Hide' : 'View'} {message.sources.length} Legal Sources
                        </button>

                        {expandedSources.has(message.id) && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            {message.sources.map((src, idx) => (
                              <div key={idx} className="flex flex-col gap-0.5 bg-neutral-50 border border-neutral-200 p-3 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-black">{src.document_name}</span>
                                  <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest ${
                                    src.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>{src.status}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-[10px] text-neutral-500 mt-0.5">
                                  <span>{src.section}</span>
                                  {src.part !== 'N/A' && src.part !== 'Unknown' && <span>• {src.part}</span>}
                                  <span>• {src.document_type}</span>
                                  <span>• Relevance: {(src.relevance_score * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Web Sources */}
                    {message.webSources && message.webSources.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => toggleSources(`web-${message.id}`)}
                          className="flex items-center gap-2 text-[11px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-widest transition-colors self-start"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          {expandedSources.has(`web-${message.id}`) ? 'Hide' : 'View'} {message.webSources.length} Web Sources
                        </button>

                        {expandedSources.has(`web-${message.id}`) && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            {message.webSources.map((ws, idx) => (
                              <a
                                key={idx}
                                href={ws.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col gap-0.5 bg-blue-50/50 border border-blue-100 p-3 text-xs hover:bg-blue-50 transition-colors"
                              >
                                <span className="font-bold text-blue-800">{ws.title}</span>
                                <span className="text-blue-600/70 text-[10px] truncate">{ws.url}</span>
                                <span className="text-neutral-600 mt-0.5 line-clamp-2">{ws.snippet}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Lawyer Suggestions */}
                    {message.lawyerSuggestions && message.lawyerSuggestions.length > 0 && (
                      <div className="mt-4 border border-neutral-100 bg-white rounded-3xl overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                        <div className="px-6 py-4 bg-[#fafafa] border-b border-neutral-100">
                          <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#0a0d14] flex items-center gap-2">
                            <Star className="h-3 w-3 text-[#ffb84f] fill-[#ffb84f]" /> Recommended Lawyers
                          </h4>
                        </div>
                        <div className="divide-y divide-neutral-100">
                          {message.lawyerSuggestions.map((lawyer) => (
                            <div key={lawyer.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#fafafa] transition-colors">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
                                {lawyer.profileImageUrl ? (
                                  <img src={lawyer.profileImageUrl} alt={lawyer.fullName} className="h-full w-full object-cover" />
                                ) : (
                                  <User className="h-5 w-5 text-neutral-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-[#0a0d14] truncate">{lawyer.fullName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {lawyer.averageRating > 0 && (
                                    <span className="flex items-center gap-1 text-[11px] text-[#0a0d14] font-bold">
                                      <Star className="h-3 w-3 fill-[#ffb84f] text-[#ffb84f]" />
                                      {lawyer.averageRating}
                                    </span>
                                  )}
                                  {lawyer.district && (
                                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">{lawyer.district}</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {lawyer.practiceAreas.slice(0, 3).map((area, i) => (
                                    <span key={i} className="text-[9px] bg-white border border-neutral-200 text-neutral-600 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                                      {area}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <Link
                                href={`/${locale}/lawyers/${lawyer.id}`}
                                className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#ffb84f] text-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-[#e5a443] transition-colors hover:scale-105"
                              >
                                Profile <ArrowRight className="h-3 w-3" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="flex max-w-[80%] gap-4 flex-row">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#0a0d14] text-[#ffb84f] rounded-full shadow-sm z-10">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-3 p-5 bg-white border border-neutral-100 rounded-3xl rounded-tl-sm shadow-[0_4px_20px_rgb(0,0,0,0.02)] mt-1">
                    <Loader2 className="h-5 w-5 animate-spin text-[#ffb84f]" />
                    <span className="text-sm text-neutral-500 font-light">Searching legal database & web...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Login prompt overlay */}
        {showLoginPrompt && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0d14]/80 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md p-10 rounded-3xl shadow-2xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#ffb84f] to-[#e5a443]" />
              <button 
                onClick={() => setShowLoginPrompt(false)}
                className="absolute right-6 top-6 text-neutral-400 hover:text-[#0a0d14] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex h-20 w-20 items-center justify-center bg-[#ffb84f]/10 text-[#ffb84f] rounded-full mx-auto mb-6">
                <LogIn className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-[#0a0d14] mb-3">Free Limit Reached</h3>
              <p className="text-neutral-500 font-light text-base mb-8">
                You&apos;ve used all {GUEST_QUERY_LIMIT} free queries. Sign in to continue chatting with unlimited access and save your conversations.
              </p>
              <div className="flex flex-col gap-4">
                <Link
                  href={`/${locale}/login`}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-[#ffb84f] text-black rounded-full font-bold text-sm uppercase tracking-widest hover:bg-[#e5a443] transition-colors"
                >
                  <LogIn className="h-4 w-4" /> Sign In
                </Link>
                <Link
                  href={`/${locale}/register`}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-white border border-neutral-200 text-[#0a0d14] rounded-full font-bold text-sm hover:bg-neutral-50 transition-colors"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="shrink-0 bg-white border-t border-neutral-100 p-6 shadow-[0_-10px_40px_rgb(0,0,0,0.02)]">
          <div className="mx-auto max-w-4xl">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
              className="flex items-end gap-3 bg-[#fafafa] border border-neutral-200 p-2 rounded-3xl shadow-inner focus-within:border-[#ffb84f] focus-within:ring-4 focus-within:ring-[#ffb84f]/10 transition-all"
            >
              <button type="button" className="p-3 text-neutral-400 hover:text-[#ffb84f] transition-colors shrink-0 rounded-full hover:bg-white ml-1">
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="Ask about Sri Lankan law..."
                className="max-h-32 min-h-[52px] w-full resize-none bg-transparent py-3.5 text-base outline-none placeholder:text-neutral-400 font-light text-[#0a0d14]"
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-4 bg-[#0a0d14] text-white rounded-full hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#ffb84f]" /> : <Send className="h-5 w-5 text-[#ffb84f]" />}
              </button>
            </form>
            <div className="mt-4 text-center text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Powered by Sri Lankan Legal Database & Web Search
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
