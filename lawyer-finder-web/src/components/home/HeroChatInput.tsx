'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The home page question box. It only asks the assistant.
 *
 * It used to have a "Chat AI / Search" pill that switched it into a lawyer
 * search. That duplicated the "Find Lawyers" button beside it, sat centred in a
 * left-aligned hero, and a lawyer search typed into the same box people type
 * their legal problem into blurred the line between asking about the law and
 * being sent to a practitioner. Directory search lives on /lawyers and /firms.
 */
export default function HeroChatInput({
  locale,
  tone = 'light',
}: {
  locale: string;
  /** 'dark' when placed on a dark background. */
  tone?: 'light' | 'dark';
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const dark = tone === 'dark';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      inputRef.current?.focus();
      return;
    }
    router.push(`/${locale}/chat?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex w-full max-w-xl flex-col">
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex w-full items-center p-1.5 transition-colors',
          dark
            ? 'border border-white/25 bg-white/6 backdrop-blur-sm focus-within:border-[#bfa37a]'
            : 'border border-neutral-200 bg-white shadow-md focus-within:border-[#bfa37a]'
        )}
      >
        <div className="shrink-0 pl-4 pr-1">
          <MessageSquare className="h-4 w-4 text-[#bfa37a]" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask what the law says..."
          aria-label="Ask what the law says"
          className={cn(
            'w-full min-w-0 bg-transparent px-3 text-sm font-light outline-none',
            dark ? 'text-white placeholder:text-white/55' : 'text-neutral-800'
          )}
        />

        <button
          type="submit"
          className="group flex shrink-0 items-center gap-1.5 whitespace-nowrap bg-[#bfa37a] px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-[#0f0f0f] transition-colors hover:bg-[#d8c29d]"
        >
          Ask AI
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </form>

      {/* This is where most people type their legal problem for the first time,
          so the limit belongs here and not only on the page they land on.
          Placement is the compliance measure — see LegalDisclaimer. */}
      <p
        className={cn(
          'mt-3 max-w-md text-[11px] leading-relaxed',
          dark ? 'text-neutral-400' : 'text-neutral-500'
        )}
      >
        Information about Sri Lankan law, with sources - not legal advice, and not a substitute
        for an attorney-at-law. It cannot advise on your own case.
      </p>
    </div>
  );
}
