import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/db';
import PrintableLetter from './PrintableLetter';
import { getMatterAccess, discloseEngagementLetter } from '@/lib/firms/access';

/**
 * Print-ready engagement letter.
 *
 * Rendered as a clean A4 document and printed through the browser, which produces
 * a real PDF via "Save as PDF" without pulling in a PDF library (the artifact CSP
 * and bundle size both argue against one).
 *
 * Access matches the API: the client it was issued to, and the firm that issued
 * it. Platform staff cannot open it.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 5 and 7).
 */
export default async function EngagementLetterPrintPage(props: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await props.params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login?redirect=/${locale}/engagement-letter/${id}`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      clientId: true,
      lawyerId: true,
      firmId: true,
      lawyer: { select: { userId: true } },
    },
  });

  if (!booking) notFound();

  // Resolved through the one file that decides, exactly as the API route does.
  // This page reaches the database directly, so a rule written out by hand here
  // would be a second copy of the privilege rule that nothing asserts.
  const access = await getMatterAccess({
    actorUserId: session.userId,
    actorRole: session.role,
    actorProfileId: session.profileId,
    matter: {
      lawyerId: booking.lawyerId,
      firmId: booking.firmId,
      clientId: booking.clientId,
    },
  });

  const isClient = access.basis === 'CLIENT';

  const mayReadLetter =
    isClient ||
    access.basis === 'ASSIGNED_ATTORNEY' ||
    access.basis === 'FIRM_PRINCIPAL';

  if (!mayReadLetter) notFound();

  const letter = await prisma.engagementLetter.findUnique({
    where: { bookingId: id },
    select: { id: true, reference: true, body: true, issuedAt: true, firmName: true },
  });

  if (!letter) notFound();

  // The body is stored encrypted; this is the only place it becomes a document.
  const disclosed = discloseEngagementLetter(letter, access);

  if (isClient) {
    await prisma.engagementLetter.updateMany({
      where: { bookingId: id, clientViewedAt: null },
      data: { clientViewedAt: new Date() },
    });
  }

  return (
    <PrintableLetter
      reference={letter.reference}
      body={disclosed.body}
      firmName={letter.firmName}
      issuedAt={letter.issuedAt.toISOString()}
    />
  );
}
