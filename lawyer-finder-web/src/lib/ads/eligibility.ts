import type { AdPlacement, AdvertiserCategory } from '@prisma/client';

/**
 * Who may advertise on this platform, and where.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the only file that decides whether an advert may run. Do not
 * re-implement any of it inline in a route or a component.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The rule in one sentence: **no attorney, and nobody selling legal services,
 * may buy visibility on this platform.**
 *
 * Why it is this strict. An attorney may not advertise or solicit under Supreme
 * Court Rules 39-49. If we sell an attorney a promoted slot, the attorney who
 * buys it is advertising *through us* — we become the mechanism of their breach.
 * Worse, touting under the Intermeddlers with Suitors Ordinance No. 11 of 1894
 * is a criminal offence and it reaches the intermediary, which is us and our
 * directors personally.
 *
 * A bank, an insurer or a university is bound by none of that, so their
 * advertising raises no touting question. But "not an attorney" is not enough on
 * its own: an unregulated "legal consultant", a claims-management company or a
 * document-drafting service either practises law without a licence or channels
 * work toward those who do. Those are refused by category, not judged case by
 * case, because the case-by-case version is where mistakes get made.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 3).
 */

/**
 * Trades that may never advertise here, whatever their category says.
 *
 * These are matched against the advertiser's name and description at review
 * time as an aid to the human reviewer — they are not a substitute for the
 * reviewer's own judgement, which is recorded on `Advertiser.nonLegalConfirmed`.
 */
export const REFUSED_ADVERTISER_TRADES = [
  'law firm',
  'attorney',
  'attorney-at-law',
  'lawyer',
  'legal practice',
  'legal chambers',
  'advocate',
  'solicitor',
  'barrister',
  'notary',
  'legal consultant',
  'legal consultancy',
  'legal advice',
  'legal services',
  'claims management',
  'claims handling',
  'accident claims',
  'debt recovery agency',
  'document drafting',
  'deed writing',
  'legal insurance',
  'legal expenses insurance',
  'litigation funding',
] as const;

/**
 * Surfaces where advertising may appear.
 *
 * Editorial surfaces only — pages a person reads for information. There is
 * deliberately nothing here that is part of choosing a lawyer.
 *
 * The directory placements that used to exist (`DIRECTORY_TOP`,
 * `DIRECTORY_INLINE`) were removed from the `AdPlacement` enum entirely in
 * Phase 4. An advert inside a list of attorneys teaches a client that position
 * in that list is purchasable, and blurs an advertisement into a listing —
 * which is true whoever bought it.
 */
export const PERMITTED_AD_PLACEMENTS: AdPlacement[] = [
  'HOMEPAGE_BELOW_HERO',
  'BLOG_TOP_BANNER',
  'BLOG_RIGHT_SIDEBAR',
  'BLOG_BOTTOM_STICKY',
  'BLOG_POST_SIDEBAR',
  'BLOG_POST_BOTTOM',
  'LEGAL_LIBRARY_SIDEBAR',
  'CHAT_RIGHT_SIDEBAR',
];

/**
 * Surfaces where no advert may appear, at any price, from any advertiser.
 *
 * Kept as an explicit list rather than "everything not permitted", so that a new
 * page added later fails closed and someone has to think about it.
 */
export const FORBIDDEN_AD_SURFACES = [
  '/lawyers',
  '/lawyers/[id]',
  '/firms',
  '/firms/[slug]',
  '/firms/[slug]/engage',
  '/lawyers/[id]/book',
  '/dashboard',
] as const;

export function isPermittedPlacement(placement: AdPlacement): boolean {
  return PERMITTED_AD_PLACEMENTS.includes(placement);
}

/**
 * Whether a category is one we will sell to at all.
 *
 * `PROFESSIONAL_SERVICES` is permitted but is the one to watch: it covers
 * accountancy, translation and surveying, and is exactly where a legal
 * consultancy would try to file itself.
 */
export function isPermittedCategory(category: AdvertiserCategory): boolean {
  // Every category in the enum is permitted — there is no legal category, by
  // design. The real gate is `nonLegalConfirmed`, below.
  return true;
}

/**
 * Free-text screening, to help a human reviewer rather than replace them.
 *
 * Returns the refused trade terms found in the advertiser's own words.
 */
export function screenAdvertiserText(...parts: (string | null | undefined)[]): string[] {
  const haystack = parts.filter(Boolean).join(' ').toLowerCase();
  return REFUSED_ADVERTISER_TRADES.filter((term) => haystack.includes(term));
}

export type AdvertiserEligibility = {
  eligible: boolean;
  reason?: string;
};

/**
 * May this advertiser run a campaign right now?
 *
 * `nonLegalConfirmed` is the load-bearing check: a named ADMIN has confirmed
 * this organisation neither practises law nor sells legal services. It is a
 * stored fact with a person and a date against it, not something inferred from
 * `status`, because it is the single thing standing between us and rule 3.
 */
export function canAdvertiserRunCampaigns(advertiser: {
  status: string;
  isActive: boolean;
  nonLegalConfirmed: boolean;
}): AdvertiserEligibility {
  if (!advertiser.isActive) {
    return { eligible: false, reason: 'This advertiser account is closed.' };
  }

  if (advertiser.status === 'REJECTED') {
    return { eligible: false, reason: 'This advertiser was refused.' };
  }

  if (advertiser.status === 'SUSPENDED') {
    return { eligible: false, reason: 'This advertiser is suspended.' };
  }

  if (advertiser.status === 'PENDING_REVIEW') {
    return {
      eligible: false,
      reason: 'This advertiser has not been reviewed yet.',
    };
  }

  if (!advertiser.nonLegalConfirmed) {
    return {
      eligible: false,
      reason:
        'Nobody has confirmed this advertiser is not a legal-services provider. Campaigns cannot run until they have.',
    };
  }

  return { eligible: true };
}

/**
 * The label every advert carries.
 *
 * An advert must be unmistakably an advert. The unit this replaced was an
 * attorney's profile card with a small star on it, which is precisely the shape
 * to avoid — a paid placement wearing the clothes of a search result.
 */
export const AD_LABEL = 'Advertisement';

/**
 * Attributes for an outbound advert link.
 *
 * `sponsored` tells search engines this is paid, `noopener`/`noreferrer` are
 * ordinary hygiene for a link we do not control.
 */
export const AD_LINK_REL = 'sponsored noopener noreferrer';
