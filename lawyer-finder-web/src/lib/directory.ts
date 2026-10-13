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
 */
export const LISTED_FIRM_WHERE = {
  isActive: true,
  verificationStatus: 'VERIFIED',
} as const;

export const LISTED_ATTORNEY_WHERE = {
  isVerified: true,
  firm: { is: LISTED_FIRM_WHERE },
} as const;
