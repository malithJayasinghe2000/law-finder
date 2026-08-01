import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getMatterAccess } from '@/lib/firms/access';

/**
 * The engagement letter for a request.
 *
 * Readable by the client it was issued to and by the firm that issued it.
 * Deliberately NOT readable by platform staff — it contains the matter subject
 * and the agreed scope of work, which are confidential to the parties.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 5 and 7).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        clientId: true,
        lawyerId: true,
        firmId: true,
        lawyer: { select: { userId: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // The retainer is between the CLIENT and the FIRM. Both sides of it may read
    // it — the client, the attorney acting, and the firm's principal — and
    // platform staff may not, because we are not a party to it.
    // See docs/restructure/LEGAL-GUARDRAILS.md (rules 5 and 7).
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
    const isLawyer = booking.lawyer.userId === session.userId;

    const mayReadLetter =
      isClient ||
      access.basis === 'ASSIGNED_ATTORNEY' ||
      access.basis === 'FIRM_PRINCIPAL';

    if (!mayReadLetter) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const letter = await prisma.engagementLetter.findUnique({
      where: { bookingId: id },
    });

    if (!letter) {
      return NextResponse.json(
        { error: 'No engagement letter has been issued for this request yet.' },
        { status: 404 }
      );
    }

    // Record the first time the client opens it — useful evidence that the terms
    // were actually communicated, not merely generated.
    if (isClient && !letter.clientViewedAt) {
      await prisma.engagementLetter.update({
        where: { id: letter.id },
        data: { clientViewedAt: new Date() },
      });
    }

    return NextResponse.json({
      letter: {
        ...letter,
        issuedAt: letter.issuedAt.toISOString(),
        clientViewedAt: letter.clientViewedAt?.toISOString() || null,
        createdAt: letter.createdAt.toISOString(),
        updatedAt: letter.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Engagement letter fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
