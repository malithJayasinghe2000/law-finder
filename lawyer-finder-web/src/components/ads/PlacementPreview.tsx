'use client';

import React from 'react';
import { type AdPlacementValue, PLACEMENT_PREVIEW, PLACEMENT_DETAILS } from '@/schemas/ad.schema';

interface PlacementPreviewProps {
  placement: AdPlacementValue;
}

export function PlacementPreview({ placement }: PlacementPreviewProps) {
  const preview = PLACEMENT_PREVIEW[placement];
  const details = PLACEMENT_DETAILS[placement];

  if (!preview) return null;

  const renderSkeleton = () => {
    switch (preview.skeletonLayout) {
      case 'full-width':
        return (
          <div className="w-full space-y-4 border border-neutral-100 p-4 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            {/* Mock Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="h-5 w-24 bg-neutral-200 animate-pulse rounded-md" />
              <div className="flex gap-4">
                <div className="h-4 w-12 bg-neutral-150 animate-pulse rounded-md" />
                <div className="h-4 w-12 bg-neutral-150 animate-pulse rounded-md" />
              </div>
            </div>

            {/* Mock Content Above Ad */}
            {placement === 'HOMEPAGE_BELOW_HERO' && (
              <div className="py-6 px-4 bg-neutral-50/50 text-center space-y-3 rounded-xl border border-dashed border-neutral-200/60">
                <div className="h-8 w-2/3 mx-auto bg-neutral-200 animate-pulse rounded-lg" />
                <div className="h-4 w-1/2 mx-auto bg-neutral-150 animate-pulse rounded-md" />
              </div>
            )}

            {/* Highlighted Ad Zone */}
            <div className={`relative ${placement === 'HOMEPAGE_BELOW_HERO' ? 'h-32' : 'h-16'} flex flex-col items-center justify-center border-2 border-dashed ${preview.previewColor} transition-all duration-300 p-4 rounded-xl`}>
              <div className="absolute inset-0 bg-current opacity-5 animate-pulse rounded-xl" />
              <div className="text-center z-10 space-y-1">
                <p className="text-[11px] font-bold tracking-wider text-neutral-800 uppercase">Ad Area: {details.dimensions}</p>
                <p className="text-[10px] text-neutral-500 font-medium">{preview.previewLabel}</p>
              </div>
            </div>

            {/* Mock Content Below Ad */}
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full bg-neutral-100 rounded-md" />
              <div className="h-4 w-5/6 bg-neutral-100 rounded-md" />
              <div className="h-4 w-4/6 bg-neutral-100 rounded-md" />
            </div>
          </div>
        );

      case 'sidebar':
        return (
          <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-4 border border-neutral-100 p-4 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            {/* Main Content Area */}
            <div className="md:col-span-3 space-y-3">
              <div className="h-6 w-1/3 bg-neutral-200 animate-pulse rounded-md" />
              <div className="h-32 w-full bg-neutral-50 rounded-xl border border-neutral-150" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-neutral-100 rounded-md" />
                <div className="h-4 w-5/6 bg-neutral-100 rounded-md" />
              </div>
            </div>

            {/* Sidebar with Ad Highlight */}
            <div className="md:col-span-1 space-y-4">
              <div className="h-5 w-2/3 bg-neutral-200 animate-pulse rounded-md" />
              
              <div className={`relative h-44 flex flex-col items-center justify-center border-2 border-dashed ${preview.previewColor} transition-all duration-300 p-3 text-center rounded-xl`}>
                <div className="absolute inset-0 bg-current opacity-5 animate-pulse rounded-xl" />
                <div className="z-10 space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-neutral-800 uppercase">Ad Area</p>
                  <p className="text-[9px] text-neutral-500 leading-tight font-medium">{details.dimensions}</p>
                  <p className="text-[9px] text-neutral-400 mt-2 font-medium">{preview.previewLabel}</p>
                </div>
              </div>

              <div className="h-16 w-full bg-neutral-50 rounded-lg border border-neutral-150" />
            </div>
          </div>
        );

      case 'sticky-bottom':
        return (
          <div className="w-full relative min-h-[220px] border border-neutral-100 p-4 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            {/* Page content that scrolls */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-neutral-200 rounded-full animate-pulse" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-1/4 bg-neutral-200 animate-pulse rounded-md" />
                  <div className="h-3 w-1/3 bg-neutral-150 animate-pulse rounded-md" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-neutral-100 rounded-md" />
                <div className="h-4 w-11/12 bg-neutral-100 rounded-md" />
              </div>
            </div>

            {/* Pinned Sticky Bottom Ad */}
            <div className={`relative mt-6 w-full h-14 flex items-center justify-center border-2 border-dashed ${preview.previewColor} transition-all duration-300 rounded-xl px-4`}>
              <div className="absolute inset-0 bg-current opacity-5 animate-pulse rounded-xl" />
              <div className="text-center z-10">
                <span className="text-[10px] font-bold text-neutral-800 uppercase mr-2">Bottom Sticky Bar ({details.dimensions})</span>
                <span className="text-[9px] text-neutral-500 font-medium">{preview.previewLabel}</span>
              </div>
            </div>
          </div>
        );

      case 'card-grid':
        return (
          <div className="w-full space-y-4 border border-neutral-100 p-4 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <div className="h-6 w-1/4 bg-neutral-200 animate-pulse rounded-md" />
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* If directory top, the ad is the first card */}
              {placement === 'DIRECTORY_TOP' ? (
                <div className={`relative h-44 flex flex-col items-center justify-center border-2 border-dashed ${preview.previewColor} transition-all duration-300 p-3 text-center rounded-xl`}>
                  <div className="absolute inset-0 bg-current opacity-5 animate-pulse rounded-xl" />
                  <div className="z-10 space-y-1">
                    <span className="text-[9px] bg-neutral-900 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider block mb-1">Sponsored</span>
                    <p className="text-[10px] font-bold text-neutral-800 uppercase">Profile Card</p>
                    <p className="text-[9px] text-neutral-500 font-medium">{preview.previewLabel}</p>
                  </div>
                </div>
              ) : (
                <div className="h-44 bg-neutral-50 rounded-xl border border-neutral-150" />
              )}

              {/* Normal card or inline ad card */}
              {placement === 'DIRECTORY_INLINE' ? (
                <div className={`relative h-44 flex flex-col items-center justify-center border-2 border-dashed ${preview.previewColor} transition-all duration-300 p-3 text-center rounded-xl`}>
                  <div className="absolute inset-0 bg-current opacity-5 animate-pulse rounded-xl" />
                  <div className="z-10 space-y-1">
                    <span className="text-[9px] bg-[#bfa37a] text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider block mb-1">Sponsored</span>
                    <p className="text-[10px] font-bold text-neutral-800 uppercase">Profile Card</p>
                    <p className="text-[9px] text-neutral-500 font-medium">{preview.previewLabel}</p>
                  </div>
                </div>
              ) : (
                <div className="h-44 bg-neutral-50 rounded-xl border border-neutral-150" />
              )}

              <div className="h-44 bg-neutral-50 rounded-xl border border-neutral-150" />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Live Placement Preview</span>
        <span className="text-[10px] text-neutral-500 font-semibold">{details.page} • {details.position}</span>
      </div>
      {renderSkeleton()}
    </div>
  );
}
