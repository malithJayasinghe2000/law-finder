import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Toaster } from 'sonner';
import HeaderWrapper from '@/components/layout/HeaderWrapper';
import './globals.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'HomePage' });
  return {
    title: {
      default: t('title'),
      template: '%s | LawFinder SL',
    },
    description: t('subtitle'),
    keywords: ['Sri Lanka', 'lawyer', 'legal', 'attorney', 'BASL', 'law finder', 'legal help'],
    openGraph: {
      title: t('title'),
      description: t('subtitle'),
      type: 'website',
      locale: locale,
      siteName: 'LawFinder SL',
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'en' | 'si' | 'ta')) {
    notFound();
  }

  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased font-light">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <HeaderWrapper locale={locale} />
          <div className="flex-1">
            {children}
          </div>
        </NextIntlClientProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
