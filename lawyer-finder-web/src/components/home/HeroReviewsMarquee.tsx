'use client';

import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  lawyerName?: string;
  reviewerImage?: string | null;
}

export default function HeroReviewsMarquee({ reviews }: { reviews: Review[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setItemsPerPage(3);
      } else if (window.innerWidth >= 768) {
        setItemsPerPage(2);
      } else {
        setItemsPerPage(1);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxIndex = Math.max(0, reviews.length - itemsPerPage);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? maxIndex : prev - 1));
  };

  if (!reviews || reviews.length === 0) return null;

  return (
    <div className="w-full max-w-[1200px] mx-auto py-12 px-4">
      {/* Title / Header for reviews */}
      <div className="text-center mb-10">
        <p className="text-[#ffb84f] text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] mb-3">
          Client Testimonials
        </p>
        <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#0a0d14] font-Outfit">
          What Our Clients Say
        </h2>
      </div>

      {/* Carousel Wrapper */}
      <div className="relative overflow-hidden -mx-3 py-4">
        <div 
          className="flex transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / itemsPerPage)}%)`,
          }}
        >
          {reviews.map((review) => (
            <div 
              key={review.id}
              className="w-full md:w-1/2 lg:w-1/3 shrink-0 px-3 flex flex-col"
            >
              <ReviewCard review={review} />
            </div>
          ))}
        </div>
      </div>

      {/* Arrows Navigation Below */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={prevSlide}
          className="flex items-center justify-center w-12 h-12 rounded-full border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
          aria-label="Previous review"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={nextSlide}
          className="flex items-center justify-center w-12 h-12 rounded-full border border-[] bg-white text-neutral-800 hover:bg-neutral-50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
          aria-label="Next review"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="flex flex-col h-full bg-white border border-[#d2d2d2] p-8 rounded-[24px] md:rounded-[32px] shadow-[0_15px_40px_rgba(0,0,0,0.03)] text-left transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] hover:-translate-y-1 duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-neutral-100 bg-neutral-50 shrink-0">
            <img 
              src={review.reviewerImage || '/avatar.png'} 
              alt={review.reviewerName} 
              className="w-full h-full object-cover" 
            />
          </div>
          <div>
            <p className="text-[15px] font-bold text-neutral-900 tracking-tight leading-none mb-1">{review.reviewerName}</p>
            {review.lawyerName && (
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.12em]">
                {review.lawyerName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < review.rating ? 'fill-[#ffb84f] text-[#ffb84f]' : 'text-neutral-200'}`}
            />
          ))}
        </div>
      </div>
      <p className="text-sm font-light text-neutral-600 leading-relaxed italic flex-1">
        "{review.comment}"
      </p>
    </div>
  );
}
