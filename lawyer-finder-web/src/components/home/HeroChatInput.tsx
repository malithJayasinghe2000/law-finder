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
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* Mode Switcher */}
      <div className="flex items-center gap-1 bg-[#1a1a1a]/80 backdrop-blur-md p-1 rounded-full border border-white/10 mb-6">
        <button
          onClick={() => setMode('chat')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-full transition-colors uppercase tracking-widest outline-none",
            mode === 'chat' 
              ? "bg-white text-black" 
              : "text-white/60 hover:text-white hover:bg-white/5"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setMode('search')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-full transition-colors uppercase tracking-widest outline-none",
            mode === 'search' 
              ? "bg-white text-black" 
              : "text-white/60 hover:text-white hover:bg-white/5"
          )}
        >
          <Search className="w-4 h-4" />
          Search
        </button>
      </div>

      {/* Input Box based on image inspiration */}
      <form onSubmit={handleSubmit} className="w-full relative shadow-2xl">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 via-primary/10 to-purple-500/10 blur-xl opacity-30 pointer-events-none" />
        
        <div className="relative bg-[#0f1115]/90 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-3xl flex flex-col">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'chat' ? "Write any request or command to AI..." : "Search for lawyers by name, specialty, or location..."}
            className="w-full bg-transparent text-white/90 text-base sm:text-lg placeholder:text-white/30 resize-none outline-none min-h-[80px] p-3 font-light"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold px-4 py-2 rounded-full uppercase tracking-widest transition-colors outline-none">
                <Search className="w-3.5 h-3.5" /> Quick Search
              </button>
              {mode === 'chat' && (
                <>
                  <button type="button" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold px-4 py-2 rounded-full uppercase tracking-widest transition-colors outline-none">
                    <ImageIcon className="w-3.5 h-3.5" /> Analyze Doc
                  </button>
                  <button type="button" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold px-4 py-2 rounded-full uppercase tracking-widest transition-colors outline-none">
                    <FileText className="w-3.5 h-3.5" /> Templates
                  </button>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={!query.trim()}
              className="group flex border border-white items-center gap-2 bg-white text-black px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap outline-none"
            >
              {mode === 'chat' ? 'Generate' : 'Search Now'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
