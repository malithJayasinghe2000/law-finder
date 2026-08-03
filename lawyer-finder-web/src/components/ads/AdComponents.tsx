'use client';

import { useEffect, useState, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { AD_LABEL, AD_LINK_REL } from '@/lib/ads/eligibility';

/**
 * Advert units.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything rendered here belongs to a non-legal advertiser — a bank, an
 * insurer, a university. No attorney appears in an advert on this platform.
 *
 * Until Phase 4 these components rendered attorneys who had bought promotion,
 * shaped like profile cards, linking to `/lawyers/{id}`. Two things were wrong
 * with that: selling an attorney visibility is guardrail rule 3 (and touting,
 * which reaches us criminally under the Intermeddlers with Suitors Ordinance
 * 1894), and dressing a paid placement as a profile card made it indistinguishable
 * from an ordinary listing.
 *
 * So three rules hold for every unit below:
 *   1. It shows an ADVERTISER, never a practitioner.
 *   2. It is labelled "Advertisement" — not "Sponsored", which reads as
 *      editorial endorsement — and the label is not subtle.
 *   3. It links OUTWARD, with rel="sponsored". An advert never navigates a
 *      person deeper into this platform, because the only place it could send
 *      them is toward a lawyer.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 3) and src/lib/ads/eligibility.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Ad {
  id: string;
  type: string;
  placement: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  /** Always an external URL. The API drops any advert without one. */
  targetUrl: string;
  ctaText: string | null;
  advertiser: {
    name: string;
    category: string;
    logoUrl: string | null;
  };
}

interface PlacementConfig {
  placement: string;
  displayName: string;
  pricePerDay: number;
  isSlider: boolean;
  sliderInterval: number;
  maxAdsPerSlot: number;
}

function trackImpression(campaignId: string) {
  fetch('/api/ads/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, event: 'impression' }),
  }).catch(() => {});
}

function trackClick(campaignId: string) {
  fetch('/api/ads/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, event: 'click' }),
  }).catch(() => {});
}

/**
 * The label carried by every unit.
 *
 * Deliberately plain. A person should be able to tell in one glance that this
 * is paid for and is not a recommendation from us.
 */
function AdLabel({ className = '' }: { className?: string }) {
  return (
    <span
      className={`text-[8px] font-bold uppercase tracking-widest ${className}`}
      aria-label={AD_LABEL}
    >
      {AD_LABEL}
    </span>
  );
}

