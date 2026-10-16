'use client';

import { AlertTriangle } from 'lucide-react';
import { findSelfPromotion } from '@/lib/selfPromotion';

/**
 * Shown under a bio or firm-description field while the text praises rather
 * than describes. Text like that is refused on save and, if it was saved
 * before the check existed, is not published — so without this notice an
 * attorney's description silently disappears from their public page.
 * See src/lib/selfPromotion.ts.
 */
export default function SelfPromotionNotice({ text }: { text: string | null | undefined }) {
  const word = findSelfPromotion(text);
  if (!word) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-800">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Remove &ldquo;{word}&rdquo; — a description may say what the practice does, but not praise it
        (Supreme Court Rules 39 and 49). Until then it cannot be saved, and it is not shown publicly.
      </span>
    </p>
  );
}
