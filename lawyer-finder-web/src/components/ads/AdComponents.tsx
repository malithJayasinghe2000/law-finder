'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface Ad {
  id: string;
  type: string;
  placement: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  targetUrl: string;
  ctaText: string | null;
  lawyer: {
    id: string;
    fullName: string;
    profileImageUrl: string | null;
    district: string | null;
    practiceAreas: string[];
    baseFeeRange: string | null;
    bio: string | null;
  };
}

// Track impression
function trackImpression(campaignId: string) {
  fetch('/api/ads/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, event: 'impression' }),
  }).catch(() => {});
}

// Track click
function trackClick(campaignId: string) {
  fetch('/api/ads/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, event: 'click' }),
  }).catch(() => {});
}

/* =========================================================
   1. AdBanner — Full-width or mid-page banner ad
   ========================================================= */
export function AdBanner({
  placement,
  locale,
  className = '',
}: {
  placement: string;
  locale: string;
  className?: string;
}) {
  const [ad, setAd] = useState<Ad | null>(null);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    fetch(`/api/ads/serve?placement=${placement}&limit=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ads && d.ads.length > 0) {
          setAd(d.ads[0]);
          if (!trackedRef.current.has(d.ads[0].id)) {
            trackImpression(d.ads[0].id);
            trackedRef.current.add(d.ads[0].id);
          }
        }
      })
      .catch(() => {});
  }, [placement]);

  if (!ad) return null;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Link
        href={ad.targetUrl.startsWith('/') ? `/${locale}${ad.targetUrl}` : ad.targetUrl}
        onClick={() => trackClick(ad.id)}
        className="block group"
      >
        {ad.imageUrl ? (
          <div className="relative w-full h-[200px] sm:h-[280px] lg:h-[320px] overflow-hidden">
            <img
              src={ad.imageUrl}
              alt={ad.title || 'Sponsored'}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              {ad.title && <h3 className="text-xl sm:text-2xl font-bold mb-1">{ad.title}</h3>}
              {ad.description && <p className="text-sm text-white/80 mb-3 max-w-lg">{ad.description}</p>}
              <span className="inline-flex items-center px-4 py-2 bg-white text-neutral-900 text-sm font-bold hover:bg-neutral-100 transition-colors">
                {ad.ctaText || 'Learn More'} →
              </span>
            </div>
            <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest text-white/60 bg-black/30 backdrop-blur-sm px-2 py-1">
              Sponsored
            </span>
          </div>
        ) : (
          <div className="w-full py-8 px-6 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white flex items-center justify-between">
            <div>
              {ad.title && <h3 className="text-lg font-bold mb-1">{ad.title}</h3>}
              {ad.description && <p className="text-sm text-white/70">{ad.description}</p>}
            </div>
            <span className="px-4 py-2 bg-white text-neutral-900 text-sm font-bold">{ad.ctaText || 'Learn More'} →</span>
            <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest text-white/40">Ad</span>
          </div>
        )}
      </Link>
    </div>
  );
}

/* =========================================================
   2. SponsoredListing — Sponsored lawyer card in the directory
   ========================================================= */
export function SponsoredListing({
  placement,
  locale,
}: {
  placement: string;
  locale: string;
}) {
  const [ads, setAds] = useState<Ad[]>([]);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    fetch(`/api/ads/serve?placement=${placement}&limit=2`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ads && d.ads.length > 0) {
          setAds(d.ads);
          d.ads.forEach((a: Ad) => {
            if (!trackedRef.current.has(a.id)) {
              trackImpression(a.id);
              trackedRef.current.add(a.id);
            }
          });
        }
      })
      .catch(() => {});
  }, [placement]);

  if (ads.length === 0) return null;

  return (
    <>
      {ads.map((ad) => (
        <Link
          key={ad.id}
          href={`/${locale}/lawyers/${ad.lawyer.id}`}
          onClick={() => trackClick(ad.id)}
        >
          <div className="group relative flex h-[400px] flex-col overflow-hidden bg-[#222a35] text-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg ring-2 ring-amber-500/50">
            {/* Sponsored Badge */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center py-1.5 bg-gradient-to-r from-amber-500 to-amber-600">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">★ Sponsored</span>
            </div>

            {/* Image */}
            <div className="relative h-[200px] w-full shrink-0">
              <img
                src={ad.lawyer.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                alt={ad.lawyer.fullName}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#222a35] via-[rgba(214,214,214,0.3)] to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-1 flex-col px-5 pb-5 -mt-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="text-[18px] font-semibold tracking-tight text-white drop-shadow-sm leading-tight mt-1 max-w-[70%] line-clamp-1">
                  {ad.lawyer.fullName}
                </h3>
                <div className="shrink-0 rounded-none bg-white/10 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md border border-white/5">
                  {ad.lawyer.baseFeeRange ? `LKR ${ad.lawyer.baseFeeRange.split('-')[0].trim()}` : 'TBD'}
                </div>
              </div>

              <p className="line-clamp-2 text-[13px] text-white/70 leading-relaxed font-light mb-4 text-balance">
                {ad.title || ad.lawyer.bio || 'Experienced legal professional.'}
              </p>

              <div className="mt-auto flex gap-2 overflow-x-hidden whitespace-nowrap mb-6">
                {ad.lawyer.district && (
                  <div className="flex shrink-0 items-center rounded-none bg-white/10 px-3 py-[5px] text-xs font-medium backdrop-blur-md border border-white/5 text-white/90">
                    {ad.lawyer.district}
                  </div>
                )}
                {ad.lawyer.practiceAreas.slice(0, 1).map((area) => (
                  <div key={area} className="flex shrink-0 items-center rounded-none bg-white/10 px-3 py-[5px] text-xs font-medium backdrop-blur-md border border-white/5 text-white/90">{area}</div>
                ))}
              </div>

              <button className="w-full rounded-none bg-amber-500 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-amber-600 mt-auto">
                {ad.ctaText || 'View Profile'}
              </button>
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}

/* =========================================================
   3. SidebarAd — Contextual ads on blog post pages
   ========================================================= */
export function SidebarAd({
  placement,
  locale,
  practiceArea,
  className = '',
}: {
  placement: string;
  locale: string;
  practiceArea?: string;
  className?: string;
}) {
  const [ads, setAds] = useState<Ad[]>([]);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    const params = new URLSearchParams({ placement, limit: '2' });
    if (practiceArea) params.set('practiceArea', practiceArea);
    fetch(`/api/ads/serve?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ads && d.ads.length > 0) {
          setAds(d.ads);
          d.ads.forEach((a: Ad) => {
            if (!trackedRef.current.has(a.id)) {
              trackImpression(a.id);
              trackedRef.current.add(a.id);
            }
          });
        }
      })
      .catch(() => {});
  }, [placement, practiceArea]);

  if (ads.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Sponsored Lawyers</p>
      {ads.map((ad) => (
        <Link
          key={ad.id}
          href={`/${locale}/lawyers/${ad.lawyer.id}`}
          onClick={() => trackClick(ad.id)}
          className="block group"
        >
          <div className="border border-neutral-200 rounded-lg p-4 hover:shadow-md hover:border-neutral-300 transition-all bg-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 shrink-0">
                {ad.lawyer.profileImageUrl ? (
                  <img src={ad.lawyer.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-neutral-400">
                    {ad.lawyer.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900 truncate">{ad.lawyer.fullName}</p>
                <p className="text-xs text-neutral-500">{ad.lawyer.district || 'Sri Lanka'}</p>
              </div>
            </div>
            {ad.title && <p className="text-xs text-neutral-700 font-medium mb-2">{ad.title}</p>}
            {ad.lawyer.practiceAreas.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {ad.lawyer.practiceAreas.slice(0, 2).map((area) => (
                  <span key={area} className="text-[10px] font-medium px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                    {area}
                  </span>
                ))}
              </div>
            )}
            <div className="text-xs font-bold text-primary group-hover:underline">
              {ad.ctaText || 'View Profile'} →
            </div>
            <p className="text-[9px] text-neutral-400 mt-2">Sponsored</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* =========================================================
   4. InFeedAd — Blends into blog post feeds
   ========================================================= */
export function InFeedAd({
  placement,
  locale,
}: {
  placement: string;
  locale: string;
}) {
  const [ad, setAd] = useState<Ad | null>(null);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    fetch(`/api/ads/serve?placement=${placement}&limit=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ads && d.ads.length > 0) {
          setAd(d.ads[0]);
          if (!trackedRef.current.has(d.ads[0].id)) {
            trackImpression(d.ads[0].id);
            trackedRef.current.add(d.ads[0].id);
          }
        }
      })
      .catch(() => {});
  }, [placement]);

  if (!ad) return null;

  return (
    <Link
      href={ad.targetUrl.startsWith('/') ? `/${locale}${ad.targetUrl}` : ad.targetUrl}
      onClick={() => trackClick(ad.id)}
      className="block group"
    >
      <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-all relative">
        {ad.imageUrl && (
          <div className="h-[140px] overflow-hidden">
            <img src={ad.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            {ad.lawyer.profileImageUrl && (
              <img src={ad.lawyer.profileImageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
            )}
            <span className="text-xs font-semibold text-neutral-700">{ad.lawyer.fullName}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-auto">Ad</span>
          </div>
          {ad.title && <h3 className="text-sm font-bold text-neutral-900 mb-1 group-hover:text-primary transition-colors">{ad.title}</h3>}
          {ad.description && <p className="text-xs text-neutral-600 line-clamp-2">{ad.description}</p>}
          <div className="mt-3 text-xs font-bold text-primary">{ad.ctaText || 'Learn More'} →</div>
        </div>
      </div>
    </Link>
  );
}
