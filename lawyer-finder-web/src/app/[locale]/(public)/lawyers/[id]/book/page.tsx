import { getSession } from '@/lib/auth';
import { directoryPath } from '@/lib/directoryLinks';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { LISTED_ATTORNEY_WHERE } from '@/lib/directory';
import BookingWizardClient from './BookingWizardClient';

export default async function BookingPage(props: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const session = await getSession();
  const { id, locale } = await props.params;

  if (!session) {
    redirect(`/${locale}/login?redirect=/${locale}/lawyers/${id}/book`);
  }

  // Only an attorney listed through an active, verified firm can be engaged.
  const lawyer = await prisma.lawyerProfile.findFirst({
    where: { id, ...LISTED_ATTORNEY_WHERE },
    include: {
      user: { select: { fullName: true } },
      // consultationPricing is deliberately NOT loaded — it would be serialized
      // into the RSC payload and readable in page source. Fees are quoted per
      // matter. See docs/restructure/LEGAL-GUARDRAILS.md (rule 1).
    },
  });

  if (!lawyer) {
    redirect(directoryPath(locale));
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
