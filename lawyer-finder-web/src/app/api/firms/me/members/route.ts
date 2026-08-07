import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AddFirmMemberSchema, UpdateFirmMemberSchema } from '@/schemas/firm.schema';
import { getFirmMembership, canManageMembers } from '@/lib/firms/access';
import { canAddFirmMember } from '@/lib/firms/billing';

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
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
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
      select: {
        id: true,
        fullName: true,
        profile: { select: { id: true, isVerified: true, firmId: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            'No account exists with that email address. Ask them to register first, then add them.',
        },
        { status: 404 }
      );
    }

    if (role === 'ATTORNEY' || role === 'FIRM_OWNER') {
      if (!user.profile) {
        return NextResponse.json(
          {
            error:
              'That person is not registered as an Attorney-at-Law. Only an admitted attorney can hold this role.',
          },
          { status: 400 }
        );
      }
      if (!user.profile.isVerified) {
        return NextResponse.json(
          {
            error:
              'That attorney has not completed BASL verification yet. They can be added once verified.',
          },
          { status: 400 }
        );
      }
      if (user.profile.firmId && user.profile.firmId !== membership!.firmId) {
        return NextResponse.json(
          {
            error:
              'That attorney already practises in another firm on this platform. They must leave it first.',
          },
          { status: 409 }
        );
      }
    }

    const existing = await prisma.firmMember.findUnique({
      where: { firmId_userId: { firmId: membership!.firmId, userId: user.id } },
      select: { id: true, status: true },
    });

    if (existing && existing.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'That person is already a member of this firm.' },
        { status: 409 }
      );
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

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.firmMember.update({
          where: { id: existing.id },
          data: { role, title: title || null, status: 'ACTIVE', removedAt: null },
        });
      } else {
        await tx.firmMember.create({
          data: {
            firmId: membership!.firmId,
            userId: user.id,
            role,
            title: title || null,
            status: 'ACTIVE',
            invitedById: session.userId,
            invitedAt: new Date(),
          },
        });
      }

      // An attorney joining a firm practises in that firm.
      if ((role === 'ATTORNEY' || role === 'FIRM_OWNER') && user.profile) {
        await tx.lawyerProfile.update({
          where: { id: user.profile.id },
          data: { firmId: membership!.firmId },
        });
      }

      // The moment a firm has more than one member it stops being a firm of one.
      // It must then be verified in its own right rather than inheriting the
      // standing of its founder, so the badge is withdrawn until we re-check.
      const activeCount = await tx.firmMember.count({
        where: { firmId: membership!.firmId, status: 'ACTIVE' },
      });

      if (activeCount > 1) {
        await tx.lawFirm.update({
          where: { id: membership!.firmId },
          data: {
            isSoloPractice: false,
            firmType: 'PARTNERSHIP',
            verificationStatus: 'PENDING',
            verifiedAt: null,
            verificationNotes:
              'Re-verification required: the practice is no longer a sole practitioner.',
          },
        });
      }
    });

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
    if (!session || session.role !== 'LAWYER') {
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
