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
    <div className="inline-flex flex-col min-w-[320px] max-w-[320px] bg-[#1a1a1a]/60 backdrop-blur-md border border-white/10 p-5 rounded-none shrink-0 whitespace-normal text-left">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img 
            src={review.reviewerImage || '/avatar.png'} 
            alt={review.reviewerName} 
            className="w-10 h-10 object-cover border border-white/10 bg-[#1a1a1a]" 
          />
          <div>
            <p className="text-sm font-bold text-white tracking-tight">{review.reviewerName}</p>
            {review.lawyerName && <p className="text-[10px] text-white/50 uppercase tracking-widest">{review.lawyerName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-white/10'}`}
            />
          ))}
        </div>
      </div>
      <p className="text-sm text-white/70 leading-relaxed line-clamp-3 font-light">"{review.comment}"</p>
    </div>
  );
}
