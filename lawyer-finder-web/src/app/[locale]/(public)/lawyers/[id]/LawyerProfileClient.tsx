'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Star,
  MapPin,
  Languages,
  ShieldCheck,
  Phone,
  CalendarCheck,
  MessageSquare,
  Send,
  Loader2,
  User,
  Zap,
  Scale,
  Gavel,
  BookOpen,
} from 'lucide-react';

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerImage: string | null;
}

interface Subscription {
  id: string;
  tier: string;
  planName: string;
  status: string;
  billingCycle: string;
  startDate: string;
  nextBilling: string;
}

interface LawyerData {
  id: string;
  fullName: string;
  baslNumber: string;
  nic: string | null;
  address: string | null;
  contactPhone: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  practiceAreas: string[];
  languages: string[];
  district: string | null;
  baseFeeRange: string | null;
  gender: string | null;
  yearsOfExperience: number | null;
  practiceType: string | null;
  courts: string[];
  isNotary: boolean;
  isVerified: boolean;
  user: { id: string; createdAt: string } | null;
  reviews: Review[];
  subscription?: Subscription | null;
}

interface OtherLawyer {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  bio: string | null;
  practiceAreas: string[];
  district: string | null;
  baseFeeRange: string | null;
  avgRating: number;
  reviewCount: number;
  languages: string[];
}

interface Props {
  lawyer: LawyerData;
  avgRating: number;
  otherLawyers: OtherLawyer[];
  locale: string;
  isLoggedIn: boolean;
  currentUserId: string | null;
}

