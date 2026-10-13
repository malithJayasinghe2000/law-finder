import React from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';

/**
 * Not-legal-advice notice.
 *
 * Required on every AI surface and every page presenting legal information.
 * The platform is not a law firm and must never appear to give legal advice, or
 * to form an attorney-client relationship.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Placement is the compliance measure, not presence.
 *
 * A notice below the fold is a notice that was not given, and a notice that
 * contradicts the headline above it loses. Before adding this to a screen, check
 * that it is visible without scrolling and that nothing louder on the same
 * screen says the opposite. The AI chat used to carry this component *and* a
 * banner reading "Hi, I'm Your Personal Lawyer"; the banner was the message.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 6).
 */

type Variant = 'ai' | 'library' | 'directory';

const COPY: Record<Variant, { title: string; body: string }> = {
  ai: {
    title: 'Information only — not legal advice',
    body:
      'This assistant explains what Sri Lankan law says, citing documents you can open. It cannot advise you on your own situation, predict how a case would end, or tell you what to do — and it will decline if you ask. Using it creates no attorney-client relationship. For advice on your own matter, consult an attorney-at-law.',
  },
  library: {
    title: 'Reference material — not legal advice',
    body:
      'These documents are published for reference. They may not reflect subsequent amendments or judicial interpretation, and nothing here is legal advice or a substitute for consulting a qualified attorney-at-law.',
  },
  directory: {
    title: 'How these results are ordered',
    body:
      'Listed alphabetically and matched only on practice area, location and language. Ordering is never influenced by any payment to this platform, and this listing is not a recommendation or endorsement — the choice is yours.',
  },
};

export function LegalDisclaimer({
  variant = 'ai',
  className = '',
  /**
   * Show the standing link to the directory.
   *
   * Used on the AI surface, where it is the entire replacement for the panel of
   * practitioners the assistant used to display. The distinction that matters:
   * this link is the same for everyone, always present, and unaffected by
   * anything the user typed — so it is the user navigating, not the platform
   * channelling them (guardrail rule 4).
   */
  showDirectoryLink = false,
  locale = 'en',
}: {
  variant?: Variant;
  className?: string;
  showDirectoryLink?: boolean;
  locale?: string;
}) {
  const { title, body } = COPY[variant];

  return (
    <aside
      role="note"
      aria-label={title}
      className={`flex items-start gap-2.5 border border-neutral-200 bg-neutral-50 px-3 py-2.5 ${className}`}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-700">
          {title}
        </p>
        <p className="text-[11px] leading-relaxed text-neutral-600">
          {body}
          {showDirectoryLink && (
            <>
              {' '}
              <Link
                href={`/${locale}/lawyers`}
                className="font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
              >
                Browse the directory
              </Link>{' '}
              to find one yourself.
            </>
          )}
        </p>
      </div>
    </aside>
  );
}

export default LegalDisclaimer;
