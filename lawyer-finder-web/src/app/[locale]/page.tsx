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
import LawyersMarquee from '@/components/home/LawyersMarquee';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <main className="flex-1">
        
        {/* Dark Hero Section matching the image */}
        <section className="relative bg-[#0a0a0a] text-white min-h-[90vh] flex flex-col justify-center py-20 px-6 lg:px-12 xl:px-24">
          {/* Background Image & Overlay */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img 
              src="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=2500&auto=format&fit=crop" 
              alt="Courtroom background" 
              className="object-cover w-full h-full opacity-40 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-12 mt-12">
            
            {/* Left side text */}
            <div className="max-w-2xl">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold leading-[1.1] tracking-tight mb-4">
                Smart Legal<br />
                Strategies for<br />
                Real-World<br />
                Cases
              </h1>
            </div>

            {/* Right side stats & button */}
            <div className="max-w-md flex flex-col gap-10">
              <div className="flex gap-8">
                <div>
                  <div className="text-4xl sm:text-5xl font-light mb-2">98%</div>
                  <div className="text-white/60 text-sm tracking-wide">Client Satisfaction</div>
                </div>
                <div>
                  <div className="text-4xl sm:text-5xl font-light mb-2">1,500+</div>
                  <div className="text-white/60 text-sm tracking-wide">Cases Resolved Successfully</div>
                </div>
              </div>

              <p className="text-white/80 text-lg sm:text-xl font-light leading-relaxed">
                Delivering practical legal solutions with insight, precision, and forward-thinking strategy.
              </p>

              <div>
                <Link href={`/${locale}/lawyers`}>
                  <Button className="bg-white text-black hover:bg-white/90 rounded-none px-8 py-7 text-lg w-full sm:w-auto flex items-center justify-between group">
                    Find Legal Help
                    <ArrowRight className="ml-6 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                
                <div className="mt-8 border-t border-white/20 pt-6 flex flex-row items-center justify-between">
                  <Globe className="w-5 h-5 text-white/50" />
                  <span className="text-white/50 text-sm">Supporting clients since 2012</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee Section */}
        <LawyersMarquee />

        {/* Content Section mimicking 'About the Firm' layout provided in the screenshot */}
        <section className="py-24 px-6 lg:px-12 xl:px-24 bg-background">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 justify-between items-start">
            <div className="max-w-3xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light leading-snug tracking-tight text-foreground">
                Since 2012, we've transformed the way legal support is delivered —
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
                  desc: 'Every lawyer on LawFinder is verified against the Bar Association of Sri Lanka registry. No fake profiles, guaranteed authenticity.',
                },
                {
                  icon: Search,
                  title: 'Intelligent Search',
                  desc: 'Filter lawyers by practice area, district, language, and fee range. Find exactly the right legal expert for your case.',
                },
                {
                  icon: MessageSquare,
                  title: 'Direct Inquiry System',
                  desc: 'Send secure inquiries directly to lawyers with your case details. Get connected without the hassle of cold calls.',
                },
                {
                  icon: BookOpen,
                  title: 'Knowledge Hub',
                  desc: 'Access expert legal articles written by verified attorneys. Understand your rights before you consult.',
                },
                {
                  icon: Star,
                  title: 'Verified Reviews',
                  desc: 'Read honest reviews from real clients. Every review is moderated to ensure trustworthy feedback.',
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
              Join hundreds of Sri Lankan attorneys already using LawFinder to grow their practice, publish insights, and connect with clients.
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

      {/* Persistent AI Chat Widget */}
      <ChatWidget />

      <Footer locale={locale} />
    </div>
  );
}
