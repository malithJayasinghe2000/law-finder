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
import LawyersMarquee from '@/components/home/LawyersMarquee';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <main className="flex-1">

        {/* Dark Hero Section matching the image */}
        <section className="relative bg-[#0a0a0a] text-white min-h-[90vh] flex flex-col pt-32 pb-16 px-6 lg:px-12 xl:px-24">
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

          <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto flex flex-col justify-between">
            {/* Top Row: Stats (Left) and Description (Right) */}
            <div className="flex flex-col md:flex-row justify-between items-start w-full gap-10 mt-10">
              <div className="flex flex-wrap gap-16">
                <div>
                  <div className="text-5xl sm:text-6xl font-light mb-3 text-white tracking-tight">98%</div>
                  <div className="text-white/70 text-sm sm:text-base tracking-wide font-light">Client Satisfaction</div>
                </div>
                <div>
                  <div className="text-5xl sm:text-6xl font-light mb-3 text-white tracking-tight">1,500+</div>
                  <div className="text-white/70 text-sm sm:text-base tracking-wide font-light">Cases Resolved Successfully</div>
                </div>
              </div>

              <div className="max-w-[400px] text-left md:text-right mt-6 md:mt-0">
                <p className="text-white/80 text-lg sm:text-xl font-light leading-relaxed">
                  Delivering practical legal solutions with insight, precision, and forward-thinking strategy.
                </p>
              </div>
            </div>

            {/* Bottom Row: Title (Left) and Button (Right) */}
            <div className="flex flex-col md:flex-row justify-between items-end w-full gap-12 mt-20 mb-8">
              <div className="max-w-3xl">
                <h1 className="text-5xl sm:text-6xl md:text-[5.5rem] font-light leading-[1.05] tracking-tight text-white mb-0 md:-mb-4">
                  About<br />
                  TheLawyr
                </h1>
              </div>

              <div className="w-full max-w-[340px]">
                {/* <Link href={`/${locale}/lawyers`}>
                  <Button className="bg-white text-black hover:bg-neutral-200 rounded-none px-6 py-8 text-lg font-medium w-full flex items-center justify-between group">
                    Find Legal Help
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link> */}

                <div className="mt-8 border-t border-white/30 pt-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-white/60" />
                    <span className="text-white/60 text-sm font-light">Supporting clients since 2012</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* Content Section mimicking 'About the Firm' layout provided in the screenshot */}
        <section className="py-24 px-6 lg:px-12 xl:px-24 bg-background">
          <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16 justify-between items-start">
            <div className="max-w-3xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light leading-snug tracking-tight text-foreground">
                Since 2026, we've transformed the way legal support is delivered —
                blending strategic thinking, deep domain expertise, and unwavering
                dedication to secure the best outcomes for our clients.
              </h2>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-6 min-w-[200px] lg:pt-4">
              <Link href={`/${locale}/about`} className="group flex items-center gap-2 border-b border-foreground pb-1 text-lg font-medium hover:text-primary transition-colors">
                About the Firm.
                <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Link>
              <img
                src="https://images.unsplash.com/photo-1505664194779-8beaceb93744?q=80&w=300&auto=format&fit=crop"
                alt="Law books"
                className="w-48 h-32 object-cover rounded-md grayscale opacity-80"
              />
            </div>
          </div>
        </section>

        {/* Original Features Section with updated styling */}
        <section className="py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                The trusted way to find legal help
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A secure, intelligent platform designed specifically for Sri Lankan legal needs
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'BASL Verified Attorneys',
                  desc: 'Every lawyer on TheLawyr is verified against the Bar Association of Sri Lanka registry. No fake profiles, guaranteed authenticity.',
                },
                // Three claims on this page were rewritten in Phase 7, and each
                // described something the restructure had already removed:
                //
                //  - "Filter by ... fee range" — `LawyerProfile.baseFeeRange`
                //    was deleted in Phase 2. A published fee indication is
                //    beyond the Rule 40 content limit and reads as advertising.
                //  - "Direct Inquiry System ... with your case details" — the
                //    unauthenticated `Inquiry` intake, removed in Phase 7.
                //  - "Verified Reviews" — the `Review` model was deleted in
                //    Phase 2. Star ratings are unfair attraction under Rule 39
                //    and make ordering non-neutral under guardrail rule 4.
                //
                // Marketing copy is a surface like any other. A page promising
                // a feature we removed for legal reasons is still holding the
                // platform out as offering it.
                {
                  icon: Search,
                  title: 'Search You Control',
                  desc: 'Filter by practice area, district and language — criteria you choose. Ordering is alphabetical and nothing about position can be bought.',
                },
                {
                  icon: MessageSquare,
                  title: 'Engage a Practice Directly',
                  desc: 'Send an enquiry to a firm you have chosen. The firm decides whether it can act, checks for conflicts, and quotes its own fee — you pay the firm directly.',
                },
                {
                  icon: BookOpen,
                  title: 'Knowledge Hub',
                  desc: 'Access expert legal articles written by verified attorneys. Understand your rights before you consult.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Privileged by Design',
                  desc: 'What you tell a firm about your problem is encrypted, and platform staff cannot read it. Your conversation with your attorney stays between you and them.',
                },
                {
                  icon: Languages,
                  title: 'Trilingual Support',
                  desc: 'Full platform support in Sinhala, Tamil, and English. Access justice in the language you are most comfortable with.',
                },
              ].map((feature) => (
                <Card key={feature.title} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-border rounded-xl">
                  <CardContent className="p-8">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t bg-card py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Gavel className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Are you a legal professional?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Join hundreds of Sri Lankan attorneys already using TheLawyr to grow their practice, publish insights, and connect with clients.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href={`/${locale}/register`}>
                <Button size="lg" className="gap-2 font-semibold px-8 rounded-none">
                  <Scale className="h-4 w-4" />
                  Register Your Practice
                </Button>
              </Link>
              <Link href={`/${locale}/lawyers`}>
                <Button size="lg" variant="outline" className="gap-2 font-semibold px-8 rounded-none">
                  Browse Directory
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* The floating "Legal Assistant" widget was removed in Phase 5.
          Its input had no handler — typing into it did nothing — while it
          greeted every visitor with "How can we assist you with your legal
          needs today?". A platform that is not a law firm cannot offer to
          assist with someone's legal needs (guardrail rule 7), and a dead
          input that appears to is worse than none. The working assistant is
          at /chat, where the AI policy applies. */}

    </div>
  );
}
