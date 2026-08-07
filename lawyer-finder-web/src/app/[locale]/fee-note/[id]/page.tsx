import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { getMatterAccess } from '@/lib/firms/access';
import { recordAccess, actorRoleFor } from '@/lib/privacy/audit';
import PrintableFeeNote from './PrintableFeeNote';

/**
 * Print-ready fee note.
 *
 * Rendered as a clean A4 document and printed through the browser, where "Save
 * as PDF" produces the real PDF. Same approach as the engagement letter — no PDF
 * library, and the document a client receives is the same snapshot we stored.
 *
 * Access matches the API: the client it was issued to, the attorney acting, and
 * the firm's principal. Platform staff cannot open it — a fee note names the
 * client and narrates the work done, which is privileged under Evidence
 * Ordinance s.126, and what a firm charges its own clients is not our business.
 *
 * Only ISSUED, SETTLED and CANCELLED notes render. A DRAFT has no content
 * snapshot because it has not been issued, and showing a client a figure the
 * firm has not settled on invites an argument about a number nobody sent.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 1, 2, 5 and 7).
 */
export default async function FeeNotePrintPage(props: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await props.params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login?redirect=/${locale}/fee-note/${id}`);
  }

  const feeNote = await prisma.feeNote.findUnique({
    where: { id },
    select: {
      id: true,
      noteNumber: true,
      content: true,
      status: true,
      total: true,
      currency: true,
      firmName: true,
      issuedAt: true,
      settledAt: true,
      booking: {
        select: { id: true, clientId: true, lawyerId: true, firmId: true },
      },
    },
  });

  if (!feeNote) notFound();

  const access = await getMatterAccess({
    actorUserId: session.userId,
    actorRole: session.role,
    actorProfileId: session.profileId,
    matter: {
      lawyerId: feeNote.booking.lawyerId,
      firmId: feeNote.booking.firmId,
      clientId: feeNote.booking.clientId,
    },
  });

  const mayRead =
    access.basis === 'CLIENT' ||
    access.basis === 'ASSIGNED_ATTORNEY' ||
    access.basis === 'FIRM_PRINCIPAL';

  if (!mayRead) notFound();

  // A draft has no snapshot, so there is nothing to print.
  if (!feeNote.content || feeNote.status === 'DRAFT') notFound();

  // A fee note names the client and narrates the legal work done for them.
  await recordAccess({
    actorUserId: session.userId,
    actorRole: actorRoleFor({ sessionRole: session.role, firmRole: access.basis }),
    resource: 'FEE_NOTE',
    resourceId: feeNote.id,
    action: 'READ_DETAIL',
    bookingId: feeNote.booking.id,
    firmId: feeNote.booking.firmId,
    clientUserId: feeNote.booking.clientId,
  });

  return (
    <PrintableFeeNote
      noteNumber={feeNote.noteNumber}
      body={feeNote.content}
      firmName={feeNote.firmName}
      status={feeNote.status}
      issuedAt={feeNote.issuedAt?.toISOString() ?? null}
    />
  );
}
