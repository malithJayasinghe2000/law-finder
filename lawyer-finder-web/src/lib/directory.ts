import { cache } from 'react';
import prisma from '@/lib/db';

/**
 * The public directory switch.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Counsel questions 16–18 ask whether a consumer directory of attorneys may
 * lawfully exist in Sri Lanka. Until they are answered the directory stays up;
 * if the answer is no, an administrator turns it off at
 * /dashboard/admin/directory and these surfaces disappear without a release:
 *
 *   - the `/lawyers` and `/firms` list pages, and `/api/lawyers`, `/api/firms`
 *   - every link to them (header, footer, home page, profile breadcrumbs)
 *
 * What stays when it is off: a firm's own page (`/firms/[slug]`) and an
 * attorney's own page (`/lawyers/[id]`), reached by a link the firm or attorney
 * gave the client. That is counsel question 18(d) — the client contacts a
 * practice they already know — and it is the B2B product's front door.
 *
 * State is the newest `DirectorySwitch` row; no rows means ON. If the read
 * fails we answer OFF: showing the directory when we cannot tell whether it
 * was withdrawn is the one wrong answer here that carries criminal exposure.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const isPublicDirectoryEnabled = cache(async (): Promise<boolean> => {
  try {
    const latest = await prisma.directorySwitch.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { enabled: true },
    });
    return latest?.enabled ?? true;
  } catch (error) {
    console.error('[DIRECTORY_SWITCH_READ]', error);
    return false;
  }
});

/**
 * Who appears in the public directory.
 *
 * A firm is listed when it is active and verified. An attorney is listed only
 * through such a firm: the firm is the provider of legal services (guardrail
 * rule 7), so an attorney whose firm has been deactivated or un-verified must
 * disappear from "People" at the same moment the firm disappears from
 * "Practices". Before this, `/lawyers` checked only the attorney.
 *
 * And it must be a REGISTERED practice. Since 2026-10-13 no practice is created
 * automatically; the firms of one that approval used to create silently are
 * not listed and cannot be engaged until their attorney registers the practice
 * (which sends it to an administrator for verification). Their existing
 * matters are untouched — the firm stays active so its members keep access.
 */
export const LISTED_FIRM_WHERE = {
  isActive: true,
  isRegisteredPractice: true,
  verificationStatus: 'VERIFIED',
} as const;

/** A registered practice waiting for an administrator to verify it. */
export const AWAITING_CHECK_FIRM_WHERE = {
  isActive: true,
  isRegisteredPractice: true,
  verificationStatus: 'PENDING',
} as const;

/** The same test as LISTED_FIRM_WHERE, for a firm already loaded. */
export function isListedFirm(
  firm: { isActive: boolean; isRegisteredPractice: boolean; verificationStatus: string } | null | undefined
): boolean {
  return !!firm && firm.isActive && firm.isRegisteredPractice && firm.verificationStatus === 'VERIFIED';
}

export const LISTED_ATTORNEY_WHERE = {
  isVerified: true,
  firm: { is: LISTED_FIRM_WHERE },
} as const;

/**
 * The directory's ordering: a fresh shuffle every day, the same for everyone.
 *
 * Alphabetical order was neutral but not fair — "Anura Bandara" sat first on
 * every page, every day, and an attorney named Zainab never reached page one.
 * Instead each entry is ranked by a hash of (today's date in Sri Lanka, its id):
 *
 *   - nothing anyone does, pays or clicks can move an entry (rules 3 and 4);
 *   - every visitor sees the same order on a given day, so pagination is stable
 *     and the order can be disclosed truthfully as "changes daily";
 *   - over time every entry spends as long at the top as any other.
 *
 * Do not seed this with anything about the viewer or the entry beyond its id —
 * an order that differs per person, or that knows anything about an attorney,
 * is a ranking, and a ranking needs counsel (question 18).
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function directoryDayKey(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(now);
}

export function inDailyOrder<T extends { id: string }>(items: T[], now: Date = new Date()): T[] {
  const day = directoryDayKey(now);
  return items
    .map((item) => ({ item, key: fnv1a(`${day}:${item.id}`) }))
    .sort((a, b) => a.key - b.key || (a.item.id < b.item.id ? -1 : 1))
    .map(({ item }) => item);
}

/** The disclosure shown wherever the daily order is used. Keep it true. */
export const DIRECTORY_ORDER_NOTICE =
  'The order changes every day and is the same for everyone. Nobody can pay for a position.';
