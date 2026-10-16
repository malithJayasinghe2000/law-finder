import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RespondToFirmInvitationSchema } from '@/schemas/firm.schema';
import { checkJoinEligibility, admitMemberToFirm } from '@/lib/firms/invitations';
import { canAddFirmMember } from '@/lib/firms/billing';

/**
 * Accepting or declining an invitation to join a firm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The invitee acts here, not the firm. That is the whole point of the model:
 * before Phase 7 a principal typed an email address and that person was inside
 * the firm's privilege boundary immediately, without being asked.
 *
 * Eligibility is re-checked at this moment even though it was checked when the
 * invitation was sent. Fourteen days is long enough for the relevant facts to
 * change — the invitee may have joined another practice, taken on matters
 * there, or had their verification withdrawn — and an invitation that carried
 * someone past a rule that had since started to apply would be a rule enforced
 * only on people who click promptly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** GET ?token=… — what am I being invited to? Shown before the person decides. */
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'No invitation reference.' }, { status: 400 });
    }

    const invitation = await prisma.firmInvitation.findUnique({
      where: { token },
      select: {
        email: true,
        role: true,
        title: true,
        status: true,
        expiresAt: true,
        firm: { select: { name: true, district: true } },
      },
    });

    // The same answer for "no such token" and "wrong token", so this cannot be
    // used to find out whether an address has been invited anywhere.
    if (!invitation) {
      return NextResponse.json({ error: 'That invitation link is not valid.' }, { status: 404 });
    }

    const expired = invitation.expiresAt.getTime() < Date.now();

    return NextResponse.json({
      invitation: {
        firmName: invitation.firm.name,
        district: invitation.firm.district,
        email: invitation.email,
        role: invitation.role,
        title: invitation.title,
        status: expired && invitation.status === 'PENDING' ? 'EXPIRED' : invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[FIRM_INVITATION_GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: accept or decline. */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          error:
            'Sign in - or create an account with the email address this invitation was sent to - before responding.',
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validated = RespondToFirmInvitationSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { token, action } = validated.data;

    const invitation = await prisma.firmInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        firmId: true,
        email: true,
        role: true,
        title: true,
        status: true,
        expiresAt: true,
        invitedById: true,
        firm: { select: { name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'That invitation link is not valid.' }, { status: 404 });
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'That invitation has already been used or withdrawn.' },
        { status: 409 }
      );
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      await prisma.firmInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json(
        { error: 'That invitation has expired. Ask the firm to send a new one.' },
        { status: 410 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true },
    });

    // The invitation is addressed to a person, and the link is not a bearer
    // token for whoever happens to hold it. Someone forwarded a colleague's
    // invitation email must not be able to join in their place.
    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: `This invitation was sent to ${invitation.email}. Sign in with that address to respond to it.`,
        },
        { status: 403 }
      );
    }

    if (action === 'decline') {
      await prisma.firmInvitation.update({
        where: { id: invitation.id },
        data: { status: 'DECLINED', respondedAt: new Date(), acceptedByUserId: null },
      });
      return NextResponse.json({ success: true, joined: false });
    }

    // Re-checked now, not trusted from when the invitation was sent.
    const eligibility = await checkJoinEligibility({
      firmId: invitation.firmId,
      role: invitation.role,
      userId: user.id,
    });

    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.reason }, { status: eligibility.status });
    }

    // A seat is consumed by a person joining, so it is checked at the moment
    // they actually join — the firm may have filled its last seat since.
    const seatCheck = await canAddFirmMember(invitation.firmId);
    if (!seatCheck.allowed) {
      return NextResponse.json(
        {
          error: `${invitation.firm.name} has no seat available on its current licence. Ask the firm's principal to add one, then accept again.`,
        },
        { status: 402 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await admitMemberToFirm(tx, {
        firmId: invitation.firmId,
        userId: user.id,
        role: invitation.role,
        title: invitation.title,
        invitedById: invitation.invitedById,
      });

      await tx.firmInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
          acceptedByUserId: user.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      joined: true,
      firmName: invitation.firm.name,
      role: invitation.role,
    });
  } catch (error) {
    console.error('[FIRM_INVITATION_RESPOND]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
