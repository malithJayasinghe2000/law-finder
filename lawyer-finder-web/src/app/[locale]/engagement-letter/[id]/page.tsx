import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/db';
import PrintableLetter from './PrintableLetter';

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
    select: { clientId: true, lawyer: { select: { userId: true } } },
  });

  if (!booking) notFound();

  const isClient = booking.clientId === session.userId;
  // `lawyer` is null while a matter sits unassigned in the firm's queue — though
  // no engagement letter can exist at that point, since a letter requires an
  // accepted quote and a quote requires an assigned attorney.
  const isLawyer = !!booking.lawyer && booking.lawyer.userId === session.userId;

  if (!isClient && !isLawyer) notFound();

  const letter = await prisma.engagementLetter.findUnique({
    where: { bookingId: id },
    select: { reference: true, body: true, issuedAt: true, firmName: true },
  });

  if (!letter) notFound();

  if (isClient) {
    await prisma.engagementLetter.updateMany({
      where: { bookingId: id, clientViewedAt: null },
      data: { clientViewedAt: new Date() },
    });
  }

  return (
    <PrintableLetter
      reference={letter.reference}
      body={letter.body}
      firmName={letter.firmName}
      issuedAt={letter.issuedAt.toISOString()}
    />
  );
}
