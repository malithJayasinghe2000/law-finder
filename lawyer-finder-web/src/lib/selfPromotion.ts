import type { z } from 'zod';

/**
 * Self-praise in attorney bios and firm descriptions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Rule 45 of the 1988 Rules lets an attorney or firm appear in a Legal
 * Directory with "name, address and description". A description says what the
 * practice does; it does not praise it. Rule 39(2) treats advertising "for the
 * purpose of unfairly attracting clientele" as touting, and Rule 49 bars
 * publishing particulars of one's practice — so "Expert in Criminal Law",
 * "Sri Lanka's leading firm" and "No. 1 divorce lawyer" are the platform
 * publishing the very thing the Rules forbid.
 *
 * Used twice: schemas reject it on save, and public pages refuse to render
 * text saved before this check existed.
 *
 * The patterns are deliberately narrow where an ordinary legal phrase shares
 * the word: "best interests of the child", "leading question", "leading
 * evidence" must all pass. If you add a pattern, add the legal phrase it could
 * catch to the exclusions too.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const PATTERNS: { re: RegExp; word: string }[] = [
  { re: /\bexperts?\b|\bexpertise\b/i, word: 'expert' },
  { re: /\bspeciali[sz](?:t|ts|e|es|ed|ing|ation|ations)\b/i, word: 'specialist' },
  { re: /\bbest\b(?!\s+interests?\b)/i, word: 'best' },
  { re: /\bleading\s+(?:lawyers?|attorneys?|advocates?|firms?|law\s+firms?|practices?|practitioners?|counsel)\b/i, word: 'leading' },
  { re: /\btop(?:[\s-]+rated|[\s-]+(?:lawyers?|attorneys?|firms?|advocates?))\b/i, word: 'top' },
  { re: /\bno\.?\s*1\b|\bnumber\s+one\b|#\s*1\b/i, word: 'No. 1' },
  { re: /\bguarantee(?:s|d)?\b/i, word: 'guarantee' },
  { re: /\brenowned\b|\baward[\s-]+winning\b|\bunmatched\b|\bunrivall?ed\b|\bfinest\b|\bpremier\b/i, word: 'renowned' },
  { re: /\bmost\s+(?:experienced|trusted|successful)\b/i, word: 'most experienced' },
  { re: /\b100\s*%\s*(?:success|win)/i, word: '100% success' },
];

/** The first self-praising word found, or null when the text only describes. */
export function findSelfPromotion(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const { re, word } of PATTERNS) if (re.test(text)) return word;
  return null;
}

/** Text that is safe to publish, or null. For rendering already-saved text. */
export function publishableDescription(text: string | null | undefined): string | null {
  if (!text || findSelfPromotion(text)) return null;
  return text;
}

/** Zod superRefine for a bio or description field. */
export function rejectSelfPromotion(value: unknown, ctx: z.RefinementCtx) {
  if (typeof value !== 'string') return;
  const word = findSelfPromotion(value);
  if (word) {
    ctx.addIssue({
      code: 'custom',
      message: `Please remove "${word}". A profile may describe your practice but not praise it (Supreme Court Rules 39 and 49).`,
    });
  }
}