export default function LawyerProfileClient({
  lawyer,
  avgRating,
  otherLawyers,
  locale,
  isLoggedIn,
  currentUserId,
}: Props) {
  const router = useRouter();

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

  const reviewMarqueeRef = useRef<HTMLDivElement>(null);

  const [reviewPaused, setReviewPaused] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const handleChatClick = async () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login`);
      return;
    }

    if (currentUserId === lawyer.user?.id) {
      toast.error('You cannot chat with yourself.');
      return;
    }

    if (!lawyer.user?.id) {
      toast.error('This lawyer does not have an active chat account.');
      return;
    }

    setChatLoading(true);

    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: lawyer.user.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start chat');
      }

      router.push(`/${locale}/messages?conv=${data.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Error starting chat');
      setChatLoading(false);
    }
  };

  const handleWriteReview = () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login`);
      return;
    }

    setShowReviewModal(true);
  };

  const submitReview = async () => {
    if (!reviewComment.trim()) {
      toast.error('Please write a comment.');
      return;
    }

    setReviewLoading(true);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lawyerId: lawyer.id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      toast.success(
        'Review submitted! It will appear after admin approval.'
      );

      setShowReviewModal(false);
      setReviewComment('');
      setReviewRating(5);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review.');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes marquee-half {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>

      {/* Main Layout */}
      <section className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-12 lg:py-20">
        {/* Breadcrumb */}
        <div className="mb-10 flex items-center gap-2 text-sm">
          <Link
            href={`/${locale}`}
            className="text-neutral-400 hover:text-[#0a0d14] font-medium transition-colors"
          >
            Home
          </Link>

          <span className="text-neutral-300">/</span>

          <Link
            href={`/${locale}/lawyers`}
            className="text-neutral-400 hover:text-[#0a0d14] font-medium transition-colors"
          >
            Directory
          </Link>

          <span className="text-neutral-300">/</span>

          <span className="text-[#0a0d14] font-bold">
            {lawyer.fullName}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          {/* LEFT */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 space-y-6">
              {/* Profile Card */}
              <div className="relative group overflow-hidden bg-[#0d1017] rounded-3xl shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
                <img
                  src={
                    lawyer.profileImageUrl ||
                    'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'
                  }
                  alt={lawyer.fullName}
                  className="w-full aspect-[4/5] object-cover transition-transform duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14]/90 via-[#0a0d14]/20 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {lawyer.isVerified && (
                      <div className="flex items-center gap-1.5 text-black text-xs font-bold bg-[#ffb84f] uppercase tracking-wider rounded-full px-3 py-1.5 shadow-sm">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verified
                      </div>
                    )}

                    {lawyer.subscription && (
                      <div className="flex items-center gap-1.5 text-white text-xs font-bold bg-white/20 backdrop-blur-md uppercase tracking-wider rounded-full px-3 py-1.5">
                        <Zap className="h-3.5 w-3.5 text-[#ffb84f]" />
                        {lawyer.subscription.tier}
                      </div>
                    )}
                  </div>

                  <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
                    {lawyer.fullName}
                  </h2>

                  <p className="text-white/80 text-sm font-light">
                    {lawyer.practiceAreas.slice(0, 2).join(' · ') ||
                      'Legal Professional'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() =>
                    router.push(
                      `/${locale}/lawyers/${lawyer.id}/book`
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-2 bg-[#ffb84f] text-black py-4 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-[#e5a443] transition-all"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Book Now
                </button>

                <button
                  onClick={handleChatClick}
                  disabled={chatLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#0a0d14] text-white py-4 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-70"
                >
                  {chatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}

                  {chatLoading ? 'Starting...' : 'Chat User'}
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-neutral-50 px-4 py-5 rounded-2xl text-center border border-neutral-100">
                  <p className="text-2xl font-bold text-[#0a0d14]">
                    {lawyer.reviews.length}
                  </p>

                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                    Reviews
                  </p>
                </div>

                <div className="bg-neutral-50 px-4 py-5 rounded-2xl text-center border border-neutral-100">
                  <p className="text-2xl font-bold text-[#0a0d14]">
                    {avgRating > 0 ? avgRating.toFixed(1) : '--'}
                  </p>

                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                    Rating
                  </p>
                </div>

                <div className="bg-neutral-50 px-4 py-5 rounded-2xl text-center border border-neutral-100">
                  <p className="text-2xl font-bold text-[#0a0d14]">
                    {lawyer.yearsOfExperience || '--'}
                  </p>

                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                    Years Exp
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-7 pt-4">
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                {lawyer.practiceType && (
                  <span className="bg-[#0a0d14] text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">
                    {lawyer.practiceType}
                  </span>
                )}

                {lawyer.isNotary && (
                  <span className="bg-neutral-100 text-neutral-600 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">
                    Notary Public
                  </span>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#0a0d14] mb-3 leading-tight">
                {lawyer.fullName}
              </h1>

              <p className="text-xl text-neutral-500 font-light mb-6">
                {lawyer.practiceAreas.join(' · ') || 'Legal Counsel'}
              </p>
            </div>

            {/* Bio */}
            <div className="mb-12">
              <h3 className="text-xl font-bold text-[#0a0d14] mb-6 flex items-center gap-2">
                <User className="h-5 w-5 text-[#ffb84f]" />
                Professional Biography
              </h3>

              <div className="bg-neutral-50 p-8 rounded-3xl text-neutral-600 font-light leading-relaxed whitespace-pre-wrap text-lg">
                {lawyer.bio ||
                  'This attorney has not yet added a biography.'}
              </div>
            </div>

            {/* Practice Areas */}
            {lawyer.practiceAreas.length > 0 && (
              <div className="mb-12">
                <h3 className="text-xl font-bold text-[#0a0d14] mb-6 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-[#ffb84f]" />
                  Core Expertise
                </h3>

                <div className="flex flex-wrap gap-2">
                  {lawyer.practiceAreas.map((area, idx) => (
                    <span
                      key={idx}
                      className="bg-white border border-neutral-200 text-[#0a0d14] px-5 py-2.5 rounded-full text-sm font-medium"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Courts */}
            {lawyer.courts.length > 0 && (
              <div className="mb-16">
                <h3 className="text-xl font-bold text-[#0a0d14] mb-6 flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-[#ffb84f]" />
                  Courts of Practice
                </h3>

                <div className="flex flex-wrap gap-2">
                  {lawyer.courts.map((court, idx) => (
                    <span
                      key={idx}
                      className="bg-[#0a0d14] text-white px-5 py-2.5 rounded-full text-sm font-medium"
                    >
                      {court}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="border-t border-neutral-200 bg-[#fafafa]">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-12 lg:py-16">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white rounded-full">
                <Star className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
                  Client Reviews
                </h2>

                <p className="text-sm text-neutral-500 font-medium">
                  {lawyer.reviews.length}{' '}
                  {lawyer.reviews.length === 1
                    ? 'review'
                    : 'reviews'}{' '}
                  ·{' '}
                  {avgRating > 0
                    ? avgRating.toFixed(1)
                    : '0.0'}{' '}
                  average
                </p>
              </div>
            </div>

            <button
              onClick={handleWriteReview}
              className="flex items-center gap-2 bg-[#0a0a0a] text-white px-6 py-3 text-sm font-semibold hover:bg-neutral-800 transition-colors rounded-full"
            >
              <Send className="h-4 w-4" />
              Write a Review
            </button>
          </div>

          {lawyer.reviews.length > 0 ? (
            <div
              className="overflow-hidden relative flex"
              onMouseEnter={() => setReviewPaused(true)}
              onMouseLeave={() => setReviewPaused(false)}
            >
              <div
                ref={reviewMarqueeRef}
                className="flex gap-6 whitespace-nowrap"
                style={{
                  width: 'max-content',
                  animation: `marquee-half ${Math.max(
                    25,
                    lawyer.reviews.length * 7
                  )}s linear infinite`,
                  animationPlayState: reviewPaused
                    ? 'paused'
                    : 'running',
                }}
              >
                {[...lawyer.reviews, ...lawyer.reviews].map(
                  (review, idx) => (
                    <div
                      key={`${review.id}-${idx}`}
                      className="inline-block min-w-[350px] max-w-[400px] bg-white border border-neutral-200 p-6 shrink-0 whitespace-normal"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              review.reviewerImage ||
                              '/avatar.png'
                            }
                            alt={review.reviewerName}
                            className="w-10 h-10 object-cover border border-neutral-100 bg-neutral-50"
                          />

                          <div>
                            <p className="text-sm font-semibold text-[#0a0a0a]">
                              {review.reviewerName}
                            </p>

                            <p className="text-[11px] text-neutral-400">
                              {new Date(
                                review.createdAt
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map(
                            (_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < review.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-neutral-200'
                                }`}
                              />
                            )
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-neutral-600 leading-relaxed line-clamp-3">
                        {review.comment}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 p-12 text-center">
              <Star className="w-10 h-10 text-neutral-200 mx-auto mb-3" />

              <p className="text-sm text-neutral-500 font-medium">
                No reviews yet. Be the first to leave a review!
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}