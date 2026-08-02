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

  const lawyer = await prisma.lawyerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { fullName: true } },
      // consultationPricing is deliberately NOT loaded — it would be serialized
      // into the RSC payload and readable in page source. Fees are quoted per
      // matter. See docs/restructure/LEGAL-GUARDRAILS.md (rule 1).
    },
  });

  if (!lawyer) {
    redirect(`/${locale}/lawyers`);
  }



  return (
    <BookingWizardClient
      lawyerId={lawyer.id}
      lawyerName={lawyer.fullName}
      lawyerImage={lawyer.profileImageUrl || null}
      lawyerDistrict={lawyer.district}
      locale={locale}
    />
  );
}
