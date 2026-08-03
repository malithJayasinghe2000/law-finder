'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, ArrowRight, Image as ImageIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HeroChatInput({ locale }: { locale: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'chat' | 'search'>('chat');
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (mode === 'chat') {
      router.push(`/${locale}/chat?q=${encodeURIComponent(query)}`);
    } else {
      router.push(`/${locale}/lawyers?search=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center">
      {/* Capsule Mode Switcher - Styled like Chill/Sport mockup */}
      <div className="inline-flex items-center p-1 bg-neutral-100 rounded-full border border-neutral-200/50 mb-6 shadow-sm">
        <button
          type="button"
          onClick={() => setMode('chat')}
          className={cn(
            "rounded-full px-7 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",
            mode === 'chat' 
              ? "bg-white text-neutral-900 shadow-sm" 
              : "text-neutral-500 hover:text-neutral-800"
          )}
        >
          Chat AI
        </button>
        <button
          type="button"
          onClick={() => setMode('search')}
          className={cn(
            "rounded-full px-7 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",
            mode === 'search' 
              ? "bg-white text-neutral-900 shadow-sm" 
              : "text-neutral-500 hover:text-neutral-800"
          )}
        >
          Search
        </button>
      </div>

      {/* Simple Search Input Box */}
      <form onSubmit={handleSubmit} className="w-full relative shadow-md bg-white border border-neutral-200 focus-within:border-[#bfa37a] focus-within:shadow-[0_0_15px_rgba(191,163,122,0.15)] transition-all p-1.5 flex items-center">
        <div className="pl-4 pr-1 text-neutral-400 shrink-0">
          {mode === 'chat' ? (
            <MessageSquare className="w-4 h-4 text-[#bfa37a]" />
          ) : (
            <Search className="w-4 h-4 text-[#bfa37a]" />
          )}
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === 'chat'
              ? 'Ask what the law says...'
              : 'Search for lawyers by name, specialty...'
          }
          className="w-full bg-transparent text-neutral-800 text-sm outline-none px-3 font-light"
        />

        <button
          type="submit"
          disabled={!query.trim()}
          className="group bg-[#bfa37a] text-white hover:bg-[#a68d67] hover:scale-[1.02] text-xs font-bold uppercase tracking-widest px-6 py-3.5 transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {mode === 'chat' ? 'Ask AI' : 'Search'}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </form>

      {/* This is where most people type their legal problem for the first time,
          so the limit belongs here and not only on the page they land on.
          Placement is the compliance measure — see LegalDisclaimer. */}
      {mode === 'chat' && (
        <p className="mt-3 max-w-md text-center text-[11px] leading-relaxed text-neutral-500">
          Information about Sri Lankan law, with sources — not legal advice, and
          not a substitute for an attorney-at-law. It cannot advise on your own case.
        </p>
      )}
    </div>
  );
}
