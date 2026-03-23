import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  ShieldCheck,
  Scale,
  BookOpen,
  ArrowRight,
  MapPin,
  Languages,
  Star,
  Users,
  MessageSquare,
  Gavel,
} from 'lucide-react';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <div className="flex min-h-screen flex-col">
      <Header locale={locale} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-primary py-24 sm:py-32 lg:py-40">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              BASL Verified Platform
            </Badge>

            <h1 className="text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-5xl lg:text-7xl">
              {t('HomePage.title')}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/70 sm:text-xl">
              {t('HomePage.subtitle')}
            </p>

            {/* Search Box */}
            <div className="mx-auto mt-10 max-w-2xl">
              <div className="flex rounded-xl bg-white/10 p-1.5 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/20 focus-within:ring-2 focus-within:ring-white/30 transition-all">
                <div className="flex flex-1 items-center gap-3 px-4">
                  <Search className="h-5 w-5 text-primary-foreground/50 shrink-0" />
                  <input
                    type="text"
                    placeholder={t('HomePage.searchPlaceholder')}
                    className="w-full bg-transparent py-3.5 text-primary-foreground placeholder:text-primary-foreground/40 outline-none text-base"
                  />
                </div>
                <Link href={`/${locale}/lawyers`}>
                  <Button size="lg" variant="secondary" className="gap-2 font-semibold px-6 rounded-lg">
                    {t('HomePage.searchButton')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-primary-foreground/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>500+ Verified Lawyers</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>All 25 Districts</span>
              </div>
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                <span>Sinhala, Tamil, English</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 sm:py-28">
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
                <Card key={feature.title} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-border">
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
        <section className="border-t bg-card py-20 sm:py-28">
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
                <Button size="lg" className="gap-2 font-semibold px-8">
                  <Scale className="h-4 w-4" />
                  Register Your Practice
                </Button>
              </Link>
              <Link href={`/${locale}/lawyers`}>
                <Button size="lg" variant="outline" className="gap-2 font-semibold px-8">
                  Browse Directory
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
