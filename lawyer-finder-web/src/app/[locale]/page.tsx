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
import { AdBanner, SponsoredListing } from '@/components/ads/AdComponents';
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

  const serializedReviews = topReviews
    .filter((r) => r.lawyer?.fullName)
    .map((r) => ({
      id: r.id,
      reviewerName: r.reviewer?.fullName || 'Anonymous',
      rating: r.rating,
      comment: r.comment,
      lawyerName: r.lawyer!.fullName,
      reviewerImage: r.reviewer?.profileImageUrl || '',
    }));

  // Fetch top lawyers for cards section
  const topLawyers = await prisma.lawyerProfile.findMany({
    where: { isVerified: true },
    include: { reviews: { where: { isApproved: true } } },
    take: 8,
    orderBy: { reviews: { _count: 'desc' } }, // Just ordering by most reviewed for demo
  });

  return (
    <div className="flex min-h-screen flex-col font-sans bg-white selection:bg-[#ffb84f] selection:text-black">
      <main className="flex-1">
        
        {/* Dark Hero Section matching the image */}
        <section className="relative bg-[#0d1017] text-white min-h-[100vh] flex flex-col pt-23 pb-24 px-6 lg:px-12 xl:px-24 overflow-hidden">
          {/* Subtle Background glow/gradient if needed */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-[#0d1017]" />

          <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto flex flex-col items-center pt-10 text-center">
            
            {/* Top Logo / Icon */}
            <div className="mb-6 flex justify-center">
              <Scale className="w-10 h-10 text-[#ffb84f] stroke-1" />
            </div>

           
            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-[68px] font-medium leading-[1.05] tracking-tight text-white mb-6">
              Chat Smarter, Not Harder <br />
              with <span className="text-white">Lawyer.ai</span>
            </h1>

            {/* Subtext */}
            <p className="text-[#a0a4ab] text-base md:text-[17px] font-light mb-10 max-w-[600px] px-4 leading-relaxed">
              Your Ultimate AI Chat Partner & Legal Directory giving you instant answers, and connecting you to trusted experts when you need them most.
            </p>

            {/* Action Buttons & AI Chat Input */}
            <div className="flex flex-col items-center w-full max-w-3xl mb-16 gap-6">
              <div className="w-full">
                <HeroChatInput locale={locale} />
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
                <Link href={`/${locale}/lawyers`}>
                  <Button className="bg-[#ffb84f] hover:bg-[#e5a443] text-black h-12 px-8 rounded-full text-[13px] font-bold tracking-wide transition-all shadow-[0_8px_30px_rgba(255,184,79,0.2)]">
                    Find a Lawyer
                  </Button>
                </Link>
                <Link href={`/${locale}/auth/login`}>
                  <Button className="bg-transparent border border-white/20 text-white hover:bg-white hover:text-black h-12 px-8 rounded-full text-[13px] font-bold tracking-wide transition-all">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>

            {/* Side-by-side Hero Images */}
            {/* <div className="w-full flex flex-col md:flex-row gap-4 max-w-5xl mx-auto mb-16">
              <div className="flex-1 h-[280px] md:h-[400px] rounded-[32px] overflow-hidden relative group">
                <img 
                  src="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800" 
                  alt="Legal Consultation" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20" />
              </div>
              <div className="flex-1 h-[280px] md:h-[400px] rounded-[32px] overflow-hidden relative group hidden sm:block">
                <img 
                  src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=800" 
                  alt="Business Meeting" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20" />
              </div>
            </div> */}

          </div>
        </section>

        {/* Marquee & Ads wrapper section */}
        <section className="bg-[#f1f1f1] pt-10 pb-16">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-24">
            {serializedReviews.length > 0 && (
              <div className="mb-12">
                <HeroReviewsMarquee reviews={serializedReviews} />
              </div>
            )}
            <AdBanner placement="HOMEPAGE_HERO" locale={locale} className="w-full max-w-4xl mx-auto rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]" />
          </div>
        </section>

        {/* About Us section matching design */}
        <section className="bg-white py-20 px-6 lg:px-12 xl:px-24">
          <div className="mx-auto max-w-[1200px]">
            
            <div className="flex flex-col lg:flex-row items-start justify-between gap-16">
              
              {/* Left text block */}
              <div className="lg:w-1/2">
                <div className="inline-block bg-[#ffb84f] text-[#0d1017] text-[10px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-[0.15em] mb-6">
                  About Us
                </div>
                <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-[#0a0d14] mb-6 leading-[1.1]">
                  Who are we
                </h2>
                <p className="text-[#555] text-lg font-light leading-relaxed">
                  Our legal platform is committed to providing <span className="font-medium text-[#0a0d14]">expert, client-focused legal services</span> across a range of practice areas. With deep experience and a results-driven approach, we deliver strategic solutions tailored to each client's unique needs.
                </p>
                <div className="mt-8">
                  <AdBanner placement="HOMEPAGE_MID" locale={locale} className="w-full shadow-sm rounded-3xl" />
                </div>
              </div>

              {/* Right content / grid cards matching the design */}
              <div className="lg:w-1/2 flex flex-col">
                <p className="text-xl md:text-2xl font-medium text-[#0a0d14] leading-snug mb-8">
                  Delivering practical solutions through a trusted tech-driven legal approach.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#f2f1f1] border border-neutral-100 p-8 rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.02)]">
                    <div className="w-10 h-10 mb-6 flex items-center justify-center bg-[#ffb84f]/10 rounded-2xl">
                      <Star className="text-[#ffb84f] w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-[#0a0d14] text-lg mb-3">Instant AI Advice</h3>
                    <p className="text-sm font-light text-neutral-500 leading-relaxed">
                      Leverage context-aware legal AI to securely get answers to your most pressing questions instantly.
                    </p>
                  </div>
                  
                  <div className="bg-[#f2f1f1] border border-neutral-100 p-8 rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.02)]">
                    <div className="w-10 h-10 mb-6 flex items-center justify-center bg-[#ffb84f]/10 rounded-2xl">
                      <ShieldCheck className="text-[#ffb84f] w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-[#0a0d14] text-lg mb-3">Verified Experts</h3>
                    <p className="text-sm font-light text-neutral-500 leading-relaxed">
                      Connect with fully verified, top-tier attorneys specialized in various legal sectors.
                    </p>
                  </div>

                  <div className="bg-[#f2f1f1] border border-neutral-100 p-8 rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.02)]">
                    <div className="w-10 h-10 mb-6 flex items-center justify-center bg-[#ffb84f]/10 rounded-2xl">
                      <Globe className="text-[#ffb84f] w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-[#0a0d14] text-lg mb-3">Multilingual</h3>
                    <p className="text-sm font-light text-neutral-500 leading-relaxed">
                      Our system and attorneys natively support English, Sinhala, and Tamil seamlessly.
                    </p>
                  </div>

                  <div className="bg-[#f2f1f1] border border-neutral-100 p-8 rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.02)]">
                    <div className="w-10 h-10 mb-6 flex items-center justify-center bg-[#ffb84f]/10 rounded-2xl">
                      <Gavel className="text-[#ffb84f] w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-[#0a0d14] text-lg mb-3">Secure Intake</h3>
                    <p className="text-sm font-light text-neutral-500 leading-relaxed">
                      Private, encrypted chat sessions directly with professionals before setting up a consultation.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* Top Lawyers Section styled like the Portfolio / Team section */}
        <section className="bg-[#f1f1f1] py-24 px-6 lg:px-12 xl:px-24 border-t border-neutral-200/50">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div>
                <div className="inline-block bg-[#ffb84f] text-[#0d1017] text-[10px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-[0.15em] mb-4">
                  Team
                </div>
                <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-[#0a0d14] mb-4">
                  Meet our expert team
                </h2>
                <p className="text-neutral-500 text-lg font-light max-w-xl">
                  Find verified lawyers for your active legal matters. Our directory connects you with elite legal professionals.
                </p>
              </div>
              <Link href={`/${locale}/lawyers`}>
                <Button className="bg-[#ffb84f] text-black hover:bg-[#e5a443] rounded-full px-8 h-12 text-sm font-bold tracking-wide transition-all group">
                  View Directory
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            {/* Sponsored Listing */}
            <div className="mb-10 w-full rounded-3xl overflow-hidden">
               <SponsoredListing placement="DIRECTORY_TOP" locale={locale} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {topLawyers.map((lawyer) => {
                const avgRating = lawyer.reviews.length > 0 
                  ? lawyer.reviews.reduce((s, r) => s + r.rating, 0) / lawyer.reviews.length : 0;
                
                return (
                  <Link key={lawyer.id} href={`/${locale}/lawyers/${lawyer.id}`}>
                    <div className="group relative flex h-[460px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_15px_40px_rgba(0,0,0,0.04)] border border-neutral-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
                      <div className="relative h-[210px] w-full shrink-0 overflow-hidden bg-neutral-100">
                        <img
                          src={lawyer.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                          alt={lawyer.fullName}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {/* Overlay to structure image text if needed */}
                      </div>
                      
                      <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
                        
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-xl font-medium tracking-tight text-[#0a0d14] line-clamp-1">
                            {lawyer.fullName}
                          </h3>
                        </div>

                        <p className="line-clamp-2 text-sm text-neutral-500 font-light mb-4">
                          {lawyer.bio || 'Experienced legal professional committed to achieving favorable legal outcomes.'}
                        </p>
                        
                        <div className="mt-auto flex flex-wrap gap-2 mb-5">
                          {avgRating > 0 && (
                            <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-600">
                              <Star className="h-3 w-3 fill-orange-500 text-orange-500" />
                              {avgRating.toFixed(1)}
                            </div>
                          )}
                          {lawyer.district && (
                            <div className="flex items-center rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600 uppercase tracking-wider">
                              {lawyer.district}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-auto border-t border-neutral-100 pt-4">
                          <span className="text-sm font-semibold text-[#0a0d14]">
                            {lawyer.baseFeeRange ? `LKR ${lawyer.baseFeeRange.split('-')[0].trim()}` : 'TBD'}
                          </span>
                          <span className="flex items-center text-[12px] font-bold text-[#ffb84f] uppercase tracking-wider group-hover:text-[#e5a443] transition-colors">
                            Profile <ArrowUpRight className="w-3 h-3 ml-1" />
                          </span>
                        </div>

                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ Style section / Features  */}
        <section className="bg-[#0d1017] py-24 px-6 lg:px-12 xl:px-24">
          <div className="mx-auto max-w-[800px] text-center mb-16">
            <div className="inline-block bg-[#ffb84f] text-[#0d1017] text-[10px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-[0.15em] mb-6">
              Platform Features
            </div>
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white mb-6">
              Everything you need for cutting-edge legal consultation
            </h2>
          </div>

          <div className="mx-auto max-w-[1000px] grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature block 1 styled like the yellow card from design */}
            <div className="bg-[#ffb84f] rounded-3xl p-8 md:p-10 flex flex-col text-black h-[280px]">
              <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center mb-2">
                 <Languages className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-2xl font-medium mb-4 mt-2 tracking-tight">AI Multi-lingual Assistant</h3>
              <p className="text-black/70 font-medium text-sm">
                Chat or speak in English, Sinhala, or Tamil. Our AI instantly translates and understands complex legal inquiries.
              </p>
            </div>
            
            {/* Feature block 2 styled like the white card from design */}
            <div className="bg-white rounded-3xl p-8 md:p-10 flex flex-col text-[#0a0d14] h-[280px]">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-2">
                 <BookOpen className="w-6 h-6 text-[#0a0d14]" />
              </div>
              <h3 className="text-2xl font-medium mb-4 mt-2 tracking-tight">Vast Knowledge Base</h3>
              <p className="text-neutral-500 font-light text-sm">
                Retrieval-Augmented Generation (RAG) powered by verified local legal documents and past successful case references.
              </p>
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
