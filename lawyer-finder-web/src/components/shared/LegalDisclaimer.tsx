import React from 'react';
import { Info } from 'lucide-react';

/**
 * Not-legal-advice notice.
 *
 * Required on every AI surface and every page presenting legal information.
 * The platform is not a law firm and must never appear to give legal advice, or
 * to form an attorney-client relationship.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 6).
 */

type Variant = 'ai' | 'library' | 'directory';

const COPY: Record<Variant, { title: string; body: string }> = {
  ai: {
    title: 'Information only — not legal advice',
    body:
      'This assistant provides general information about Sri Lankan law. It is not legal advice, it may be incomplete or out of date, and using it does not create an attorney-client relationship. For advice on your own situation, consult a qualified attorney-at-law.',
  },
  library: {
    title: 'Reference material — not legal advice',
    body:
      'These documents are published for reference. They may not reflect subsequent amendments or judicial interpretation, and nothing here is legal advice or a substitute for consulting a qualified attorney-at-law.',
  },
  directory: {
    title: 'How these results are ordered',
    body:
      'Attorneys are listed alphabetically and matched only on practice area and location. Ordering is never influenced by any payment to this platform, and this listing is not a recommendation or endorsement — the choice of attorney is yours.',
  },
};

export function LegalDisclaimer({
  variant = 'ai',
  className = '',
}: {
  variant?: Variant;
  className?: string;
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
        <p className="text-[11px] leading-relaxed text-neutral-600">{body}</p>
      </div>
    </aside>
  );
}

export default LegalDisclaimer;
