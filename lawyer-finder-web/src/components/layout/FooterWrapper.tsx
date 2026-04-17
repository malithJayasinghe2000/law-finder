'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function FooterWrapper({ locale }: { locale: string }) {
  const pathname = usePathname();
  
  if (pathname.includes('/chat')) {
    return null;
  }

  return <Footer locale={locale} />;
}
