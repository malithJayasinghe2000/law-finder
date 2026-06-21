'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Star, MapPin, Languages, ShieldCheck, Phone, Clock, Calendar,
  Briefcase, Scale, Gavel, BookOpen, ArrowRight, ArrowLeft,
  MessageSquare, CalendarCheck, Send, X, Loader2, Globe, User, Zap,
  Facebook, Linkedin
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
  const lawyerMarqueeRef = useRef<HTMLDivElement>(null);
  const [reviewPaused, setReviewPaused] = useState(false);
  const [lawyerPaused, setLawyerPaused] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const handleChatClick = async () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login`);
      return;
    }

    if (currentUserId === lawyer.user?.id) {
      toast.error("You cannot chat with yourself.");
      return;
    }

    if (!lawyer.user?.id) {
      toast.error("This lawyer does not have an active chat account.");
      return;
    }

    setChatLoading(true);
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: lawyer.user?.id || lawyer.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start chat');

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
    <div className="min-h-screen bg-[#fcfbf9]">
      <style>{`
        @keyframes marquee-half {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      {/* ─── Breadcrumb ─── */}
      <div className="border-b border-[#efeae0] bg-[#faf8f6]/80 backdrop-blur-md sticky top-24 z-10">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-4 flex items-center gap-3 text-xs uppercase tracking-widest">
          <Link href={`/${locale}`} className="text-neutral-500 hover:text-[#bfa37a] transition-colors flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <span className="text-neutral-300">/</span>
          <Link href={`/${locale}/lawyers`} className="text-neutral-500 hover:text-[#bfa37a] transition-colors">
            Lawyers
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-serif font-bold tracking-normal normal-case">{lawyer.fullName}</span>
        </div>
      </div>

      {/* ─── Main Product-Style Layout ─── */}
      <section className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">

          {/* ─── LEFT: Profile Card ─── */}
          <div className="lg:col-span-5">
            <div className="sticky top-40">
              {/* Profile Image Card */}
              <div className="relative group overflow-hidden bg-[#1a1a1a] rounded-none border border-[#efeae0] p-3 bg-[#fdfcfb]">
                <div className="relative overflow-hidden bg-neutral-900">
                  <img
                    src={lawyer.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                    alt={lawyer.fullName}
                    className="w-full aspect-[4/5] object-cover transition-transform duration-700 group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Overlay Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {lawyer.isVerified && (
                        <div className="flex items-center gap-1.5 text-white text-[9px] font-bold bg-[#bfa37a] w-fit px-3 py-1.5 uppercase tracking-widest rounded-none">
                          <ShieldCheck className="h-3.5 w-3.5" /> BASL Verified
                        </div>
                      )}
                      {lawyer.subscription && (
                        <div className="flex items-center gap-1.5 text-[#bfa37a] text-[9px] font-bold bg-[#1a1a1a] w-fit px-3 py-1.5 uppercase tracking-widest rounded-none border border-[#efeae0]/30">
                          <Zap className="h-3.5 w-3.5" /> {lawyer.subscription.tier}
                        </div>
                      )}
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-white tracking-tight mb-1">{lawyer.fullName}</h2>
                    <p className="text-white/80 text-xs uppercase tracking-widest font-medium">
                      {lawyer.practiceAreas.slice(0, 2).join(' · ') || 'Legal Professional'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => router.push(`/${locale}/lawyers/${lawyer.id}/book`)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1a1a1a] text-white py-4.5 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all rounded-none"
                >
                  <CalendarCheck className="h-4 w-4" /> Book Now
                </button>
                <button
                  onClick={handleChatClick}
                  disabled={chatLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#faf8f6] border border-[#efeae0] text-[#1a1a1a] py-4.5 text-xs font-bold uppercase tracking-widest hover:bg-[#efeae0]/30 transition-all rounded-none disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  {chatLoading ? 'Starting...' : 'Chat'}
                </button>
              </div>

              {/* Quick Stats under card */}
              <div className="mt-4 grid grid-cols-3 border border-[#efeae0] divide-x divide-[#efeae0] bg-[#faf8f6]">
                <div className="py-4 text-center">
                  <p className="text-xl font-serif font-bold text-[#1a1a1a]">{lawyer.reviews.length}</p>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Reviews</p>
                </div>
                <div className="py-4 text-center">
                  <p className="text-xl font-serif font-bold text-[#1a1a1a]">{avgRating > 0 ? avgRating.toFixed(1) : '--'}</p>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Rating</p>
                </div>
                <div className="py-4 text-center">
                  <p className="text-xl font-serif font-bold text-[#1a1a1a]">{lawyer.yearsOfExperience || '--'}</p>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Years Exp</p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Details ─── */}
          <div className="lg:col-span-7">
            {/* Name & Category Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                {lawyer.isVerified && (
                  <div className="flex items-center gap-1 bg-[#bfa37a] text-white text-[9px] font-bold px-3 py-1.5 uppercase tracking-widest rounded-none">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <p>Verified</p>
                  </div>
                )}
                {lawyer.practiceType && (
                  <span className="bg-[#efeae0]/40 border border-[#efeae0] text-[#1a1a1a] text-[9px] font-bold px-3 py-1.5 uppercase tracking-widest rounded-none">{lawyer.practiceType}</span>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-[#1a1a1a] mb-2">{lawyer.fullName}</h1>
              <p className="text-lg text-[#bfa37a] font-serif italic mb-4">
                {lawyer.practiceAreas.join(' · ') || 'Legal Professional'}
              </p>

              {/* Star Rating */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4.5 w-4.5 ${i < Math.round(avgRating) ? 'fill-[#bfa37a] text-[#bfa37a]' : 'text-neutral-200'}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-serif font-bold text-[#1a1a1a]">{avgRating > 0 ? avgRating.toFixed(1) : '0.0'}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-450">({lawyer.reviews.length} {lawyer.reviews.length === 1 ? 'Review' : 'Reviews'})</span>
              </div>
            </div>

            {/* Fee Range */}
            <div className="flex items-baseline gap-3 mb-8 pb-8 border-b border-[#efeae0]">
              <span className="text-3xl font-serif font-bold text-[#1a1a1a]">
                {lawyer.baseFeeRange ? `LKR ${lawyer.baseFeeRange}` : 'Contact for pricing'}
              </span>
              <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest">consultation fee range</span>
            </div>

            {/* Bio */}
            <div className="mb-8 pb-8 border-b border-[#efeae0]">
              <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-4">About</h3>
              <p className="text-neutral-600 leading-relaxed font-light">
                {lawyer.bio || 'This attorney has not yet added a biography. Contact them directly for more information about their practice and expertise.'}
              </p>
            </div>

            {/* Details Grid */}
            <div className="mb-8 pb-8 border-b border-[#efeae0]">
              <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-6">Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {lawyer.district && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-450 font-bold uppercase tracking-widest">District</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.district}</p>
                    </div>
                  </div>
                )}

                {lawyer.contactPhone && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-450 font-bold uppercase tracking-widest">Phone</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.contactPhone}</p>
                    </div>
                  </div>
                )}
                {lawyer.user?.createdAt && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">Member Since</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{new Date(lawyer.user.createdAt).getFullYear()}</p>
                    </div>
                  </div>
                )}
                {lawyer.gender && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">Gender</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.gender}</p>
                    </div>
                  </div>
                )}
                {lawyer.baslNumber && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Scale className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">BASL Number</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.baslNumber}</p>
                    </div>
                  </div>
                )}
                {lawyer.isNotary && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Gavel className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">Notary</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">Yes — Notary Public</p>
                    </div>
                  </div>
                )}
                {lawyer.address && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] shrink-0 rounded-none">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-widest">Address</p>
                      <p className="text-sm font-serif font-bold text-[#1a1a1a] mt-0.5">{lawyer.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Practice Areas */}
            <div className="mb-8 pb-8 border-b border-[#efeae0]">
              <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-6">Practice Areas</h3>
              <div className="flex flex-wrap gap-2.5">
                {lawyer.practiceAreas.length > 0 ? (
                  lawyer.practiceAreas.map((area) => (
                    <span key={area} className="bg-[#1a1a1a] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-none border border-neutral-800">
                      {area}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold">No practice areas specified.</p>
                )}
              </div>
            </div>

            {/* Languages */}
            {lawyer.languages.length > 0 && (
              <div className="mb-8 pb-8 border-b border-[#efeae0]">
                <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-6">Languages</h3>
                <div className="flex flex-wrap gap-2.5">
                  {lawyer.languages.map((lang) => (
                    <span key={lang} className="bg-[#bfa37a] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-none">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Courts */}
            {lawyer.courts.length > 0 && (
              <div className="mb-8 pb-8 border-b border-[#efeae0]">
                <h3 className="text-xs font-bold text-[#bfa37a] uppercase tracking-[0.2em] mb-6">Courts</h3>
                <div className="flex flex-wrap gap-2.5">
                  {lawyer.courts.map((court) => (
                    <span key={court} className="border border-[#efeae0] bg-[#faf8f6] text-[#1a1a1a] px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-none">
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
      <section className="border-t border-[#efeae0] bg-[#faf8f6]">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-12 lg:py-16">
          {/* Reviews Header */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center bg-[#bfa37a] text-white rounded-none">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-bold tracking-tight text-[#1a1a1a]">Client Reviews</h2>
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider mt-0.5">
                  {lawyer.reviews.length} {lawyer.reviews.length === 1 ? 'review' : 'reviews'} · {avgRating > 0 ? avgRating.toFixed(1) : '0.0'} average
                </p>
              </div>
            </div>
            <button
              onClick={handleWriteReview}
              className="flex items-center gap-2 bg-[#1a1a1a] text-white px-6 py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all rounded-none"
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
                    className="inline-flex flex-col min-w-[340px] max-w-[340px] bg-[#fdfcfb] border border-[#efeae0] p-6 shrink-0 whitespace-normal text-left relative shadow-sm rounded-none"
                  >
                    {/* Testimonial Stars & Quotes */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4.5 w-4.5 ${i < review.rating ? 'fill-[#bfa37a] text-[#bfa37a]' : 'text-neutral-200'}`}
                          />
                        ))}
                      </div>
                      <span className="text-[90px] font-serif text-[#efeae0]/70 leading-none absolute top-2 right-4 pointer-events-none select-none">”</span>
                    </div>

                    {/* Review text */}
                    <p className="text-[13px] text-neutral-600 leading-relaxed font-light mb-6 flex-1 min-h-[60px]">
                      &ldquo;{review.comment}
                    </p>

                    {/* Profile info */}
                    <div className="flex items-center gap-3 border-t border-[#efeae0] pt-4 mt-auto">
                      <img 
                        src={review.reviewerImage || '/avatar.png'} 
                        alt={review.reviewerName} 
                        className="w-11 h-11 rounded-full object-cover border border-[#efeae0] bg-[#faf8f6]" 
                      />
                      <div>
                        <p className="text-sm font-serif font-bold text-[#bfa37a] tracking-tight">{review.reviewerName}</p>
                        <p className="text-[9px] text-neutral-455 uppercase tracking-widest font-bold mt-0.5">
                          {new Date(review.createdAt).toLocaleDateString()} · Verified Client
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#fdfcfb] border border-[#efeae0] p-12 text-center rounded-none">
              <Star className="w-10 h-10 text-[#efeae0] mx-auto mb-3" />
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">No reviews yet. Be the first to leave a review!</p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Other Lawyers Marquee ─── */}
      {otherLawyers.length > 0 && (
        <section className="border-t border-[#efeae0] bg-white py-12 lg:py-16">
          <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 mb-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-serif font-bold tracking-tight text-[#1a1a1a]">
                  Explore <span className="text-neutral-400">Other Lawyers</span>
                </h2>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">Discover more verified legal professionals</p>
              </div>
              <Link href={`/${locale}/lawyers`} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1a1a1a] hover:text-[#bfa37a] transition-colors">
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
                {[...otherLawyers, ...otherLawyers].map((l, idx) => {
                  const primaryArea = l.practiceAreas[0] || 'Legal Counsel';
                  return (
                    <Link key={`${l.id}-${idx}`} href={`/${locale}/lawyers/${l.id}`} className="shrink-0">
                      <div className="group flex flex-col items-start bg-[#fdfcfb] border border-[#efeae0] p-4 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 w-[320px] rounded-none">
                        {/* Image frame with hover B&W filter logic */}
                        <div className="relative w-full h-[280px] overflow-hidden bg-[#faf8f6]">
                          <img
                            src={l.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                            alt={l.fullName}
                            className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                          />
                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-5">
                            {/* Top-left: Languages they accept (instead of social buttons) */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {l.languages.map((lang) => (
                                <span key={lang} className="text-[8px] bg-[#bfa37a]/90 text-white font-bold uppercase tracking-widest px-2 py-0.5 border border-white/10 rounded-none">
                                  {lang}
                                </span>
                              ))}
                            </div>
                            <div>
                              <h3 className="text-white text-base font-serif font-bold mb-0.5">{l.fullName}</h3>
                              <p className="text-[#bfa37a] text-[9px] font-bold uppercase tracking-widest">{primaryArea}</p>
                            </div>
                          </div>
                        </div>

                        {/* Display Info below card */}
                        <div className="w-full pt-4 space-y-2 text-left">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#bfa37a]">
                            {primaryArea}
                          </span>
                          <h4 className="text-neutral-900 font-serif font-bold text-base transition-colors group-hover:text-[#bfa37a]">
                            {l.fullName}
                          </h4>
                          <p className="text-neutral-400 text-xs font-light line-clamp-1">
                            {l.bio || 'Vetted legal counsel ready for guidance.'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Review Modal ─── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#fdfcfb] w-full max-w-md mx-4 shadow-2xl border border-[#efeae0] rounded-none">
            <div className="flex items-center justify-between p-6 border-b border-[#efeae0]">
              <h3 className="text-lg font-serif font-bold text-[#1a1a1a]">Write a Review</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-neutral-400 hover:text-[#bfa37a] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[9px] font-bold text-[#bfa37a] uppercase tracking-widest mb-3 block">Rating</label>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseEnter={() => setHoveredStar(i + 1)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setReviewRating(i + 1)}
                    >
                      <Star
                        className={`h-8 w-8 transition-colors cursor-pointer ${i < (hoveredStar || reviewRating)
                            ? 'fill-[#bfa37a] text-[#bfa37a]'
                            : 'text-neutral-200'
                          }`}
                      />
                    </button>
                  ))}
                  <span className="ml-3 text-xs font-serif font-bold text-neutral-500">{hoveredStar || reviewRating}/5</span>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-[#bfa37a] uppercase tracking-widest mb-3 block">Your Review</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience with this lawyer..."
                  rows={4}
                  className="w-full bg-[#faf8f6] border border-[#efeae0] text-[#1a1a1a] px-4 py-3 outline-none focus:border-[#bfa37a] focus:bg-white transition-all text-sm rounded-none font-light placeholder:text-neutral-400"
                />
              </div>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={submitReview}
                disabled={reviewLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#1a1a1a] text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all rounded-none disabled:opacity-50"
              >
                {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {reviewLoading ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
