'use client';

import { useEffect, useState } from 'react';
import { Info, Scale } from 'lucide-react';

/**
 * The two notices the community needs (owner's decision, 2026-10-14).
 *
 * The community stays open to everyone, attorneys included: an attorney answers
 * for their own professional conduct. What the PLATFORM answers for is how the
 * page reads, so every community page says it is general discussion, not advice.
 * And an attorney writing here is reminded of the rules that apply to them — the
 * BASL cautionary note (June 2021) treats advice given through a publicised
 * online platform as touting; Rules 39 and 49 bar soliciting and publicising
 * one's practice. The reminder informs; the attorney still decides what to write.
 */

/** Shown at the top of community pages. */
export function CommunityDisclaimer({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-start gap-2 border border-[#efeae0] bg-[#faf8f6] px-3 py-2.5 text-xs text-neutral-600 leading-relaxed ${className}`}>
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#8c6d3f]" aria-hidden="true" />
      <p>
        <strong className="text-neutral-800">General discussion, not legal advice.</strong> Nothing here creates a
        lawyer-client relationship. For your own matter, contact a practice. Please do not post names or details
        that identify you or anyone else.
      </p>
    </div>
  );
}

/**
 * Shown above a post or comment box, to attorneys only. Pass `role` where the
 * page already knows it; otherwise it is looked up from the session.
 */
export function LawyerWritingReminder({ role, className = '' }: { role?: string | null; className?: string }) {
  // Looked up only when the page did not say who is writing.
  const [fetched, setFetched] = useState<string | null>(null);

  useEffect(() => {
    if (role !== undefined) return;
    let live = true;
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setFetched(d?.authenticated ? d.role : null); })
      .catch(() => {});
    return () => { live = false; };
  }, [role]);

  if ((role !== undefined ? role : fetched) !== 'LAWYER') return null;

  return (
    <div className={`flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed ${className}`}>
      <Scale className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        <strong>You are posting as an attorney.</strong> Share general information only. Do not advise anyone on their
        own case here, and do not promote your practice — see the BASL cautionary note (June 2021) and Rules 39 and 49
        of the Supreme Court (Conduct of and Etiquette for Attorneys-at-Law) Rules 1988.
      </p>
    </div>
  );
}
