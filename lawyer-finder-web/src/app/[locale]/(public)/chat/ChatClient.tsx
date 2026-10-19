'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, Bot, Loader2, Paperclip, Plus, Trash2, Edit3, Check, X,
  MessageSquare, BookOpen, Star, PanelLeftClose, PanelLeft,
  LogIn, Search, Sparkles, Sliders, Share2, Filter, ChevronDown, Mic, Scale 
} from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { SidebarAd } from '@/components/ads/AdComponents';
import { LegalDisclaimer } from '@/components/shared/LegalDisclaimer';
import { useDirectoryEnabled } from '@/components/directory/DirectoryProvider';

// ─── Types ─────────────────────────────────────────────────────────────
/**
 * A citation that survived `src/lib/ai/policy.ts` on the server.
 *
 * `libraryDocumentId` is the difference between a reference a person can open
 * and one they have to take on trust. Where it is null the citation still names
 * a document that was genuinely retrieved, so it is shown — but it is not given
 * a link that goes nowhere. A citation to a document the reader cannot reach
 * manufactures authority, which is worse than citing nothing.
 */
interface Citation {
  documentName: string;
  documentType: string;
  section: string | null;
  part: string | null;
  status: string;
  lastUpdatedYear: number | string;
  libraryDocumentId: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  /** Set when the assistant declined, or when an answer was withheld. */
  refused?: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * There is no RAG URL here any more, and that is the point of Phase 5.
 *
 * This component used to call the model service directly on a `NEXT_PUBLIC_`
 * address, which meant every answer was generated somewhere our application
 * never saw — so no refusal rule, no citation rule and no confidentiality
 * boundary could actually be enforced. Everything now goes to `/api/ai/ask`,
 * which is the only route on the platform that produces an AI answer.
 */
const GUEST_QUERY_LIMIT = 5;

/**
 * What the assistant says before it is asked anything.
 *
 * It used to open with "I am **LawyerAI**, your personal legal assistant".
 * A platform that is not a law firm cannot introduce itself as anyone's lawyer
 * — that is holding ourselves out as providing legal services (guardrail rules 6
 * and 7), and it is the first thing every user reads.
 *
 * Stating the limit up front also does more work than the notice below it: a
 * person who has been told plainly that this thing cannot advise them is far
 * less likely to act on it as though it had.
 */
function greeting(actTitles: string[]): string {
  // Titles that are only a number ("Act No. 24 of 2007") say nothing to a reader.
  const named = actTitles.filter((t) => !/^Act No\./i.test(t));
  // The best-known first, when held; then the rest alphabetically.
  const WELL_KNOWN = ['Penal Code', 'Civil Procedure Code', 'Companies Act', 'Partition Law', 'Prescription Ordinance', 'Motor Traffic Act'];
  const ordered = [...WELL_KNOWN.filter((t) => named.includes(t)), ...named.filter((t) => !WELL_KNOWN.includes(t))];
  const shown = ordered.slice(0, 6).map((t) => `**${t}**`);
  const holdings = actTitles.length === 0
    ? ''
    : ` - currently ${actTitles.length} Acts and Ordinances, including ${shown.join(', ')}. ` +
      'The Legal Library lists them all';
  return (
    'Hello. I answer questions **about Sri Lankan law**, using legislation I can cite and you can check' +
    holdings + '.\n\n' +
    'I am not a lawyer, and I cannot advise you on your own situation or tell you what to do about it. ' +
    'Ask me what the law says, and I will show you where it says it.'
  );
}

/**
 * The "source" menu, "Attach" and "Voice" - OFF (2026-10-16). None of them did
 * anything: the chosen source was never sent with the question, and the other
 * two had no handler. A switch, not a deletion.
 */
const CHAT_EXTRA_CONTROLS_ENABLED = false;

// ─── Component ─────────────────────────────────────────────────────────
export default function ChatClient({
  locale,
  initialQuery,
  isAuthenticated,
  conversationId: initialConversationId,
  actTitles = [],
}: {
  locale: string;
  initialQuery: string;
  isAuthenticated: boolean;
  conversationId?: string;
  /** Titles in the Legal Library, for the greeting (page.tsx). */
  actTitles?: string[];
}) {
  const directoryEnabled = useDirectoryEnabled();
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  // The guest allowance is no longer read from or written to localStorage. It
  // is counted on the server, per IP, in /api/ai/ask — the stored copy was
  // resettable from the browser console, and keeping it here would now also
  // disagree with the server. `guestQueryCount` is a display hint for this
  // session only; the 429 response is the authority.

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
          citations: m.citations || undefined,
          refused: Boolean(m.refusalCategory),
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
      setMessages([{ id: '1', role: 'assistant', content: greeting(actTitles) }]);
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

  // ─── Create new conversation ───────────────────────────────────────
  const handleNewChat = () => {
    setMessages([{ id: '1', role: 'assistant', content: greeting(actTitles) }]);
    setActiveConversationId(null);
    window.history.replaceState(null, '', `/${locale}/chat`);
  };

  // ─── Delete conversation ───────────────────────────────────────────
  const handleDeleteConversation = async (id: string) => {
    // It is gone for good (no undo), so ask first.
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
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

  // ─── Send message ──────────────────────────────────────────────────
  /**
   * One request, to one route, which does everything.
   *
   * `/api/ai/ask` classifies the question, generates, checks the answer against
   * the AI policy, and stores the exchange — server side, in that order. This
   * function deliberately holds no part of that: the client cannot decide what
   * was cited, cannot supply the assistant's text, and cannot see where the
   * model lives.
   *
   * It also no longer creates the conversation or saves the messages itself.
   * Those were separate calls the browser made *after* it had received an
   * answer, which made the stored transcript a claim the client made about
   * itself.
   */
  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: activeConversationId,
          // Keeps the emergency numbers on follow-ups in a guest chat, which
          // the server has no history for. It can only add the note.
          safetyShown: messages.some((m) => m.role === 'assistant' && m.content.includes('call the Police on **119**')),
        }),
      });

      const data = await response.json();

      // The guest allowance is counted on the server now. It used to live in
      // localStorage, where a user could reset it from the browser console.
      if (response.status === 429) {
        setMessages(prev => prev.slice(0, -1));
        setInput(text);
        if (data.requiresLogin) {
          setShowLoginPrompt(true);
        } else {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.error,
            refused: true,
          }]);
        }
        return;
      }

      if (!response.ok) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.error || 'Something went wrong answering that. Please try again.',
          refused: true,
        }]);
        return;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        refused: Boolean(data.refused),
      }]);

      if (!isAuthenticated) {
        setGuestQueryCount(prev => prev + 1);
      }

      if (data.conversationId && data.conversationId !== activeConversationId) {
        setActiveConversationId(data.conversationId);
        window.history.replaceState(null, '', `/${locale}/chat?id=${data.conversationId}`);
      }
      if (isAuthenticated) loadConversations();
    } catch (error) {
      console.error('AI request failed:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'I could not reach the legal database just now. Please try again in a moment. ' +
          'If you need help with your own situation, consult an attorney-at-law.',
        refused: true,
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
                aria-label="Rename chat"
                className="p-0.5 text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                aria-label="Delete chat"
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
                <button onClick={() => setSidebarOpen(false)} className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors" title="Collapse Sidebar" aria-label="Hide saved chats">
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
            aria-label="Show saved chats"
            className="fixed top-28 left-8 md:left-12 z-10 p-2.5 bg-white hover:bg-neutral-50 border border-[#efeae0] rounded-full text-neutral-500 hover:text-neutral-900 shadow-sm transition-all"
            title="Open Chat List"
          >
            <PanelLeft className="h-4.5 w-4.5" />
          </button>
        )}

        {/* Messages area */}
        <div className="flex-1 p-6 pb-36 scroll-smooth">
          <div className="mx-auto max-w-3xl space-y-8">
            {/* The empty state used to read "Consultation Portal / Hi, I'm Your
                Personal Lawyer / ...to begin a case review" — the platform
                introducing itself as the user's lawyer and offering to review
                their case, in the largest type on the page. A platform that is
                not a law firm cannot say that (guardrail rules 6 and 7), and no
                notice further down the page undoes a headline. */}
            {messages.length <= 1 && !initialQuery && (
              <div className="text-center py-16 space-y-3">
                <span className="text-[10px] text-[#bfa37a] uppercase tracking-[0.25em] font-bold">
                  Legal Research Assistant
                </span>
                <h1 className="text-3xl sm:text-4xl font-serif text-neutral-900 leading-tight">
                  Ask about Sri Lankan law
                </h1>
                <p className="text-neutral-500 text-sm max-w-md mx-auto font-light leading-relaxed">
                  Questions about legislation and procedure, answered from documents you can open and check.
                  This is information, not legal advice - it cannot advise you on your own case.
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

                    {/* Citations.
                        Shown expanded by default rather than behind a toggle: an
                        answer's authority is part of the answer, and a source
                        nobody opens is a source nobody checked. */}
                    {message.citations && message.citations.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest self-start">
                          <BookOpen className="w-3.5 h-3.5" />
                          Based on {message.citations.length}{' '}
                          {message.citations.length === 1 ? 'source' : 'sources'}
                        </span>

                        <div className="flex flex-col gap-2 mt-1">
                          {message.citations.map((cite, idx) => {
                            const body = (
                              <>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-serif font-bold text-neutral-900 text-xs">
                                    {cite.documentName}
                                  </span>
                                  <span
                                    className={`text-[9px] px-2 py-0.5 font-bold uppercase tracking-widest border ${
                                      cite.status === 'Active'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                                    }`}
                                  >
                                    {cite.status}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-[9px] text-neutral-400 uppercase tracking-wider font-semibold mt-1">
                                  {cite.section && <span>{cite.section}</span>}
                                  {cite.part && <span>• {cite.part}</span>}
                                  <span>• {cite.documentType}</span>
                                  {cite.libraryDocumentId ? (
                                    <span className="text-[#bfa37a]">• Open in legal library →</span>
                                  ) : (
                                    <span className="text-neutral-400">• Not yet in the library</span>
                                  )}
                                </div>
                              </>
                            );

                            // Linked only where the document actually exists to
                            // open. A citation that 404s invents authority.
                            return cite.libraryDocumentId ? (
                              <Link
                                key={idx}
                                href={`/${locale}/legal-library/${cite.libraryDocumentId}`}
                                className="flex flex-col gap-1 bg-[#fdfbf7] border border-[#efeae0] p-4 shadow-sm text-left hover:border-[#bfa37a] transition-colors"
                              >
                                {body}
                              </Link>
                            ) : (
                              <div
                                key={idx}
                                className="flex flex-col gap-1 bg-[#fdfbf7] border border-[#efeae0] p-4 shadow-sm text-left"
                              >
                                {body}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Web sources are deliberately not rendered, and are no
                        longer requested. A DuckDuckGo result is not a legal
                        authority, and showing one beside a statute teaches a
                        reader that the two carry the same weight. */}

                    {/* Nothing here lists attorneys.
                        A panel of practitioners used to appear under any answer
                        where the model had inferred a practice area from what
                        the user had just described about their legal problem.
                        That is the platform choosing (guardrail rule 4), on the
                        back of privileged material (rule 5), on the surface
                        where the 1894 Ordinance bites hardest. The route that
                        fed it, /api/ai-chat/suggest-lawyers, is deleted; the
                        column that stored it is dropped.

                        The replacement is the standing directory link in the
                        notice below the composer — identical for every user,
                        unaffected by anything anyone types here. */}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-3 p-5 bg-[#fdfbf7] border border-[#efeae0] shadow-sm rounded-2xl rounded-tl-none">
                    <Loader2 className="h-5 w-5 animate-spin text-[#bfa37a]" />
                    <span className="text-xs text-neutral-400 font-light">Thinking...</span>
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
            <LegalDisclaimer
              variant="ai"
              className="mb-3 rounded-xl"
              compactOnPhone
              showDirectoryLink={directoryEnabled}
              locale={locale}
            />
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
                {/* Bottom Left: Select Source - off (CHAT_EXTRA_CONTROLS_ENABLED). */}
                {CHAT_EXTRA_CONTROLS_ENABLED ? (
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
                ) : <div />}

                {/* Bottom Right: Attach, Voice, Send */}
                <div className="flex items-center gap-2">
                  {!isAuthenticated && (
                    <button
                      type="button"
                      onClick={handleNewChat}
                      className="flex items-center justify-center p-2 sm:px-3.5 sm:py-2 border border-[#efeae0] hover:bg-neutral-50 text-neutral-550 rounded-full text-[11px] font-semibold transition-colors shrink-0"
                      title="New Chat"
                      aria-label="New chat"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span className="hidden sm:inline ml-1 text-[#bfa37a]">New</span>
                    </button>
                  )}
                  {CHAT_EXTRA_CONTROLS_ENABLED && (
                    <>
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
                    </>
                  )}
                  <button
                    type="submit"
                    aria-label="Send"
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
              <span>Answers cite Sri Lankan legislation - information only, not legal advice</span>
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
      {/* Right Sidebar Ad Area */}
      <SidebarAd 
        placement="CHAT_RIGHT_SIDEBAR" 
        locale={locale} 
        className="hidden lg:block w-80 border-l border-[#efeae0] p-6 bg-[#faf8f6] h-[calc(100vh-96px)] sticky top-24 shrink-0 overflow-y-auto"
      />
    </div>
    </div>
  );
}
