import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PricingPageClient from './PricingPageClient';
import { LICENSING_ENABLED } from '@/lib/licensing';
import LicensingOff from '@/components/subscriptions/LicensingOff';

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

  // Hidden while licensing is off (src/lib/licensing.ts).
  if (!LICENSING_ENABLED) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <LicensingOff />
      </div>
    );
  }

  return <PricingPageClient locale={locale} />;
}
