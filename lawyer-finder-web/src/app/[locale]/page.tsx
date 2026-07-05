import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Star,
  Scale,
  Building2,
  Gavel,
  ShieldCheck,
  FileText,
  PhoneCall,
  Facebook,
  Linkedin
} from 'lucide-react';
import ChatWidget from '@/components/home/ChatWidget';
import HeroChatInput from '@/components/home/HeroChatInput';

import { AdBanner, SponsoredListing } from '@/components/ads/AdComponents';
import prisma from '@/lib/db';
import LawyerCard from '@/components/lawyer/LawyerCard';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });



  // Fetch top lawyers for cards section
  const topLawyers = await prisma.lawyerProfile.findMany({
    where: { isVerified: true },
    take: 8,
  });

  // Fetch actual active user count (Clients & Lawyers)
  const userCount = await prisma.user.count({
    where: { role: { in: ['LAWYER'] } }
  });

  return (
    <div className="flex min-h-screen flex-col font-sans bg-white selection:bg-[#bfa37a]/30">
      <main className="flex-1">

        {/* 1. Premium White Hero Section */}
        <section className="relative bg-white pt-36 pb-16 px-6 lg:px-12 xl:px-24 overflow-hidden border-b border-neutral-100">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-8 space-y-8">
              <h1 className="text-4xl sm:text-6xl font-serif text-neutral-900 leading-[1.1] tracking-tight">
                Defending Your Rights <br />
                Delivering 
                <span className="inline-flex items-center mx-3 bg-neutral-500 rounded-full h-9 w-20 sm:h-12 sm:w-24 overflow-hidden relative align-middle">
                  <img 
                    src="/justieswomen.png" 
                    className="object-cover object-top w-full h-full scale-125 opacity-80 bg-white" 
                    alt="Justice Decor" 
                  />
                </span>
                Justice
              </h1>

              <p className="text-neutral-500 text-base sm:text-lg max-w-xl font-light leading-relaxed">
                Welcome to LawHub, where our team of experienced attorneys is dedicated to providing you with the best. Sri Lanka&apos;s leading legal SaaS platform.
              </p>

              {/* Action Buttons & Badges */}
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-wrap items-center gap-4">
                  <Link href={`/${locale}/lawyers`}>
                    <Button className="bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none px-8 py-6 text-xs font-bold uppercase tracking-widest transition-all">
                      Find Lawyers
                    </Button>
                  </Link>
                  <Link href={`/${locale}/chat`}>
                    <Button variant="outline" className="border border-[#bfa37a] text-[#bfa37a] hover:bg-[#bfa37a]/5 rounded-none px-8 py-6 text-xs font-bold uppercase tracking-widest transition-all">
                      Chat With AI
                    </Button>
                  </Link>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    <img src="/assets/images/home1/author1.png" className="w-9 h-9 rounded-full border-2 border-white object-cover shadow-sm" alt="Client 1" />
                    <img src="/assets/images/home1/author2.png" className="w-9 h-9 rounded-full border-2 border-white object-cover shadow-sm" alt="Client 2" />
                    <img src="/assets/images/home1/author3.png" className="w-9 h-9 rounded-full border-2 border-white object-cover shadow-sm" alt="Client 3" />
                    <div className="w-9 h-9 rounded-full border-2 border-white bg-[#bfa37a] text-white flex items-center justify-center text-[10px] font-bold font-sans">
                      +{userCount}
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    {userCount}+ Lawyers
                  </p>
                </div>
              </div>

              {/* Embedded Chat or Search Option matching UI */}
              <div className="pt-2 w-full max-w-[580px] text-neutral-950">
                <HeroChatInput locale={locale} />
              </div>
            </div>

            {/* Right Column - Infinite Scrolling Vertical Lawyer Marquees */}
            <div className="lg:col-span-4 h-[500px] overflow-hidden grid grid-cols-2 gap-4 relative">
              {/* Left Column moves UP */}
              <div className="relative h-full overflow-hidden">
                <div className="flex flex-col gap-4 animate-marquee-vertical-up hover:[animation-play-state:paused] py-1">
                  <div className="overflow-hidden rounded-tr-[60px] h-56 w-full shrink-0 bg-neutral-100 border border-neutral-100 shadow-sm">
                    <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=500&q=80" className="object-cover w-full h-full" alt="Lawyer Portrait 1" />
                  </div>
                  <div className="overflow-hidden h-48 w-full shrink-0 bg-neutral-100 border border-neutral-100 shadow-sm">
                    <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=500&q=80" className="object-cover w-full h-full" alt="Lawyer Portrait 2" />
                  </div>
                  
                  {/* Duplicates for seamless vertical loop */}
                  <div className="overflow-hidden rounded-tr-[60px] h-56 w-full shrink-0 bg-neutral-100 border border-neutral-100 shadow-sm">
                    <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=500&q=80" className="object-cover w-full h-full" alt="Lawyer Portrait 1 Duplicate" />
                  </div>
                  <div className="overflow-hidden h-48 w-full shrink-0 bg-neutral-100 border border-neutral-100 shadow-sm">
                    <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=500&q=80" className="object-cover w-full h-full" alt="Lawyer Portrait 2 Duplicate" />
                  </div>
                </div>
              </div>

              {/* Right Column moves DOWN */}
              <div className="relative h-full overflow-hidden pt-8">
                <div className="flex flex-col gap-4 animate-marquee-vertical-down hover:[animation-play-state:paused] py-1">
                  <div className="overflow-hidden rounded-br-[60px] h-56 w-full shrink-0 bg-neutral-100 border border-neutral-100 shadow-sm">
                    <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=400&h=500&q=80" className="object-cover w-full h-full" alt="Lawyer Portrait 3" />
                  </div>
                  <div className="overflow-hidden h-48 w-full shrink-0 bg-neutral-100 border border-neutral-100 shadow-sm">
                    <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&h=500&q=80" className="object-cover w-full h-full" alt="Lawyer Portrait 4" />
                  </div>

                  {/* Duplicates for seamless vertical loop */}
                  <div className="overflow-hidden rounded-br-[60px] h-56 w-full shrink-0 bg-neutral-100 border border-neutral-100 shadow-sm">
                    <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=400&h=500&q=80" className="object-cover w-full h-full" alt="Lawyer Portrait 3 Duplicate" />
                  </div>
                  <div className="overflow-hidden h-48 w-full shrink-0 bg-neutral-100 border border-neutral-100 shadow-sm">
                    <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&h=500&q=80" className="object-cover w-full h-full" alt="Lawyer Portrait 4 Duplicate" />
                  </div>
                </div>
              </div>
            </div>
          </div>


          
          <AdBanner placement="HOMEPAGE_BELOW_HERO" locale={locale} className="w-full max-w-[1200px] mx-auto mt-8 rounded-none overflow-hidden shadow-sm border border-neutral-100" />
        </section>

        

        {/* 3. The Legal Advisory section (Charcoal background with round-br wave curve) */}
        <section className="relative bg-[#161616] text-white pt-24 pb-32 px-6 lg:px-12 xl:px-24 rounded-br-[120px] md:rounded-br-[220px] z-10">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left */}
            <div className="space-y-8">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-white tracking-tight leading-snug">
                The Legal Advisory Is <br /> Our Expertise
              </h2>
              <p className="text-neutral-400 text-sm font-light max-w-md leading-relaxed">
                We handle a broad spectrum of legal matters with dedicated skill and strategic focus. Connecting client requirements with specialized advocates across the island.
              </p>
              
              {/* Profile Block */}
              <div className="flex items-center gap-4 pt-4">
                <img src="/assets/images/home1/author1.png" className="w-12 h-12 rounded-full border border-[#bfa37a]/30 object-cover" alt="CEO Avatar" />
                <div>
                  <p className="text-sm font-bold text-white">Allison Torff</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">CEO, Factorix</p>
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="flex flex-col justify-between items-start space-y-8 lg:space-y-0">
              <p className="text-neutral-400 text-sm font-light max-w-lg leading-relaxed">
                From simple consultations to complex litigation support, TheLawyr delivers accessibility. Start your conversation with our AI tool, download documents or coordinate directly with our active directory of vetted advocates.
              </p>
              <Link href={`/${locale}/about`}>
                <Button className="bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none px-8 py-6 text-xs font-bold uppercase tracking-widest transition-all">
                  More About Us
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 5. The Best Lawyers In Our House (Dynamic dynamic database list B&W) */}
        <section className="bg-neutral-100 py-24 px-6 lg:px-12 xl:px-24 border-t border-neutral-100">
          <div className="max-w-[1400px] mx-auto space-y-16">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-200 pb-8">
              <div className="space-y-3">
                <span className="text-[10px] text-[#bfa37a] uppercase tracking-[0.2em] font-bold">Expert Panel</span>
                <h2 className="text-3xl md:text-4xl font-serif text-neutral-900">
                  The Best Lawyers In <br /> Our House
                </h2>
              </div>
              <p className="text-neutral-500 text-sm max-w-md font-light leading-relaxed">
                Connect with our top-tier legal counselors, fully verified and ready to assist you.
              </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {/* Ad/Sponsored placement */}
              <SponsoredListing placement="DIRECTORY_TOP" locale={locale} />

              {topLawyers.map((lawyer) => {
                return (
                  <LawyerCard
                    key={lawyer.id}
                    id={lawyer.id}
                    fullName={lawyer.fullName}
                    profileImageUrl={lawyer.profileImageUrl}
                    bio={lawyer.bio}
                    practiceAreas={lawyer.practiceAreas}
                    languages={lawyer.languages}
                    district={lawyer.district}
                    locale={locale}
                    imageHeight="h-[360px]"
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. My Legal Practice Area section (Watermarked with specified bg asset) */}
        <section 
          className="relative bg-white py-24 px-6 lg:px-12 xl:px-24 overflow-hidden -mt-10 pt-32"
          style={{ 
            backgroundImage: "url('/assets/images/home1/practicearea-bg.webp')",
            backgroundPosition: 'left 5% center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '35% auto'
          }}
        >
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
            {/* Title / Info on Left */}
            <div className="lg:col-span-4 flex flex-col justify-center space-y-8">
              <h2 className="text-3xl sm:text-4xl font-serif text-neutral-900">
                My Legal Practice <br /> Area
              </h2>
              <p className="text-neutral-500 text-sm font-light max-w-xs leading-relaxed">
                Browse our directory segmented by active areas of expertise to get the perfect representation.
              </p>
              <Link href={`/${locale}/lawyers`}>
                <Button className="bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none px-8 py-6 text-xs font-bold uppercase tracking-widest transition-all self-start">
                  All Practices Areas
                </Button>
              </Link>
            </div>

            {/* Grid on Right */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { title: 'Trusted Lawyer', desc: 'Expert assistance on criminal, civil litigation and family disputes.', icon: Scale, area: 'Civil' },
                { title: 'Business Consulting', desc: 'Corporate advice, commercial contracts, IP registration, and audits.', icon: Building2, area: 'Corporate' },
                { title: 'Legal Champion', desc: 'Accidents, injuries representation and insurance claim collection.', icon: Gavel, area: 'Employment' },
                { title: 'Dedicated Legalist', desc: 'Administrative tribunals, banking and labor law assistance.', icon: ShieldCheck, area: 'Administrative' },
                { title: 'Case Analysis', desc: 'Deep analytics and automated templates check for business audits.', icon: FileText, area: 'Civil' },
                { title: 'Discovery Caller', desc: 'Direct secure communication lines and scheduling options.', icon: PhoneCall, area: 'Corporate' }
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link key={idx} href={`/${locale}/lawyers?practiceArea=${item.area}`}>
                    <div className="bg-white border border-neutral-100 p-8 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 group flex flex-col items-start space-y-5">
                      <div className="p-3 bg-[#faf6f0] text-[#bfa37a] group-hover:bg-[#bfa37a] group-hover:text-white transition-all duration-300">
                        <Icon className="w-6 h-6 stroke-[1.5]" />
                      </div>
                      <h3 className="text-sm font-serif font-bold text-neutral-900 uppercase tracking-wider">{item.title}</h3>
                      <p className="text-neutral-500 text-xs font-light leading-relaxed">{item.desc}</p>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 group-hover:text-[#bfa37a] transition-colors flex items-center gap-1.5 pt-2">
                        Read More <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        

      </main>

      {/* Persistent AI Chat Widget */}
      {/* <ChatWidget /> */}

      <Footer locale={locale} />
    </div>
  );
}
