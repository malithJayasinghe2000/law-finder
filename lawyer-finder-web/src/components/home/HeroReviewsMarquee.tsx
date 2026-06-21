'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  lawyerName?: string;
  reviewerImage?: string | null;
}

export default function HeroReviewsMarquee({ reviews }: { reviews: Review[] }) {
  const [paused, setPaused] = useState(false);

  // If there are fewer than 10 reviews, just duplicate to make it loop smoothly
  const displayReviews = [...reviews, ...reviews, ...reviews];
  
  const midPoint = Math.ceil(displayReviews.length / 2);
  const row1 = displayReviews.slice(0, midPoint);
  const row2 = displayReviews.slice(midPoint);

  return (
    <div className="w-full mt-10 mb-4 overflow-hidden relative"
         onMouseEnter={() => setPaused(true)}
         onMouseLeave={() => setPaused(false)}>
      
      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .fade-mask {
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
      `}</style>

      <div className="fade-mask w-full">
        {/* Top Row: Right to Left */}
        <div className="flex mb-6 overflow-hidden">
          <div
            className="flex gap-6 whitespace-nowrap"
            style={{
              width: 'max-content',
              animation: 'marquee-left 60s linear infinite',
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            {[...row1, ...row1].map((review, idx) => (
              <ReviewCard key={`r1-${idx}`} review={review} />
            ))}
          </div>
        </div>

        {/* Bottom Row: Left to Right */}
        <div className="flex overflow-hidden">
          <div
            className="flex gap-6 whitespace-nowrap"
            style={{
              width: 'max-content',
              animation: 'marquee-right 60s linear infinite',
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            {[...row2, ...row2].map((review, idx) => (
              <ReviewCard key={`r2-${idx}`} review={review} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="inline-flex flex-col min-w-[340px] max-w-[340px] bg-white border border-neutral-200/60 p-6 shrink-0 whitespace-normal text-left relative shadow-sm">
      {/* Testimonial Stars & Quotes */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4.5 w-4.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
            />
          ))}
        </div>
        <span className="text-[90px] font-serif text-neutral-100/70 leading-none absolute top-2 right-4 pointer-events-none select-none">”</span>
      </div>

      {/* Review text */}
      <p className="text-[13px] text-neutral-500 leading-relaxed font-light mb-6 flex-1 min-h-[60px]">
        &ldquo;{review.comment}
      </p>

      {/* Profile info */}
      <div className="flex items-center gap-3 border-t border-neutral-100 pt-4 mt-auto">
        <img 
          src={review.reviewerImage || '/avatar.png'} 
          alt={review.reviewerName} 
          className="w-11 h-11 rounded-full object-cover border border-neutral-100 bg-neutral-50" 
        />
        <div>
          <p className="text-sm font-serif font-bold text-[#bfa37a] tracking-tight">{review.reviewerName}</p>
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold mt-0.5">
            {review.lawyerName ? `Client of ${review.lawyerName}` : 'Verified Client'}
          </p>
        </div>
      </div>
    </div>
  );
}
