'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Star, MapPin, Languages, ShieldCheck, Phone, Clock, Calendar,
  Briefcase, Scale, Gavel, BookOpen, ArrowRight, ArrowLeft,
  MessageSquare, CalendarCheck, Send, X, Loader2, Globe, User, Zap,
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
  user: { createdAt: string } | null;
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
  const lawyerMarqueeRef = useRef<HTMLDivElement>(null);
  const [reviewPaused, setReviewPaused] = useState(false);
  const [lawyerPaused, setLawyerPaused] = useState(false);

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
      if (!res.ok) throw new Error(data.error);
      toast.success('Review submitted! It will appear after admin approval.');
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
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      {/* ─── Breadcrumb ─── */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-4 flex items-center gap-3 text-sm">
          <Link href={`/${locale}`} className="text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-neutral-300">/</span>
          <Link href={`/${locale}/lawyers`} className="text-neutral-400 hover:text-neutral-900 transition-colors">
            Lawyers
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-semibold">{lawyer.fullName}</span>
        </div>
      </div>

      {/* ─── Main Product-Style Layout ─── */}
      <section className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

          {/* ─── LEFT: Profile Card ─── */}
          <div className="lg:col-span-5">
            <div className="sticky top-28">
              {/* Profile Image Card */}
              <div className="relative group overflow-hidden bg-[#1a1a1a]">
                <img
                  src={lawyer.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                  alt={lawyer.fullName}
                  className="w-full aspect-[4/5] object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />

                {/* Overlay Info */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {lawyer.isVerified && (
                      <div className="flex items-center gap-1.5 text-white/90 text-xs font-medium bg-white/10 backdrop-blur-md w-fit px-3 py-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> BASL Verified
                      </div>
                    )}
                    {lawyer.subscription && (
                      <div className="flex items-center gap-1.5 text-white/90 text-xs font-medium bg-amber-500/80 backdrop-blur-md w-fit px-3 py-1.5">
                        <Zap className="h-3.5 w-3.5" /> {lawyer.subscription.tier}
                      </div>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight mb-1">{lawyer.fullName}</h2>
                  <p className="text-white/70 text-sm font-light">
                    {lawyer.practiceAreas.slice(0, 2).join(' · ') || 'Legal Professional'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-0 flex gap-0">
                <button className="flex-1 flex items-center justify-center gap-2 bg-[#0a0a0a] text-white py-4 text-[15px] font-semibold hover:bg-neutral-800 transition-colors">
                  <CalendarCheck className="h-5 w-5" /> Book Now
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-neutral-200 text-[#0a0a0a] py-4 text-[15px] font-semibold hover:bg-neutral-50 transition-colors">
                  <MessageSquare className="h-5 w-5" /> Chat
                </button>
              </div>

              {/* Quick Stats under card */}
              <div className="mt-0 grid grid-cols-3 border border-t-0 border-neutral-200 divide-x divide-neutral-200">
                <div className="py-4 text-center">
                  <p className="text-xl font-bold text-[#0a0a0a]">{lawyer.reviews.length}</p>
                  <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">Reviews</p>
                </div>
                <div className="py-4 text-center">
                  <p className="text-xl font-bold text-[#0a0a0a]">{avgRating > 0 ? avgRating.toFixed(1) : '--'}</p>
                  <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">Rating</p>
                </div>
                <div className="py-4 text-center">
                  <p className="text-xl font-bold text-[#0a0a0a]">{lawyer.yearsOfExperience || '--'}</p>
                  <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">Years Exp</p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Details ─── */}
          <div className="lg:col-span-7">
            {/* Name & Category Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                {lawyer.isVerified && (
                  <div className="flex items-center gap-1 bg-[#0a0a0a] text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <p>Verified</p>
                  </div>
                )}
                {lawyer.practiceType && (
                  <span className="bg-neutral-100 text-neutral-700 text-[10px] font-bold px-3 py-1 uppercase tracking-widest">{lawyer.practiceType}</span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0a0a0a] mb-2">{lawyer.fullName}</h1>
              <p className="text-lg text-neutral-500 font-light mb-4">
                {lawyer.practiceAreas.join(' · ') || 'Legal Professional'}
              </p>

              {/* Star Rating */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${i < Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-[#0a0a0a]">{avgRating > 0 ? avgRating.toFixed(1) : '0.0'}</span>
                <span className="text-sm text-neutral-400">({lawyer.reviews.length} {lawyer.reviews.length === 1 ? 'Review' : 'Reviews'})</span>
              </div>
            </div>

            {/* Fee Range */}
            <div className="flex items-baseline gap-3 mb-8 pb-8 border-b border-neutral-200">
              <span className="text-3xl font-bold text-[#0a0a0a]">
                {lawyer.baseFeeRange ? `LKR ${lawyer.baseFeeRange}` : 'Contact for pricing'}
              </span>
              <span className="text-sm text-neutral-400 font-light">consultation fee range</span>
            </div>

            {/* Bio */}
            <div className="mb-8 pb-8 border-b border-neutral-200">
              <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-widest mb-4">About</h3>
              <p className="text-neutral-600 leading-relaxed font-light">
                {lawyer.bio || 'This attorney has not yet added a biography. Contact them directly for more information about their practice and expertise.'}
              </p>
            </div>

            {/* Details Grid */}
            <div className="mb-8 pb-8 border-b border-neutral-200">
              <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-widest mb-6">Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {lawyer.district && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 shrink-0">
                      <MapPin className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">District</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{lawyer.district}</p>
                    </div>
                  </div>
                )}

                {lawyer.contactPhone && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 shrink-0">
                      <Phone className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">Phone</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{lawyer.contactPhone}</p>
                    </div>
                  </div>
                )}
                {lawyer.user?.createdAt && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 shrink-0">
                      <Calendar className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">Member Since</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{new Date(lawyer.user.createdAt).getFullYear()}</p>
                    </div>
                  </div>
                )}
                {lawyer.gender && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 shrink-0">
                      <User className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">Gender</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{lawyer.gender}</p>
                    </div>
                  </div>
                )}
                {lawyer.baslNumber && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 shrink-0">
                      <Scale className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">BASL Number</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{lawyer.baslNumber}</p>
                    </div>
                  </div>
                )}
                {lawyer.isNotary && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 shrink-0">
                      <Gavel className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">Notary</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">Yes — Notary Public</p>
                    </div>
                  </div>
                )}
                {lawyer.address && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 shrink-0">
                      <Globe className="h-4 w-4 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">Address</p>
                      <p className="text-sm font-semibold text-[#0a0a0a]">{lawyer.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Practice Areas */}
            <div className="mb-8 pb-8 border-b border-neutral-200">
              <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-[0.2em] mb-6">Practice Areas</h3>
              <div className="flex flex-wrap gap-2">
                {lawyer.practiceAreas.length > 0 ? (
                  lawyer.practiceAreas.map((area) => (
                    <span key={area} className="bg-[#0a0a0a] text-white px-5 py-3 text-sm font-medium">
                      {area}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-neutral-400">No practice areas specified.</p>
                )}
              </div>
            </div>

            {/* Languages */}
            {lawyer.languages.length > 0 && (
              <div className="mb-8 pb-8 border-b border-neutral-200">
                <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-[0.2em] mb-6">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {lawyer.languages.map((lang) => (
                    <span key={lang} className="bg-[#0a0a0a] text-white px-5 py-3 text-sm font-medium">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Courts */}
            {lawyer.courts.length > 0 && (
              <div className="mb-8 pb-8 border-b border-neutral-200">
                <h3 className="text-sm font-bold text-[#0a0a0a] uppercase tracking-[0.2em] mb-6">Courts</h3>
                <div className="flex flex-wrap gap-2">
                  {lawyer.courts.map((court) => (
                    <span key={court} className="border border-neutral-200 text-neutral-600 px-5 py-3 text-sm font-medium">
                      {court}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Reviews Section ─── */}
      <section className="border-t border-neutral-200 bg-[#fafafa]">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-12 lg:py-16">
          {/* Reviews Header */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Client Reviews</h2>
                <p className="text-sm text-neutral-500 font-medium">
                  {lawyer.reviews.length} {lawyer.reviews.length === 1 ? 'review' : 'reviews'} · {avgRating > 0 ? avgRating.toFixed(1) : '0.0'} average
                </p>
              </div>
            </div>
            <button
              onClick={handleWriteReview}
              className="flex items-center gap-2 bg-[#0a0a0a] text-white px-6 py-3 text-sm font-semibold hover:bg-neutral-800 transition-colors"
            >
              <Send className="h-4 w-4" /> Write a Review
            </button>
          </div>

          {/* Reviews Marquee */}
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
                  animation: `marquee-half ${Math.max(25, lawyer.reviews.length * 7)}s linear infinite`,
                  animationPlayState: reviewPaused ? 'paused' : 'running',
                }}
              >
                {/* Double the items for seamless loop */}
                {[...lawyer.reviews, ...lawyer.reviews].map((review, idx) => (
                  <div
                    key={`${review.id}-${idx}`}
                    className="inline-block min-w-[350px] max-w-[400px] bg-white border border-neutral-200 p-6 shrink-0 whitespace-normal"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={review.reviewerImage || '/avatar.png'} 
                          alt={review.reviewerName} 
                          className="w-10 h-10 object-cover border border-neutral-100 bg-neutral-50" 
                        />
                        <div>
                          <p className="text-sm font-semibold text-[#0a0a0a]">{review.reviewerName}</p>
                          <p className="text-[11px] text-neutral-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600 leading-relaxed line-clamp-3">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 p-12 text-center">
              <Star className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-sm text-neutral-500 font-medium">No reviews yet. Be the first to leave a review!</p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Other Lawyers Marquee ─── */}
      {otherLawyers.length > 0 && (
        <section className="border-t border-neutral-200 bg-white py-12 lg:py-16">
          <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 mb-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
                  Explore <span className="text-neutral-400">Other Lawyers</span>
                </h2>
                <p className="text-sm text-neutral-500 mt-1">Discover more verified legal professionals</p>
              </div>
              <Link href={`/${locale}/lawyers`} className="flex items-center gap-2 text-sm font-semibold text-[#0a0a0a] hover:text-neutral-600 transition-colors">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
            <div
              className="overflow-hidden relative flex"
              onMouseEnter={() => setLawyerPaused(true)}
              onMouseLeave={() => setLawyerPaused(false)}
            >
              <div
                className="flex gap-6 pb-6"
                style={{
                  width: 'max-content',
                  animation: `marquee-half ${Math.max(30, otherLawyers.length * 5)}s linear infinite`,
                  animationPlayState: lawyerPaused ? 'paused' : 'running',
                }}
              >
                {[...otherLawyers, ...otherLawyers].map((l, idx) => (
                  <Link key={`${l.id}-${idx}`} href={`/${locale}/lawyers/${l.id}`} className="shrink-0">
                    <div className="group relative flex h-[480px] w-[320px] flex-col overflow-hidden bg-[#222a35] text-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
                      {/* Top Image Area */}
                      <div className="relative h-[240px] w-full shrink-0">
                        <img
                          src={l.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                          alt={l.fullName}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#222a35] via-[rgba(34,42,53,0.3)] to-transparent" />
                        {l.languages && l.languages.length > 0 && (
                          <div className="absolute right-4 top-4 flex h-7 items-center justify-center rounded-none bg-black/40 backdrop-blur-md px-2.5 text-[10px] font-bold uppercase tracking-widest text-white border border-white/10 transition-colors hover:bg-black/60">
                            {l.languages.map((lang) => lang.slice(0, 2)).join(' • ')}
                          </div>
                        )}
                      </div>

                      {/* Content Area */}
                      <div className="relative z-10 flex flex-1 flex-col px-6 pb-6 -mt-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <h3 className="text-[20px] font-bold tracking-tight text-white drop-shadow-sm leading-tight mt-1 max-w-[70%] line-clamp-1">
                            {l.fullName}
                          </h3>
                          <div className="shrink-0 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md border border-white/5 uppercase tracking-wider">
                            {l.baseFeeRange ? `LKR ${l.baseFeeRange.split('-')[0].trim()}` : 'TBD'}
                          </div>
                        </div>

                        <div className="h-[40px] mb-4">
                          <p className="line-clamp-2 text-[13px] text-white/70 leading-snug font-light text-balance">
                            {l.bio || 'Experienced legal professional dedicated to providing precise and strategic guidance.'}
                          </p>
                        </div>

                        <div className="mt-auto flex gap-2 overflow-x-hidden whitespace-nowrap mb-6 scrollbar-hide">
                          {l.avgRating > 0 && (
                            <div className="flex shrink-0 items-center gap-1.5 bg-white/10 px-3 py-[5px] text-[10px] font-bold backdrop-blur-md border border-white/5">
                              <Star className="h-3 w-3 fill-current text-amber-400" />
                              {l.avgRating.toFixed(1)}
                            </div>
                          )}
                          {l.district && (
                            <div className="flex shrink-0 items-center bg-white/10 px-3 py-[5px] text-[10px] font-bold backdrop-blur-md border border-white/5 text-white/90 uppercase tracking-widest">
                              {l.district}
                            </div>
                          )}
                          {l.practiceAreas.slice(0, 1).map((area) => (
                            <div key={area} className="flex shrink-0 items-center bg-white/10 px-3 py-[5px] text-[10px] font-bold backdrop-blur-md border border-white/5 text-white/90 uppercase tracking-widest">
                              {area}
                            </div>
                          ))}
                        </div>

                        <button className="w-full bg-white py-3.5 text-[13px] font-bold text-[#222a35] transition-colors hover:bg-neutral-200 uppercase tracking-widest mt-auto">
                          View Profile
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Review Modal ─── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md mx-4 shadow-2xl border border-neutral-200">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-[#0a0a0a]">Write a Review</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-neutral-400 hover:text-neutral-900 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-3 block">Rating</label>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseEnter={() => setHoveredStar(i + 1)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setReviewRating(i + 1)}
                    >
                      <Star
                        className={`h-8 w-8 transition-colors cursor-pointer ${
                          i < (hoveredStar || reviewRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-neutral-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-3 text-sm font-semibold text-neutral-500">{hoveredStar || reviewRating}/5</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest mb-3 block">Your Review</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience with this lawyer..."
                  rows={4}
                  className="w-full bg-neutral-50 border border-neutral-200 text-[#0a0a0a] px-4 py-3 outline-none focus:border-[#0a0a0a] focus:bg-white transition-all text-sm"
                />
              </div>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={submitReview}
                disabled={reviewLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#0a0a0a] text-white py-4 font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {reviewLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                {reviewLoading ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
