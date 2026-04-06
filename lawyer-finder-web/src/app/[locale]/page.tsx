import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight,
  Globe,
  ArrowUpRight,
  ShieldCheck,
  Search,
  MessageSquare,
  BookOpen,
  Star,
  Languages,
  Scale,
  Gavel
} from 'lucide-react';
import ChatWidget from '@/components/home/ChatWidget';
import HeroChatInput from '@/components/home/HeroChatInput';
import HeroReviewsMarquee from '@/components/home/HeroReviewsMarquee';
import prisma from '@/lib/db';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  // Fetch top 12 approved reviews
  const topReviews = await prisma.review.findMany({
    where: { isApproved: true },
    take: 25,
    include: { lawyer: true, reviewer: true },
    orderBy: { rating: 'desc' }
  });

  const serializedReviews = topReviews.map((r) => ({
    id: r.id,
    reviewerName: r.reviewer?.fullName || undefined,
    rating: r.rating,
    comment: r.comment,
    lawyerName: r.lawyer?.fullName || undefined,
    reviewerImage: r.reviewer?.profileImageUrl || undefined,
  }));

  // Fetch top lawyers for cards section
  const topLawyers = await prisma.lawyerProfile.findMany({
    where: { isVerified: true },
    include: { reviews: { where: { isApproved: true } } },
    take: 8,
    orderBy: { reviews: { _count: 'desc' } }, // Just ordering by most reviewed for demo
  });

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <main className="flex-1">
        
        {/* Dark Hero Section matching the image */}
        <section className="relative bg-[#0a0a0a] text-white min-h-[90vh] flex flex-col pt-20 pb-12 px-6 lg:px-12 xl:px-24">
          {/* Background Image & Overlay */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img 
              src="/hero.png" 
              alt="Lawyer Hero" 
              className="object-cover w-full h-full opacity-70"
            />
            {/* Dark Toplayer Overlay as requested */}
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0f1115]/90 via-transparent to-[#0a0a0a]/90" />
          </div>

          <div className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto flex flex-col items-center justify-center pt-8 text-center">
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-light leading-[1.1] tracking-tight text-white mb-4">
              Chat Smarter, Not Harder <br />
              <span className="font-semibold px-2">Lawyer.ai</span>
            </h1>
            <p className="text-white/60 text-base md:text-lg font-light mb-8 max-w-2xl px-4">
              Your Ultimate AI Chat Partner & Legal Directory – Instant Answers, Endless Knowledge!
            </p>

            <HeroChatInput locale={locale} />
            
            {serializedReviews.length > 0 && (
              <HeroReviewsMarquee reviews={serializedReviews} />
            )}
          </div>
        </section>

        {/* Top Lawyers Section (White Space) */}
        <section className="bg-white py-20 px-6 lg:px-12 xl:px-24">
          <div className="mx-auto max-w-[1400px]">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#0a0a0a] mb-3">
                  Top Legal Professionals
                </h2>
                <p className="text-neutral-500 text-lg font-light">
                  Find verified lawyers for your active legal matters.
                </p>
              </div>
              <Link href={`/${locale}/lawyers`}>
                <Button className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none px-8 py-6 text-sm font-bold uppercase tracking-widest flex items-center gap-2 group">
                  Find Lawyer
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {topLawyers.map((lawyer) => {
                const avgRating = lawyer.reviews.length > 0 
                  ? lawyer.reviews.reduce((s, r) => s + r.rating, 0) / lawyer.reviews.length : 0;
                
                return (
                  <Link key={lawyer.id} href={`/${locale}/lawyers/${lawyer.id}`}>
                    <div className="group relative flex h-[400px] flex-col overflow-hidden rounded-none bg-[#222a35] text-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
                      <div className="relative h-[200px] w-full shrink-0">
                        <img
                          src={lawyer.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                          alt={lawyer.fullName}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#222a35] via-[rgba(214,214,214,0.3)] to-transparent" />
                        
                        {lawyer.languages.length > 0 && (
                          <div className="absolute right-4 top-4 flex h-7 items-center justify-center rounded-none bg-black/40 backdrop-blur-md px-2.5 text-[10px] font-bold uppercase tracking-widest text-white border border-white/10 transition-colors hover:bg-black/60">
                            {lawyer.languages.map((l) => l.slice(0, 2)).join(' • ')}
                          </div>
                        )}
                      </div>
                      <div className="relative z-10 flex flex-1 flex-col px-5 pb-5 -mt-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <h3 className="text-[18px] font-semibold tracking-tight text-white drop-shadow-sm leading-tight mt-1 max-w-[70%] line-clamp-1">
                            {lawyer.fullName}
                          </h3>
                          <div className="shrink-0 rounded-none bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/5 uppercase tracking-widest">
                            {lawyer.baseFeeRange ? `LKR ${lawyer.baseFeeRange.split('-')[0].trim()}` : 'TBD'}
                          </div>
                        </div>
                        <p className="line-clamp-2 text-[13px] text-white/70 leading-relaxed font-light mb-4">
                          {lawyer.bio || 'Experienced legal professional.'}
                        </p>
                        <div className="mt-auto flex gap-2 overflow-hidden whitespace-nowrap mb-6">
                          {avgRating > 0 && (
                            <div className="flex shrink-0 items-center gap-1.5 rounded-none bg-white/10 px-3 py-[5px] text-[10px] font-bold backdrop-blur-md border border-white/5 text-white/90">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {avgRating.toFixed(1)}
                            </div>
                          )}
                          {lawyer.district && (
                            <div className="flex shrink-0 items-center rounded-none bg-white/10 px-3 py-[5px] text-[10px] uppercase font-bold backdrop-blur-md border border-white/5 text-white/90">
                              {lawyer.district}
                            </div>
                          )}
                        </div>
                        <button className="w-full rounded-none bg-white py-3.5 text-[13px] font-bold text-[#222a35] uppercase tracking-widest transition-colors hover:bg-neutral-200 mt-auto">
                          View Profile
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

      </main>

      {/* Persistent AI Chat Widget */}
      <ChatWidget />

      <Footer locale={locale} />
    </div>
  );
}
