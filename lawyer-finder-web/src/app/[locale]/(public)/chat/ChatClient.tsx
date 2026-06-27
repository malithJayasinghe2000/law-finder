'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, User, Bot, Loader2, Paperclip, Plus, Trash2, Edit3, Check, X, 
  MessageSquare, BookOpen, Globe, Star, ArrowRight, PanelLeftClose, PanelLeft, 
  LogIn, Search, Sparkles, Sliders, Share2, Filter, ChevronDown, Mic, Scale 
} from 'lucide-react';
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

const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || 'http://localhost:5001';
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

  // Redesign Layout States
  const [selectedSource, setSelectedSource] = useState('All Legal DB');
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset scroll on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ─── Load guest query count from localStorage ──────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem('guestQueryCount');
      if (stored) setGuestQueryCount(parseInt(stored, 10));
    }
  }, [isAuthenticated]);

  // ─── Load starred conversation IDs from localStorage ───────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('starred_chat_ids');
      if (stored) setStarredIds(JSON.parse(stored));
    }
  }, []);

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('starred_chat_ids', JSON.stringify(next));
      return next;
    });
  };

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

  // ─── Filter and Group Conversations ───────────────────────────────
  const getGroupedConversations = () => {
    const filtered = conversations.filter(c => 
      c.title.toLowerCase().includes(searchFilter.toLowerCase())
    );

    const todayList: ConversationSummary[] = [];
    const yesterdayList: ConversationSummary[] = [];
    const olderList: ConversationSummary[] = [];
    const savedList = filtered.filter(c => starredIds.includes(c.id));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filtered.forEach((c) => {
      if (starredIds.includes(c.id)) return;

      const date = new Date(c.updatedAt || c.createdAt);
      date.setHours(0, 0, 0, 0);

      if (date.getTime() === today.getTime()) {
        todayList.push(c);
      } else if (date.getTime() === yesterday.getTime()) {
        yesterdayList.push(c);
      } else {
        olderList.push(c);
      }
    });

    return { savedList, todayList, yesterdayList, olderList };
  };

  const { savedList, todayList, yesterdayList, olderList } = getGroupedConversations();

  // ─── Sidebar Item Render Helper ──────────────────────────────────
  const renderConvItem = (conv: ConversationSummary) => (
    <div
      key={conv.id}
      className={`group flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all text-xs border rounded-none ${
        activeConversationId === conv.id
          ? 'bg-white border-[#efeae0] shadow-sm font-semibold text-neutral-900'
          : 'bg-transparent border-transparent hover:bg-white/50 text-neutral-500 hover:text-neutral-850'
      }`}
      onClick={() => loadConversation(conv.id)}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-neutral-400 group-hover:text-[#bfa37a] transition-colors" />

      {editingId === conv.id ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 bg-transparent outline-none text-xs border-b border-neutral-900 min-w-0 font-medium"
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
          <span className="flex-1 truncate tracking-tight text-left">{conv.title}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => toggleStar(conv.id, e)}
              className="p-1 text-neutral-300 hover:text-amber-500 transition-colors"
            >
              <Star className={`h-3.5 w-3.5 ${starredIds.includes(conv.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title); }}
                className="p-0.5 text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                className="p-0.5 text-neutral-400 hover:text-red-650 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-12 xl:px-24 bg-[#faf8f6] min-h-[calc(100vh-96px)] flex flex-col">
      <div className="flex-1 flex border-x border-[#efeae0] bg-[#faf8f6] font-sans selection:bg-[#bfa37a]/30 relative">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && isAuthenticated && (
          <div 
            className="fixed inset-0 bg-black/20 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ─── Sidebar ────────────────────────────────────────── */}
        {isAuthenticated && (
          <aside
            className={`${sidebarOpen ? 'w-72 border-r' : 'w-0 border-r-0'} fixed md:sticky md:top-24 z-20 h-full md:h-[calc(100vh-96px)] inset-y-0 left-0 shrink-0 transition-all duration-300 overflow-hidden border-[#efeae0] bg-[#fbf9f6] flex flex-col`}
          >
            {/* Sidebar Header */}
            <div className="px-5 py-4.5 flex items-center justify-between border-b border-[#efeae0]">
              <h2 className="text-xs font-bold text-neutral-800 uppercase tracking-widest">Chat</h2>
              <div className="flex items-center gap-2">
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
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors" title="Collapse Sidebar">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

          {/* New Chat button */}
          <div className="p-4 border-b border-[#efeae0]">
            <button
              onClick={handleNewChat}
              className="flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest rounded-full bg-[#0a0f1d] text-white hover:bg-neutral-800 transition-all duration-300"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> New Chat
            </button>
          </div>

          {/* Grouped Conversation list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {conversations.length === 0 ? (
              <div className="text-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-10 px-4">
                No conversations yet
              </div>
            ) : (
              <>
                {/* Starred/Saved Group */}
                {savedList.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="px-3.5 text-[9px] font-bold text-neutral-400 uppercase tracking-[0.18em] flex items-center gap-1.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" /> Saved
                    </h3>
                    <div className="space-y-1">
                      {savedList.map(renderConvItem)}
                    </div>
                  </div>
                )}

                {/* Today Group */}
                {todayList.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="px-3.5 text-[9px] font-bold text-neutral-400 uppercase tracking-[0.18em]">
                      Today
                    </h3>
                    <div className="space-y-1">
                      {todayList.map(renderConvItem)}
                    </div>
                  </div>
                )}

                {/* Yesterday Group */}
                {yesterdayList.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="px-3.5 text-[9px] font-bold text-neutral-400 uppercase tracking-[0.18em]">
                      Yesterday
                    </h3>
                    <div className="space-y-1">
                      {yesterdayList.map(renderConvItem)}
                    </div>
                  </div>
                )}

                {/* Older Group */}
                {olderList.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="px-3.5 text-[9px] font-bold text-neutral-400 uppercase tracking-[0.18em]">
                      Previous Days
                    </h3>
                    <div className="space-y-1">
                      {olderList.map(renderConvItem)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer branding */}
          <div className="p-4 border-t border-[#efeae0] text-center bg-[#faf8f5]">
            <span className="text-[9px] text-[#bfa37a] uppercase tracking-[0.2em] font-bold">
              AI Legal Assistant
            </span>
          </div>
        </aside>
      )}

      {/* ─── Main Chat Area ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#faf8f6] relative">
        {/* Floating Sidebar Open Toggle (only shows when sidebar is closed) */}
        {!sidebarOpen && isAuthenticated && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-28 left-8 md:left-12 z-10 p-2.5 bg-white hover:bg-neutral-50 border border-[#efeae0] rounded-full text-neutral-500 hover:text-neutral-900 shadow-sm transition-all"
            title="Open Chat List"
          >
            <PanelLeft className="h-4.5 w-4.5" />
          </button>
        )}

        {/* Messages area */}
        <div className="flex-1 p-6 pb-36 scroll-smooth">
          <div className="mx-auto max-w-3xl space-y-8">
            {messages.length <= 1 && !initialQuery && (
              <div className="text-center py-16 space-y-3">
                <span className="text-[10px] text-[#bfa37a] uppercase tracking-[0.25em] font-bold">Consultation Portal</span>
                <h1 className="text-3xl sm:text-4xl font-serif text-neutral-900 leading-tight">Hi, I&apos;m Your Personal Lawyer</h1>
                <p className="text-neutral-500 text-sm max-w-md mx-auto font-light leading-relaxed">
                  Ask me any question regarding Sri Lankan law, contracts, or procedures to begin a case review.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[85%] min-w-0">
                  {/* Bubble + Sources + Lawyers */}
                  <div className="flex flex-col gap-3">
                    <div
                      className={`relative flex flex-col p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)] border ${
                        message.role === 'user'
                          ? 'bg-[#161616] text-white border-[#161616] rounded-2xl rounded-tr-none'
                          : 'bg-[#fdfbf7] text-neutral-800 border-[#efeae0] rounded-2xl rounded-tl-none'
                      }`}
                    >
                      <div className="prose-h-none text-sm leading-relaxed text-left font-light markdown-content text-balance">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-[#bfa37a]">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="mb-0.5">{children}</li>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Source Citations */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => toggleSources(message.id)}
                          className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 hover:text-[#bfa37a] uppercase tracking-widest transition-colors self-start"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          {expandedSources.has(message.id) ? 'Hide' : 'View'} {message.sources.length} Legal Sources
                        </button>

                        {expandedSources.has(message.id) && (
                          <div className="flex flex-col gap-2 mt-1">
                            {message.sources.map((src, idx) => (
                              <div key={idx} className="flex flex-col gap-1 bg-[#fdfbf7] border border-[#efeae0] p-4 shadow-sm text-left">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-serif font-bold text-neutral-900 text-xs">{src.document_name}</span>
                                  <span className={`text-[9px] px-2 py-0.5 font-bold uppercase tracking-widest border ${
                                    src.status === 'Active' 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}>{src.status}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-[9px] text-neutral-400 uppercase tracking-wider font-semibold mt-1">
                                  <span>{src.section}</span>
                                  {src.part !== 'N/A' && src.part !== 'Unknown' && <span>• {src.part}</span>}
                                  <span>• {src.document_type}</span>
                                  <span className="text-[#bfa37a]">• Relevance: {(src.relevance_score * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Web Sources */}
                    {message.webSources && message.webSources.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => toggleSources(`web-${message.id}`)}
                          className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 hover:text-[#bfa37a] uppercase tracking-widest transition-colors self-start"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          {expandedSources.has(`web-${message.id}`) ? 'Hide' : 'View'} {message.webSources.length} Web Sources
                        </button>

                        {expandedSources.has(`web-${message.id}`) && (
                          <div className="flex flex-col gap-2 mt-1">
                            {message.webSources.map((ws, idx) => (
                              <a
                                key={idx}
                                href={ws.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col gap-1 bg-white border border-[#efeae0] p-4 hover:shadow-md hover:border-[#bfa37a] transition-all duration-300 text-left"
                              >
                                <span className="font-serif font-bold text-neutral-900 text-xs">{ws.title}</span>
                                <span className="text-[#bfa37a] text-[10px] truncate font-light">{ws.url}</span>
                                <span className="text-neutral-500 text-xs mt-1 font-light line-clamp-2">{ws.snippet}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Lawyer Suggestions */}
                    {message.lawyerSuggestions && message.lawyerSuggestions.length > 0 && (
                      <div className="mt-3 border border-[#efeae0] bg-white shadow-sm text-left">
                        <div className="px-4 py-3 bg-[#fdfcfb] border-b border-[#efeae0]">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a]">
                            Recommended Legal Counsel
                          </h4>
                        </div>
                        <div className="divide-y divide-neutral-100">
                          {message.lawyerSuggestions.map((lawyer) => (
                            <div key={lawyer.id} className="flex items-center gap-4 px-4 py-4 hover:bg-[#faf8f6]/50 transition-colors">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-neutral-100 overflow-hidden border border-neutral-200/60">
                                {lawyer.profileImageUrl ? (
                                  <img src={lawyer.profileImageUrl} alt={lawyer.fullName} className="h-full w-full object-cover" />
                                ) : (
                                  <User className="h-5 w-5 text-neutral-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-serif font-bold text-neutral-900 truncate">{lawyer.fullName}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  {lawyer.averageRating > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5">
                                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                      {lawyer.averageRating.toFixed(1)}
                                    </span>
                                  )}
                                  {lawyer.district && (
                                    <span className="text-[9px] text-neutral-400 uppercase tracking-widest font-bold">{lawyer.district}</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {lawyer.practiceAreas.slice(0, 2).map((area, i) => (
                                    <span key={i} className="text-[8px] bg-neutral-100 text-neutral-500 px-2 py-0.5 font-bold uppercase tracking-wider">
                                      {area}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <Link
                                href={`/${locale}/lawyers/${lawyer.id}`}
                                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-[#bfa37a] text-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#a68d67] transition-colors"
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
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-3 p-5 bg-[#fdfbf7] border border-[#efeae0] shadow-sm rounded-2xl rounded-tl-none">
                    <Loader2 className="h-5 w-5 animate-spin text-[#bfa37a]" />
                    <span className="text-xs text-neutral-400 font-light">Searching legal database & web...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Login prompt overlay */}
        {showLoginPrompt && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md p-8 shadow-2xl border border-[#efeae0] text-center">
              <div className="flex h-16 w-16 items-center justify-center bg-neutral-950 text-white mx-auto mb-5">
                <LogIn className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-serif font-bold text-neutral-900 mb-2">Free Limit Reached</h3>
              <p className="text-sm text-neutral-500 font-light mb-6">
                You&apos;ve used all {GUEST_QUERY_LIMIT} free queries. Sign in to continue chatting with unlimited access and save your conversations.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/${locale}/login`}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#bfa37a] text-white font-bold text-xs uppercase tracking-widest hover:bg-[#a68d67] transition-all hover:shadow-md"
                >
                  <LogIn className="h-4 w-4" /> Sign In
                </Link>
                <Link
                  href={`/${locale}/register`}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 border border-[#efeae0] text-neutral-700 font-bold text-xs uppercase tracking-widest hover:bg-neutral-50 transition-colors"
                >
                  Create Account
                </Link>
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-3 hover:text-neutral-600 transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="shrink-0 bg-[#faf8f6]/95 backdrop-blur-sm border-t border-[#efeae0] pt-8 pb-4 px-5 sticky bottom-0 z-10">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
              className="bg-white border border-[#efeae0] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col gap-3 transition-all focus-within:border-[#bfa37a]/60"
            >
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
                className="w-full resize-none bg-transparent py-1 text-sm outline-none placeholder:text-neutral-400 text-neutral-800 font-light min-h-[50px] max-h-32 leading-relaxed"
                rows={2}
              />
              
              <div className="flex items-center justify-between border-t border-[#efeae0]/60 pt-3">
                {/* Bottom Left: Select Source */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSourceMenuOpen(!sourceMenuOpen)}
                    className="flex items-center gap-1 px-2.5 py-2 sm:px-3.5 sm:py-2 border border-[#efeae0] hover:bg-neutral-50 text-neutral-550 rounded-full text-[11px] font-semibold transition-colors shrink-0"
                  >
                    <Filter className="h-3 w-3 text-[#bfa37a]" />
                    <span className="hidden xs:inline">Source:&nbsp;</span>
                    <span>{selectedSource === 'All Legal DB' ? 'All DB' : selectedSource}</span>
                    <ChevronDown className="h-3 w-3 text-neutral-450" />
                  </button>
                  {sourceMenuOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-44 bg-white border border-[#efeae0] rounded-xl shadow-lg z-20 py-1 text-left text-xs">
                      {['All Legal DB', 'Companies Act', 'Motor Traffic Act', 'Civil Procedure Code'].map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => { setSelectedSource(src); setSourceMenuOpen(false); }}
                          className={`w-full px-3.5 py-2 hover:bg-[#faf8f6] text-left transition-colors ${
                            selectedSource === src ? 'text-[#bfa37a] font-semibold bg-[#faf8f6]' : 'text-neutral-600'
                          }`}
                        >
                          {src}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Right: Attach, Voice, Send */}
                <div className="flex items-center gap-2">
                  {!isAuthenticated && (
                    <button
                      type="button"
                      onClick={handleNewChat}
                      className="flex items-center justify-center p-2 sm:px-3.5 sm:py-2 border border-[#efeae0] hover:bg-neutral-50 text-neutral-550 rounded-full text-[11px] font-semibold transition-colors shrink-0"
                      title="New Chat"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span className="hidden sm:inline ml-1 text-[#bfa37a]">New</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="flex items-center justify-center p-2 sm:px-3.5 sm:py-2 border border-[#efeae0] hover:bg-neutral-50 text-neutral-500 rounded-full text-[11px] font-semibold transition-colors shrink-0"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-[#bfa37a]" />
                    <span className="hidden sm:inline ml-1">Attach</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center p-2 sm:px-3.5 sm:py-2 border border-[#efeae0] hover:bg-neutral-50 text-neutral-500 rounded-full text-[11px] font-semibold transition-colors shrink-0"
                  >
                    <Mic className="h-3.5 w-3.5 text-[#bfa37a]" />
                    <span className="hidden sm:inline ml-1">Voice</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="flex items-center justify-center gap-1.5 p-2 sm:px-5 sm:py-2 bg-[#bfa37a] hover:bg-[#a68d67] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm shrink-0"
                  >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </div>
            </form>
            <div className="mt-2 flex flex-col xs:flex-row items-center justify-between gap-2 text-center text-[8px] text-neutral-400 font-bold uppercase tracking-[0.18em]">
              <span>Powered by Sri Lankan Legal Database & Web Search</span>
              {!isAuthenticated && (
                <span className="text-[#bfa37a]">
                  {Math.max(0, GUEST_QUERY_LIMIT - guestQueryCount)} queries left •{' '}
                  <Link href={`/${locale}/login`} className="underline hover:text-[#a68d67] transition-colors">
                    Login
                  </Link>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
