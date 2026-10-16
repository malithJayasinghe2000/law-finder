import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Toaster } from 'sonner';
import HeaderWrapper from '@/components/layout/HeaderWrapper';
import { DirectoryProvider } from '@/components/directory/DirectoryProvider';
import { isPublicDirectoryEnabled } from '@/lib/directory';
import './globals.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'HomePage' });
  return {
    title: {
      default: t('title'),
      template: '%s | TheLawyr',
    },
    description: t('subtitle'),
    keywords: ['Sri Lanka', 'lawyer', 'legal', 'attorney', 'BASL', 'thelawyr', 'legal help'],
    openGraph: {
      title: t('title'),
      description: t('subtitle'),
      type: 'website',
      locale: locale,
      siteName: 'TheLawyr',
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

  const [messages, directoryEnabled] = await Promise.all([
    getMessages({ locale }),
    isPublicDirectoryEnabled(),
  ]);

  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
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
          <DirectoryProvider enabled={directoryEnabled}>
            <HeaderWrapper locale={locale} />
            <div className="flex-1">
              {children}
            </div>
          </DirectoryProvider>
        </NextIntlClientProvider>
        <Toaster position="top-right" 
          toastOptions={{
            style: {
              background: '#000000', // Change background color
              color: '#ffffff',      // Change text color
              border: '1px solid #333' // Change border color
            },
            classNames: {
              toast: 'custom-toast-class', // Or use Tailwind classes
              success: 'bg-green-500 text-white',
              error: 'bg-red-500 text-white',
            }
          }}  />
      </body>
    </html>
  );
}
