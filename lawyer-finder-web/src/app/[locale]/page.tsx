import { getTranslations } from 'next-intl/server';
import { directoryPath } from '@/lib/directoryLinks';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  ArrowUpRight,
  Star,
  Scale,
  Building2,
  Gavel,
  ShieldCheck,
  FileText,
  PhoneCall,
  Facebook,
  Linkedin,
} from 'lucide-react';
import HeroChatInput from '@/components/home/HeroChatInput';
import { isPublicDirectoryEnabled } from '@/lib/directory';

import { AdBanner } from '@/components/ads/AdComponents';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const directoryEnabled = await isPublicDirectoryEnabled();
  const t = await getTranslations({ locale });


  return (
    <div className="flex min-h-screen flex-col font-sans bg-white selection:bg-[#bfa37a]/30">
      <main className="flex-1">

        {/* 1. Hero — full-width photograph of Lady Justice on black, darkened from the
            left so the text sits on near-black and the statue carries the right side.
            Photo: Sasun Bughdaryan on Unsplash (unsplash.com/photos/KRNCAqkk8TE),
            Unsplash License — free to use, no credit required.
            The background must never be a person. Earlier versions used stock
            portraits of models, which read as "our lawyers" and were not anyone on
            the platform; a real attorney here would be given the front page over
            every other. Guardrail rules 3 and 4. */}
        <section className="relative bg-white pt-24">
          <div className="relative isolate overflow-hidden bg-[#0f0f0f]">
            <img
              src="/assets/images/home1/hero-justice.jpg"
              alt=""
              aria-hidden="true"
              width={2000}
              height={1333}
              className="absolute inset-y-0 right-0 -z-20 h-full w-full object-cover object-[65%_center] lg:w-[64%] lg:object-[60%_center]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0f0f0f] via-[#0f0f0f]/90 to-[#0f0f0f]/30 lg:bg-[linear-gradient(to_right,#0f0f0f_40%,rgba(15,15,15,0.55)_55%,transparent_74%)]"
            />

            <div className="mx-auto max-w-[1200px] px-6 py-20 sm:py-24 lg:px-12 lg:py-28">
              <div className="max-w-2xl space-y-8 text-white">
                <p className="font-serif text-lg text-white/85">Welcome to TheLawyr.</p>

                <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-[#d8c29d] sm:text-6xl">
                  Know What <br className="hidden sm:block" />
                  the Law Says
                </h1>

                <p className="max-w-md text-sm font-light leading-relaxed text-white/75 sm:text-base">
                  Sri Lanka&apos;s legal platform. Read what the law says, with the source for every
                  answer{directoryEnabled ? ', and find a verified law firm when you need one' : ''}.
                </p>

                <div className="flex flex-wrap items-center gap-6">
                  {directoryEnabled && (
                    <Link
                      href={directoryPath(locale)}
                      className="group inline-flex items-stretch border border-white/70 text-white"
                    >
                      <span className="px-6 py-3.5 text-xs font-bold uppercase tracking-widest">Find Lawyers</span>
                      <span className="flex items-center bg-[#bfa37a] px-3.5 text-[#0f0f0f] transition-colors group-hover:bg-[#d8c29d]">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </Link>
                  )}
                  <Link
                    href={`/${locale}/chat`}
                    className="text-xs font-bold uppercase tracking-widest text-white/85 underline underline-offset-8 decoration-[#bfa37a] hover:text-white"
                  >
                    Chat With AI
                  </Link>
                </div>

                <div className="w-full max-w-[580px] pt-2 text-neutral-950">
                  <HeroChatInput locale={locale} tone="dark" />
                </div>
              </div>
            </div>
          </div>

          <AdBanner placement="HOMEPAGE_BELOW_HERO" locale={locale} className="w-full max-w-[1200px] mx-auto mt-8 rounded-none overflow-hidden shadow-sm border border-neutral-100" />
        </section>

        

        {/* 3. What the site offers (charcoal background with round-br wave curve).
            Was "Legal Guidance & Professional Counsel … we connect client requirements
            with dedicated Attorneys-at-Law … vetted advocates": the platform presented
            as giving advice and placing clients with lawyers (rules 4, 6, 7). */}
        <section className="relative bg-[#161616] text-white pt-24 pb-32 px-6 lg:px-12 xl:px-24 rounded-br-[120px] md:rounded-br-[220px] z-10">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left */}
            <div className="space-y-8">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-white tracking-tight leading-snug">
                What You Can <br /> Do Here
              </h2>
              <p className="text-neutral-400 text-sm font-light max-w-md leading-relaxed">
                TheLawyr is software for Sri Lankan law practices. Around it, {directoryEnabled ? 'three things are' : 'two things are'} open to everyone.
              </p>
              

            </div>

            {/* Right */}
            <div className="flex flex-col justify-between items-start space-y-8 lg:space-y-0">
              <p className="text-neutral-400 text-sm font-light max-w-lg leading-relaxed">
                Ask the AI what the law says and see the section it comes from. Read the Acts
                themselves in the Legal Library.
                {directoryEnabled && ' And when you need an attorney, browse verified law firms and choose one yourself.'}
              </p>
              <Link href={`/${locale}/about`}>
                <Button className="bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none px-8 py-6 text-xs font-bold uppercase tracking-widest transition-all">
                  More About Us
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 5. Directory entry point.
            This used to be a grid of eight attorney portrait cards with their bios.
            Ordered alphabetically, it put the same eight names on the front page
            for ever — free prominence for some attorneys over all the others —
            and the bios ("Expert in…", "Specialist in…") were self-promotion.
            A single neutral entry point instead. See src/components/lawyer/LawyerCard.tsx. */}
        {directoryEnabled && (
          <section className="bg-neutral-100 py-20 px-6 lg:px-12 xl:px-24 border-t border-neutral-100">
            <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3">
                <span className="text-[10px] text-[#bfa37a] uppercase tracking-[0.2em] font-bold">Directory</span>
                <h2 className="text-3xl md:text-4xl font-serif text-neutral-900">
                  Find an Attorney-at-Law
                </h2>
                <p className="text-neutral-500 text-sm max-w-md font-light leading-relaxed">
                  Verified law firms and attorneys, in an order that changes daily. Filter by practice area, district and language.
                </p>
              </div>
              <Link href={`/${locale}/firms`}>
                <Button className="bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none px-8 py-6 text-xs font-bold uppercase tracking-widest transition-all">
                  Browse the directory
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* 4. My Legal Practice Area section (Watermarked with specified bg asset).
            Every card is a directory search, so the section goes with the directory. */}
        {directoryEnabled && (
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
                <Link href={directoryPath(locale)}>
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
                    <Link key={idx} href={directoryPath(locale, `practiceArea=${item.area}`)}>
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
        )}

        

      </main>

      <Footer locale={locale} />
    </div>
  );
}
