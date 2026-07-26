'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';

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

interface PlacementConfig {
  placement: string;
  displayName: string;
  pricePerDay: number;
  isSlider: boolean;
  sliderInterval: number;
  maxAdsPerSlot: number;
}

const DEFAULT_LAWYER_IMAGE = 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80';

// Track impressions & clicks
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

// ─── Custom Hook to handle Config-driven Slider Rotation ──────────
function useAdSlider(placement: string, defaultLimit = 5) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [config, setConfig] = useState<PlacementConfig | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    // Fetch placement config
    fetch('/api/ads/config')
      .then(r => r.json())
      .then(d => {
        const matchingConfig = d.configs?.find((c: any) => c.placement === placement);
        if (matchingConfig) {
          setConfig(matchingConfig);
        }
      })
      .catch(() => {});

    // Fetch active ads for this placement
    fetch(`/api/ads/serve?placement=${placement}&limit=${defaultLimit}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ads) {
          setAds(d.ads);
          // Track initial impressions
          d.ads.slice(0, config?.maxAdsPerSlot || 1).forEach((ad: Ad) => {
            if (!trackedRef.current.has(ad.id)) {
              trackImpression(ad.id);
              trackedRef.current.add(ad.id);
            }
          });
        }
      })
      .catch(() => {});
  }, [placement, config?.maxAdsPerSlot]);

  // Set up rotation timer if slider is enabled and we have enough ads
  useEffect(() => {
    if (!config?.isSlider || ads.length <= (config.maxAdsPerSlot || 1)) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % ads.length;
        // Track impression for newly visible ads
        const visibleAds = getVisibleAds(next);
        visibleAds.forEach((ad) => {
          if (!trackedRef.current.has(ad.id)) {
            trackImpression(ad.id);
            trackedRef.current.add(ad.id);
          }
        });
        return next;
      });
    }, config.sliderInterval || 3000);

    return () => clearInterval(interval);
  }, [config, ads]);

  // Helper to slice visible ads wrapping around the array
  const getVisibleAds = (index: number) => {
    const size = config?.maxAdsPerSlot || 1;
    if (ads.length <= size) return ads;
    const result: Ad[] = [];
    for (let i = 0; i < size; i++) {
      result.push(ads[(index + i) % ads.length]);
    }
    return result;
  };

  return {
    visibleAds: getVisibleAds(currentIndex),
    hasAds: ads.length > 0,
    config,
  };
}

/* =========================================================
   1. AdBanner — Slider banner below homepage hero or blogs
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
  const { visibleAds, hasAds } = useAdSlider(placement, 10);

  if (!hasAds || visibleAds.length === 0) return null;

  return (
    <div className={`relative overflow-hidden w-full ${className}`}>
      <div className={`grid gap-4 ${
        visibleAds.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
        visibleAds.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
        'grid-cols-1'
      }`}>
        {visibleAds.map((ad) => {
          const displayImageUrl = ad.imageUrl || ad.lawyer.profileImageUrl || DEFAULT_LAWYER_IMAGE;
          const bannerTitle = ad.title || ad.lawyer.fullName;
          const bannerDescription = ad.description || ad.lawyer.bio || ad.lawyer.district || null;

          return (
            <Link
              key={ad.id}
              href={ad.targetUrl.startsWith('/') ? `/${locale}${ad.targetUrl}` : ad.targetUrl}
              onClick={() => trackClick(ad.id)}
              className="block group relative w-full h-[180px] sm:h-[220px] overflow-hidden rounded-none border border-neutral-100/80 shadow-sm"
            >
              <img
                src={displayImageUrl}
                alt={bannerTitle}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white flex flex-col justify-end h-full">
                <h3 className="text-base sm:text-lg font-bold font-serif mb-1 leading-snug">{bannerTitle}</h3>
                {bannerDescription && <p className="text-[11px] text-white/80 line-clamp-2 mb-3 max-w-md font-medium">{bannerDescription}</p>}
                <div>
                  <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-widest text-[#bfa37a] group-hover:text-white transition-colors">
                    {ad.ctaText || 'Learn More'} →
                  </span>
                </div>
              </div>
              <span className="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-widest text-white/60 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-none border border-white/10">
                Sponsored
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   2. SponsoredListing — Sponsored lawyer cards for directory
   ========================================================= */
export function SponsoredListing({
  placement,
  locale,
  imageHeight = 'h-[360px]',
}: {
  placement: string;
  locale: string;
  imageHeight?: string;
}) {
  const { visibleAds, hasAds } = useAdSlider(placement, 6);

  if (!hasAds) return null;

  return (
    <>
      {visibleAds.map((ad) => (
        <Link
          key={ad.id}
          href={`/${locale}/lawyers/${ad.lawyer.id}`}
          onClick={() => trackClick(ad.id)}
          className="w-full"
        >
          <div className="group flex flex-col items-start bg-white border border-[#bfa37a]/50 bg-[#bfa37a]/[0.02] p-4 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 relative">
            {/* Image Frame */}
            <div className={`relative w-full ${imageHeight} overflow-hidden bg-neutral-100`}>
              <img
                src={ad.lawyer.profileImageUrl || DEFAULT_LAWYER_IMAGE}
                alt={ad.lawyer.fullName}
                className="h-full w-full object-cover transition-all duration-500"
              />
              <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] bg-[#bfa37a] text-white font-bold uppercase tracking-widest px-2 py-0.5 border border-[#bfa37a] rounded-none shadow-sm">
                  ★ Sponsored
                </span>
              </div>
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            {/* Display Info below card */}
            <div className="w-full pt-4 space-y-2 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a]">
                {ad.lawyer.practiceAreas[0] || 'Legal Counsel'}
              </span>
              <h4 className="text-neutral-900 font-serif font-bold text-base transition-colors group-hover:text-[#bfa37a]">
                {ad.lawyer.fullName}
              </h4>
              <p className="text-neutral-500 text-xs font-light line-clamp-1">
                {ad.title || ad.lawyer.bio || 'Experienced legal professional.'}
              </p>
              
              <div className="flex items-center gap-3 pt-2">
                {ad.lawyer.district && (
                  <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 bg-neutral-100 px-2 py-1">
                    {ad.lawyer.district}
                  </div>
                )}
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#bfa37a] bg-[#bfa37a]/10 px-2 py-1">
                  {ad.ctaText || 'View Profile'}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}

/* =========================================================
   3. SidebarAd — Sidebar card format for chats and blogs
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
  const { visibleAds, hasAds } = useAdSlider(placement, 8);

  if (!hasAds || visibleAds.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4">Sponsored Lawyers</p>
      <div className="flex flex-col gap-4">
        {visibleAds.map((ad) => {
          const displayImage = ad.imageUrl || ad.lawyer.profileImageUrl || DEFAULT_LAWYER_IMAGE;
          const linkHref = ad.imageUrl
            ? (ad.targetUrl.startsWith('/') ? `/${locale}${ad.targetUrl}` : ad.targetUrl)
            : `/${locale}/lawyers/${ad.lawyer.id}`;

          return (
            <Link
              key={ad.id}
              href={linkHref}
              onClick={() => trackClick(ad.id)}
              className="block group"
            >
              <div className="border border-neutral-200/60 rounded-none p-4 hover:shadow-md hover:border-neutral-300 transition-all bg-white text-left">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 shrink-0">
                    <img src={displayImage} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate font-serif">{ad.lawyer.fullName}</p>
                    <p className="text-xs text-neutral-500">{ad.lawyer.district || 'Sri Lanka'}</p>
                  </div>
                </div>
                {ad.title && <p className="text-xs text-neutral-700 font-medium mb-2">{ad.title}</p>}
                {ad.lawyer.practiceAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {ad.lawyer.practiceAreas.slice(0, 2).map((area) => (
                      <span key={area} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                        {area}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[10px] font-bold text-[#bfa37a] uppercase tracking-wider group-hover:underline">
                  {ad.ctaText || 'View Profile'} →
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   4. StickyBottomAd — Sticky bottom bar that follows scrolling
   ========================================================= */
export function StickyBottomAd({
  placement,
  locale,
}: {
  placement: string;
  locale: string;
}) {
  const { visibleAds, hasAds } = useAdSlider(placement, 3);
  const [closed, setClosed] = useState(false);

  if (!hasAds || visibleAds.length === 0 || closed) return null;

  const ad = visibleAds[0];
  const displayImage = ad.imageUrl || ad.lawyer.profileImageUrl || DEFAULT_LAWYER_IMAGE;
  const linkHref = ad.targetUrl.startsWith('/') ? `/${locale}${ad.targetUrl}` : ad.targetUrl;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#161616] text-white py-3 px-6 shadow-[0_-8px_30px_rgb(0,0,0,0.15)] border-t border-white/5 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
        {/* Ad Info & Image */}
        <Link 
          href={linkHref}
          onClick={() => trackClick(ad.id)}
          className="flex items-center gap-4 flex-1 min-w-0 group"
        >
          <div className="w-12 h-12 bg-neutral-800 rounded-none overflow-hidden shrink-0 border border-white/10 hidden sm:block">
            <img src={displayImage} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#bfa37a] bg-[#bfa37a]/15 border border-[#bfa37a]/35 px-1.5 py-0.5">Sponsored</span>
              <h4 className="text-xs font-bold text-white truncate font-serif group-hover:text-[#bfa37a] transition-colors">{ad.title || ad.lawyer.fullName}</h4>
            </div>
            <p className="text-[11px] text-neutral-400 line-clamp-1 font-light">{ad.description || ad.lawyer.bio || 'Consult with a verified legal counselor today.'}</p>
          </div>
        </Link>

        {/* CTA & Close button */}
        <div className="flex items-center gap-4 shrink-0">
          <Link 
            href={linkHref}
            onClick={() => trackClick(ad.id)}
          >
            <button className="bg-[#bfa37a] hover:bg-[#a68d67] text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2 flex items-center gap-1 transition-colors">
              {ad.ctaText || 'Consult now'} <ExternalLink className="w-3 h-3" />
            </button>
          </Link>
          <button 
            onClick={() => setClosed(true)}
            className="p-1 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Dismiss Ad"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
