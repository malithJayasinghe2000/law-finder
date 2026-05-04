import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import BookingWizardClient from './BookingWizardClient';

export default async function BookingPage(props: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const session = await getSession();
  const { id, locale } = await props.params;

  if (!session) {
    redirect(`/${locale}/login?redirect=/${locale}/lawyers/${id}/book`);
  }

  // Fetch lawyer and pricing
  const lawyer = await prisma.lawyerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { fullName: true } },
      consultationPricing: true,
    },
  });

  if (!lawyer) {
    redirect(`/${locale}/lawyers`);
  }

  if (!lawyer.consultationPricing) {
    // Lawyer hasn't set up pricing yet
    return (
      <div className="min-h-screen bg-neutral-50 py-20 flex items-center justify-center">
        <div className="bg-white p-10 max-w-md w-full border border-neutral-200 text-center">
          <h2 className="text-xl font-bold text-[#0a0a0a] mb-2">Unavailable</h2>
          <p className="text-neutral-500 text-sm">This lawyer has not configured their consultation availability and pricing yet. Please check back later or send them a message.</p>
        </div>
      </div>
    );
  }

  return (
    <BookingWizardClient
      lawyerId={lawyer.id}
      lawyerName={lawyer.fullName}
      lawyerImage={lawyer.profileImageUrl || null}
      lawyerDistrict={lawyer.district}
      locale={locale}
      pricing={{
        pricingType: lawyer.consultationPricing.pricingType,
        physicalPrice: lawyer.consultationPricing.physicalPrice,
        onlinePrice: lawyer.consultationPricing.onlinePrice,
        commissionRate: lawyer.consultationPricing.commissionRate,
      }}
    />
  );
}
