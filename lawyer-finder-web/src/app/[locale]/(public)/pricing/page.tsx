import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PricingPageClient from './PricingPageClient';

export const metadata = { title: 'Premium Pricing | TheLawyr' };

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();

  // Initial Server-side access check
  if (!session || (session.role !== 'ADMIN' && session.role !== 'LAWYER')) {
    redirect(`/${locale}/login`);
  }

  return <PricingPageClient locale={locale} />;
}