// ─── Config-driven slider rotation ───────────────────────────────────────────
function useAdSlider(placement: string, defaultLimit = 5) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [config, setConfig] = useState<PlacementConfig | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [adsRes, configRes] = await Promise.all([
          fetch(`/api/ads/serve?placement=${placement}&limit=${defaultLimit}`),
          fetch(`/api/ads/config?placement=${placement}`),
        ]);

        const adsData = await adsRes.json();
        const configData = configRes.ok ? await configRes.json() : null;

        if (cancelled) return;
        setAds(adsData.ads || []);
        setConfig(configData?.config || null);
      } catch {
        if (!cancelled) setAds([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [placement, defaultLimit]);

  const maxAds = config?.maxAdsPerSlot ?? 1;
  const isSlider = config?.isSlider ?? false;
  const interval = config?.sliderInterval ?? 5000;

  useEffect(() => {
    if (!isSlider || ads.length <= maxAds) return;
    const t = setInterval(() => {
      setCurrentIndex((i) => (i + maxAds) % ads.length);
    }, interval);
    return () => clearInterval(t);
  }, [isSlider, ads.length, maxAds, interval]);

  const visibleAds = ads.length ? ads.slice(currentIndex, currentIndex + maxAds) : [];
  const wrapped =
    visibleAds.length < maxAds && ads.length > maxAds
      ? [...visibleAds, ...ads.slice(0, maxAds - visibleAds.length)]
      : visibleAds;

  useEffect(() => {
    for (const ad of wrapped) {
      if (!trackedRef.current.has(ad.id)) {
        trackedRef.current.add(ad.id);
        trackImpression(ad.id);
      }
    }
  }, [wrapped]);

  return { visibleAds: wrapped, hasAds: ads.length > 0, config };
}

/* =========================================================
   1. AdBanner — banner below the homepage hero, or on blogs
   ========================================================= */
export function AdBanner({
  placement,
  className = '',
}: {
  placement: string;
  /** Accepted for call-site compatibility; adverts never link internally. */
  locale?: string;
  className?: string;
}) {
  const { visibleAds, hasAds } = useAdSlider(placement, 10);

  if (!hasAds || visibleAds.length === 0) return null;

  return (
    <div className={`relative overflow-hidden w-full ${className}`}>
      <div
        className={`grid gap-4 ${
          visibleAds.length === 3
            ? 'grid-cols-1 md:grid-cols-3'
            : visibleAds.length === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1'
        }`}
      >
        {visibleAds.map((ad) => (
          <a
            key={ad.id}
            href={ad.targetUrl}
            target="_blank"
            rel={AD_LINK_REL}
            onClick={() => trackClick(ad.id)}
            className="block group relative w-full h-[180px] sm:h-[220px] overflow-hidden rounded-none border border-neutral-100/80 shadow-sm bg-neutral-100"
          >
            {ad.imageUrl && (
              <img
                src={ad.imageUrl}
                alt={ad.title || ad.advertiser.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-5 text-white flex flex-col justify-end h-full">
              <h3 className="text-base sm:text-lg font-bold font-serif mb-1 leading-snug">
                {ad.title || ad.advertiser.name}
              </h3>
              {ad.description && (
                <p className="text-[11px] text-white/80 line-clamp-2 mb-3 max-w-md font-medium">
                  {ad.description}
                </p>
              )}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-widest text-[#bfa37a] group-hover:text-white transition-colors">
                  {ad.ctaText || 'Learn more'} <ExternalLink className="ml-1 h-3 w-3" />
                </span>
                <span className="text-[10px] text-white/50">by {ad.advertiser.name}</span>
              </div>
            </div>

            <AdLabel className="absolute top-3 right-3 text-white/70 bg-black/50 backdrop-blur-sm px-2 py-0.5 border border-white/10" />
          </a>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   2. SidebarAd — sidebar card for the blog, library and chat
   ========================================================= */
export function SidebarAd({
  placement,
  className = '',
}: {
  placement: string;
  locale?: string;
  /**
   * Accepted for call-site compatibility and deliberately unused.
   *
   * Targeting an advert on a practice area inferred from what a person is
   * discussing would mean selling adverts against privileged material.
   * See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
   */
  practiceArea?: string;
  className?: string;
}) {
  const { visibleAds, hasAds } = useAdSlider(placement, 8);

  if (!hasAds || visibleAds.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4">
        {AD_LABEL}
      </p>
      <div className="flex flex-col gap-4">
        {visibleAds.map((ad) => (
          <a
            key={ad.id}
            href={ad.targetUrl}
            target="_blank"
            rel={AD_LINK_REL}
            onClick={() => trackClick(ad.id)}
            className="block group"
          >
            <div className="border border-neutral-200/60 rounded-none p-4 hover:shadow-md hover:border-neutral-300 transition-all bg-white text-left">
              <div className="flex items-center gap-3 mb-3">
                {ad.advertiser.logoUrl && (
                  <div className="w-10 h-10 overflow-hidden bg-neutral-100 shrink-0">
                    <img src={ad.advertiser.logoUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 truncate">
                    {ad.advertiser.name}
                  </p>
                  <AdLabel className="text-neutral-400" />
                </div>
              </div>

              {ad.title && (
                <p className="text-xs text-neutral-800 font-medium mb-1">{ad.title}</p>
              )}
              {ad.description && (
                <p className="text-[11px] text-neutral-500 line-clamp-3 mb-3">{ad.description}</p>
              )}

              <div className="text-[10px] font-bold text-[#bfa37a] uppercase tracking-wider group-hover:underline inline-flex items-center gap-1">
                {ad.ctaText || 'Learn more'} <ExternalLink className="h-3 w-3" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   3. StickyBottomAd — dismissible bar pinned to the viewport
   ========================================================= */
export function StickyBottomAd({ placement }: { placement: string; locale?: string }) {
  const { visibleAds, hasAds } = useAdSlider(placement, 3);
  const [closed, setClosed] = useState(false);

  if (!hasAds || visibleAds.length === 0 || closed) return null;

  const ad = visibleAds[0];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#161616] text-white py-3 px-6 shadow-[0_-8px_30px_rgb(0,0,0,0.15)] border-t border-white/5 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
        <a
          href={ad.targetUrl}
          target="_blank"
          rel={AD_LINK_REL}
          onClick={() => trackClick(ad.id)}
          className="flex items-center gap-4 flex-1 min-w-0 group"
        >
          {ad.advertiser.logoUrl && (
            <div className="w-12 h-12 bg-white rounded-none overflow-hidden shrink-0 border border-white/10 hidden sm:block">
              <img src={ad.advertiser.logoUrl} alt="" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <AdLabel className="text-[#bfa37a] bg-[#bfa37a]/15 border border-[#bfa37a]/35 px-1.5 py-0.5" />
              <h4 className="text-xs font-bold text-white truncate font-serif group-hover:text-[#bfa37a] transition-colors">
                {ad.title || ad.advertiser.name}
              </h4>
            </div>
            <p className="text-[11px] text-neutral-400 line-clamp-1 font-light">
              {ad.description || `From ${ad.advertiser.name}`}
            </p>
          </div>
        </a>

        <div className="flex items-center gap-4 shrink-0">
          <a href={ad.targetUrl} target="_blank" rel={AD_LINK_REL} onClick={() => trackClick(ad.id)}>
            <button className="bg-[#bfa37a] hover:bg-[#a68d67] text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2 flex items-center gap-1 transition-colors">
              {ad.ctaText || 'Learn more'} <ExternalLink className="w-3 h-3" />
            </button>
          </a>
          <button
            onClick={() => setClosed(true)}
            className="p-1 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Dismiss advertisement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * `SponsoredListing` was removed in Phase 4.
 *
 * It rendered an attorney's profile card with a "★ Sponsored" flag and placed it
 * at the top of the directory. That is the exact anti-pattern this file now
 * exists to prevent: a paid placement wearing the clothes of a search result,
 * sold to a practitioner. It is not replaced.
 */
