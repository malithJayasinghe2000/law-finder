import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getFirmMembership, canManageMembers } from '@/lib/firms/access';
import {
  CreateFirmInvitationSchema,
  RevokeFirmInvitationSchema,
} from '@/schemas/firm.schema';
import {
  checkJoinEligibility,
  invitationExpiry,
  newInvitationToken,
  expireStaleInvitations,
} from '@/lib/firms/invitations';
import { canAddFirmMember } from '@/lib/firms/billing';
import { EmailService } from '@/lib/email/EmailService';

/**
 * Invitations to join this firm.
 *
 * Inviting someone widens who can see that the firm's matters exist, so it is
 * restricted to the principal — the same restriction as adding a member
 * directly, which this replaces for anyone who does not yet have an account.
 *
 * The rules about who may hold which role live in `src/lib/firms/invitations.ts`
 * and are applied twice: here, so the principal hears about a problem straight
 * away, and again at acceptance, because fourteen days is long enough for the
 * facts to change.
 */

/** GET: the firm's outstanding and past invitations. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getFirmMembership(session.userId);
    if (!membership) {
      return NextResponse.json({ error: 'You do not belong to a firm.' }, { status: 404 });
    }

    // Sweep first, so the list never shows a dead invitation as live.
    await expireStaleInvitations();

    const invitations = await prisma.firmInvitation.findMany({
      where: { firmId: membership.firmId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      // The token is deliberately NOT selected. It is the credential in the
      // invitation link; a list screen has no use for it, and putting it in a
      // payload makes every viewer of that screen able to accept on someone
      // else's behalf.
      select: {
        id: true,
        email: true,
        role: true,
        title: true,
        status: true,
        expiresAt: true,
        respondedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ invitations, canInvite: canManageMembers(membership) });
  } catch (error) {
    console.error('[FIRM_INVITATIONS_GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: invite someone. */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getFirmMembership(session.userId);
    if (!canManageMembers(membership)) {
      return NextResponse.json(
        { error: 'Only the principal of the firm can invite people.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = CreateFirmInvitationSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const email = validated.data.email.toLowerCase().trim();
    const { role, title } = validated.data;

    const invitee = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const eligibility = await checkJoinEligibility({
      firmId: membership!.firmId,
      role,
      userId: invitee?.id ?? null,
    });

    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.reason }, { status: eligibility.status });
    }

    // Seats count PEOPLE WHO CAN SIGN IN, never matters or clients. Checked here
    // so a principal is not told about a licence limit only when their partner
    // clicks accept. See LEGAL-GUARDRAILS.md (rule 1).
    const seatCheck = await canAddFirmMember(membership!.firmId);
    if (!seatCheck.allowed) {
      return NextResponse.json({ error: seatCheck.reason }, { status: 402 });
    }

    const token = newInvitationToken();

    await prisma.firmInvitation.upsert({
      where: { firmId_email: { firmId: membership!.firmId, email } },
      update: {
        role,
        title: title || null,
        token,
        status: 'PENDING',
        invitedById: session.userId,
        expiresAt: invitationExpiry(),
        respondedAt: null,
        acceptedByUserId: null,
      },
      create: {
        firmId: membership!.firmId,
        email,
        role,
        title: title || null,
        token,
        status: 'PENDING',
        invitedById: session.userId,
        expiresAt: invitationExpiry(),
      },
    });

    try {
      await EmailService.sendFirmInvitation({
        to: email,
        firmName: membership!.firmName,
        invitedByName: session.fullName ?? 'A principal of the firm',
        role,
        token,
      });
    } catch (error) {
      console.error('[FIRM_INVITE_EMAIL]', email, error);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[FIRM_INVITATIONS_POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE: revoke an outstanding invitation. */
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getFirmMembership(session.userId);
    if (!canManageMembers(membership)) {
      return NextResponse.json(
        { error: 'Only the principal of the firm can revoke an invitation.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = RevokeFirmInvitationSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const invitation = await prisma.firmInvitation.findUnique({
      where: { id: validated.data.invitationId },
      select: { id: true, firmId: true, status: true },
    });

    if (!invitation || invitation.firmId !== membership!.firmId) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'That invitation is no longer outstanding.' },
        { status: 409 }
      );
    }

    // The row survives as REVOKED rather than being deleted: who was offered
    // access to a firm's matters, and when it was withdrawn, is part of the
    // record of who could have seen what.
    await prisma.firmInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'REVOKED',
        respondedAt: new Date(),
        // Rotated so the link in an already-sent email stops working.
        token: newInvitationToken(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FIRM_INVITATIONS_DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
