import { directoryPath } from '@/lib/directoryLinks';
import Link from 'next/link';
import { isPublicDirectoryEnabled } from '@/lib/directory';
import { SITE_CONTACT } from '@/lib/siteContact';
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
  Users,
  Lock,
  Scale,
  Gavel
} from 'lucide-react';

export const metadata = { title: 'About' };

// Everything on this page must be true of TheLawyr today. It used to carry a
// law-firm template: invented results ("98% Client Satisfaction", "1,500+ Cases
// Resolved"), "Delivering practical legal solutions", two contradicting founding
// dates, "Trilingual Support", "hundreds of attorneys ... connect with clients".
// A platform that is software must not read as a firm that handles cases
// (guardrail rules 6 and 7), and invented figures are misleading advertising.
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const directoryEnabled = await isPublicDirectoryEnabled();
  const company = SITE_CONTACT.company;

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <main className="flex-1">

        {/* Dark Hero Section matching the image */}
        <section className="relative bg-[#0a0a0a] text-white min-h-[90vh] flex flex-col pt-32 pb-16 px-6 lg:px-12 xl:px-24">
          {/* Background Image & Overlay */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img
              src="/hero.png"
              alt="Scales of justice"
              className="object-cover w-full h-full opacity-70"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0f1115]/90 via-transparent to-[#0a0a0a]/90" />
          </div>

          <div className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto flex flex-col justify-between">
            {/* Top Row: what TheLawyr is */}
            <div className="w-full mt-10">
              <p className="max-w-[560px] text-white/80 text-lg sm:text-xl font-light leading-relaxed">
                Software for law practices in Sri Lanka, a library of Sri Lankan legislation, and an
                assistant that explains the law.
              </p>
            </div>

            {/* Bottom Row: Title (Left) and Button (Right) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full gap-12 mt-20 mb-8">
              <div className="max-w-3xl">
                <h1 className="text-5xl sm:text-6xl md:text-[5.5rem] font-light leading-[1.05] tracking-tight text-white mb-0 md:-mb-4">
                  About<br />
                  TheLawyr
                </h1>
              </div>

              {company.name && (
                <div className="w-full max-w-[340px]">
                  <div className="border-t border-white/30 pt-6 flex items-center gap-3">
                    <Globe className="w-5 h-5 text-white/60" />
                    <span className="text-white/60 text-sm font-light">A product of {company.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>



        {/* Who is behind it */}
        <section className="py-24 px-6 lg:px-12 xl:px-24 bg-background">
          <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-10 justify-between items-start">
            <h2 className="max-w-3xl text-3xl sm:text-4xl lg:text-5xl font-light leading-snug tracking-tight text-foreground">
              TheLawyr helps people in Sri Lanka read what the law says, and gives law practices
              the tools to run their work.
            </h2>

            {company.name && (
              <div className="flex flex-col items-start lg:items-end gap-3 min-w-[200px] lg:pt-4 lg:text-right">
                <p className="text-sm text-muted-foreground max-w-xs">
                  TheLawyr is a product of {company.name}
                  {company.description ? `, ${company.description.charAt(0).toLowerCase()}${company.description.slice(1)}` : '.'}
                </p>
                {company.url && (
                  <a
                    href={company.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 border-b border-foreground pb-1 text-base font-medium hover:text-primary transition-colors"
                  >
                    {company.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Original Features Section with updated styling */}
        <section className="py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                What TheLawyr is
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Built for Sri Lankan law and the practices that work with it.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Checked Practices',
                  desc: 'Every listed practice is checked by our team before it appears.',
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
                  desc: 'Filter by practice area, district and language - criteria you choose. The order changes every day, is the same for everyone, and nothing about position can be bought.',
                },
                {
                  icon: MessageSquare,
                  title: 'Engage a Practice Directly',
                  desc: 'Send an enquiry to a firm you have chosen. The firm decides whether it can act, checks for conflicts, and quotes its own fee - you pay the firm directly.',
                },
                {
                  icon: BookOpen,
                  title: 'Legal Library and AI Assistant',
                  desc: 'Read Sri Lankan Acts and Ordinances in full, and ask the assistant what they say. Every answer shows its source.',
                },
                {
                  icon: Users,
                  title: 'Community',
                  desc: 'Discuss Sri Lankan law, area by area, with others who read it.',
                },
                {
                  icon: Lock,
                  title: 'Privileged by Design',
                  desc: 'What you tell a firm about your problem is encrypted, and platform staff cannot read it. Your conversation with your attorney stays between you and them.',
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
              Are you an attorney?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Apply to be verified, then register your practice and invite your colleagues.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href={`/${locale}/apply`}>
                <Button size="lg" className="gap-2 font-semibold px-8 rounded-none">
                  <Scale className="h-4 w-4" />
                  Apply as an Attorney
                </Button>
              </Link>
              {directoryEnabled && (
                <Link href={directoryPath(locale)}>
                  <Button size="lg" variant="outline" className="gap-2 font-semibold px-8 rounded-none">
                    Find a Law Firm
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
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
