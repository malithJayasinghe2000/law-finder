import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AddFirmMemberSchema, UpdateFirmMemberSchema } from '@/schemas/firm.schema';
import { getFirmMembership, canManageMembers } from '@/lib/firms/access';
import { canAddFirmMember } from '@/lib/firms/billing';
import { checkJoinEligibility, admitMemberToFirm } from '@/lib/firms/invitations';

/**
 * Firm membership.
 *
 * Adding someone to a firm widens who can see privileged material, so this is
 * restricted to the principal (FIRM_OWNER) and every change is deliberate:
 *
 *  - a member must already have a platform account; we do not create users here
 *  - an ATTORNEY member must have a verified LawyerProfile, because a matter can
 *    only be the responsibility of an admitted attorney
 *  - members are never hard-deleted, only marked REMOVED, so the history of who
 *    could have seen a matter survives
 *
 * What a PARALEGAL or FIRM_ADMIN may actually read is decided in
 * src/lib/firms/access.ts, not here. See LEGAL-GUARDRAILS.md (rule 5) and
 * counsel question 8(b).
 */

/** POST: add an existing platform user to the firm. */
export async function POST(req: Request) {
  try {
    // Deliberately NOT gated on `session.role === 'LAWYER'`.
    //
    // A practice manager or paralegal is not an admitted attorney, so their
    // platform role is CLIENT. Gating here locked every non-attorney member out
    // of their own firm's screens — the same defect as in `resolveMatterAccess`,
    // one layer up. Authority comes from MEMBERSHIP, which is loaded below and
    // then narrowed by `canManageFirm` / `canManageMembers`.
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getFirmMembership(session.userId);
    if (!canManageMembers(membership)) {
      return NextResponse.json(
        { error: 'Only the principal of the firm can add members.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = AddFirmMemberSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { email, role, title } = validated.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, fullName: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            'No account exists with that email address. Send them an invitation instead — ' +
            'they will find the firm waiting when they register.',
          suggestInvitation: true,
        },
        { status: 404 }
      );
    }

    // The rules about who may hold which role live in one place, shared with the
    // invitation flow. They used to be written out here and only here, which is
    // why the invitation path had to be built against the same rule rather than
    // a second copy of it.
    const eligibility = await checkJoinEligibility({
      firmId: membership!.firmId,
      role,
      userId: user.id,
    });

    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.reason }, { status: eligibility.status });
    }

    // Seats. This is a licensing limit on how many PEOPLE may use the software,
    // and nothing else. It does not cap matters, clients, enquiries or messages
    // — metering any of those would make our revenue move with the volume of
    // legal work, which is fee-sharing under a different name (guardrail rule
    // 1). A firm on one seat may run a thousand matters; it just does so with
    // one login.
    const seatCheck = await canAddFirmMember(membership!.firmId);
    if (!seatCheck.allowed) {
      return NextResponse.json({ error: seatCheck.reason }, { status: 402 });
    }

    await prisma.$transaction((tx) =>
      admitMemberToFirm(tx, {
        firmId: membership!.firmId,
        userId: user.id,
        role,
        title,
        invitedById: session.userId,
      })
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Add firm member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH: change a member's role, title, or status. */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getFirmMembership(session.userId);
    if (!canManageMembers(membership)) {
      return NextResponse.json(
        { error: 'Only the principal of the firm can change members.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = UpdateFirmMemberSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { memberId, role, title, status } = validated.data;

    const member = await prisma.firmMember.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firmId: true,
        userId: true,
        role: true,
        status: true,
        user: { select: { profile: { select: { id: true } } } },
      },
    });

    if (!member || member.firmId !== membership!.firmId) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    // Bringing a removed member back consumes a seat just as adding a new one
    // does. Without this, "remove then re-add" is a way around the licence.
    if (status === 'ACTIVE' && member.status !== 'ACTIVE') {
      const seatCheck = await canAddFirmMember(membership!.firmId);
      if (!seatCheck.allowed) {
        return NextResponse.json({ error: seatCheck.reason }, { status: 402 });
      }
    }

    // A firm must always have someone who can administer it and answer for it.
    if (member.role === 'FIRM_OWNER' && (role !== 'FIRM_OWNER' || status === 'REMOVED')) {
      const owners = await prisma.firmMember.count({
        where: { firmId: membership!.firmId, role: 'FIRM_OWNER', status: 'ACTIVE' },
      });
      if (owners <= 1) {
        return NextResponse.json(
          {
            error:
              'A firm must have at least one principal. Appoint another before changing this one.',
          },
          { status: 400 }
        );
      }
    }

    // Removing someone who still holds matters would orphan them.
    if (status === 'REMOVED' && member.user.profile) {
      const open = await prisma.booking.count({
        where: {
          lawyerId: member.user.profile.id,
          firmId: membership!.firmId,
          status: {
            notIn: [
              'COMPLETED',
              'DECLINED',
              'QUOTE_EXPIRED',
              'CLIENT_DECLINED',
              'CANCELLED_BY_CLIENT',
              'CANCELLED_BY_FIRM',
              'NO_SHOW',
            ],
          },
        },
      });

      if (open > 0) {
        return NextResponse.json(
          {
            error: `That attorney is still responsible for ${open} open ${
              open === 1 ? 'matter' : 'matters'
            }. Reassign them before removing the member.`,
          },
          { status: 409 }
        );
      }
    }

    await prisma.firmMember.update({
      where: { id: memberId },
      data: {
        ...(role ? { role } : {}),
        ...(title !== undefined ? { title: title || null } : {}),
        ...(status
          ? { status, removedAt: status === 'REMOVED' ? new Date() : null }
          : {}),
      },
    });

    // A removed member no longer practises in the firm.
    if (status === 'REMOVED' && member.user.profile) {
      await prisma.lawyerProfile.update({
        where: { id: member.user.profile.id },
        data: { firmId: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update firm member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
