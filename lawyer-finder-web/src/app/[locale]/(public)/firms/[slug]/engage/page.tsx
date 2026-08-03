import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import EngageFirmClient from './EngageFirmClient';

/**
 * Request an engagement from a firm.
 *
 * The firm-first entry point: the client engages the practice and leaves the
 * choice of attorney — and the appointment — to it. No slot is picked here,
 * because the firm has not yet decided it can act.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 7).
 */
export default async function EngageFirmPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const session = await getSession();

  const firm = await prisma.lawFirm.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      district: true,
      practiceAreas: true,
      officeHours: true,
      isActive: true,
      verificationStatus: true,
      _count: { select: { lawyers: true } },
    },
  });

  if (!firm || !firm.isActive || firm.verificationStatus !== 'VERIFIED') notFound();

  return (
    <EngageFirmClient
      firm={{
        id: firm.id,
        slug: firm.slug,
        name: firm.name,
        district: firm.district,
        practiceAreas: firm.practiceAreas,
        officeHours: firm.officeHours,
        attorneyCount: firm._count.lawyers,
      }}
      locale={locale}
      isLoggedIn={!!session}
    />
  );
}
