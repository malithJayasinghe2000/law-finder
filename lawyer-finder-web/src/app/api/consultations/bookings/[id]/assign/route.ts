import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AssignMatterSchema } from '@/schemas/firm.schema';
import {
  getFirmMembership,
  resolveMatterAccess,
  assertAttorneyBelongsToFirm,
} from '@/lib/firms/access';
import { isTerminal, SLOT_BLOCKING_STATUSES } from '@/lib/consultations/bookingStatus';
import { EmailService } from '@/lib/email/EmailService';

/**
 * Reassign a matter to a different attorney inside the same firm.
 *
 * This is the one place where responsibility for a matter moves, and it is
 * hedged on all sides:
 *
 *  - Only a FIRM_OWNER or FIRM_ADMIN of the owning firm may do it. The platform
 *    never assigns anyone; a request lands with the attorney the client chose
 *    and only the firm can move it (guardrail rule 4).
 *  - The new attorney must be an active *attorney* member of the same firm.
 *    Nothing can move a matter to another practice — that would be a referral.
 *  - Availability is per attorney and is never collapsed to the firm, so the
 *    receiving attorney's own diary is checked for a clash before the move.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 3, 4 and 5).
 */

/** GET: who at this firm could take this matter. */
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
      select: { id: true, lawyerId: true, firmId: true, clientId: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const membership =
      // Not gated on LAWYER: a practice manager's account is CLIENT, and
      // assigning is exactly their job. Authority comes from membership.
      session.role === 'ADMIN' ? null : await getFirmMembership(session.userId);

    const access = resolveMatterAccess({
      actorUserId: session.userId,
      actorRole: session.role,
      actorProfileId: session.profileId,
      membership,
      matter: booking,
    });

    if (!access.canAssign) {
      return NextResponse.json(
        { error: 'Only a principal or practice manager of this firm can reassign a matter.' },
        { status: 403 }
      );
    }

    // Attorneys of this firm, alphabetically. Deliberately not ordered by
    // workload, seniority, or anything else that would amount to the software
    // nudging the firm toward a particular person.
    const members = await prisma.firmMember.findMany({
      where: {
        firmId: booking.firmId!,
        status: 'ACTIVE',
        role: { in: ['FIRM_OWNER', 'ATTORNEY'] },
      },
      select: {
        role: true,
        title: true,
        user: {
          select: {
            id: true,
            fullName: true,
            profile: {
              select: { id: true, fullName: true, practiceAreas: true, isVerified: true },
            },
          },
        },
      },
    });

    const attorneys = members
      .filter((m) => m.user.profile)
      .map((m) => ({
        profileId: m.user.profile!.id,
        fullName: m.user.profile!.fullName,
        practiceAreas: m.user.profile!.practiceAreas,
        isVerified: m.user.profile!.isVerified,
        firmRole: m.role,
        title: m.title,
        isCurrent: m.user.profile!.id === booking.lawyerId,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json({ attorneys, currentLawyerId: booking.lawyerId });
  } catch (error) {
    console.error('Assignment options error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: move the matter to another attorney at the same firm. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = AssignMatterSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { attorneyProfileId, note } = validated.data;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        bookingNumber: true,
        lawyerId: true,
        firmId: true,
        clientId: true,
        status: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (!booking.firmId) {
      return NextResponse.json(
        { error: 'This request is not associated with a firm and cannot be reassigned.' },
        { status: 400 }
      );
    }

    const membership =
      // Not gated on LAWYER: a practice manager's account is CLIENT, and
      // assigning is exactly their job. Authority comes from membership.
      session.role === 'ADMIN' ? null : await getFirmMembership(session.userId);

    const access = resolveMatterAccess({
      actorUserId: session.userId,
      actorRole: session.role,
      actorProfileId: session.profileId,
      membership,
      matter: booking,
    });

    if (!access.canAssign) {
      return NextResponse.json(
        { error: 'Only a principal or practice manager of this firm can reassign a matter.' },
        { status: 403 }
      );
    }

    if (isTerminal(booking.status)) {
      return NextResponse.json(
        { error: 'This matter is closed and can no longer be reassigned.' },
        { status: 400 }
      );
    }

    if (attorneyProfileId === booking.lawyerId) {
      return NextResponse.json(
        { error: 'That attorney already has this matter.' },
        { status: 400 }
      );
    }

    // The invariant that keeps lawyerId and firmId consistent.
    const belongs = await assertAttorneyBelongsToFirm(attorneyProfileId, booking.firmId);
    if (!belongs.ok) {
      return NextResponse.json({ error: belongs.reason }, { status: 400 });
    }

    // Each attorney keeps their own calendar. Moving a matter must not silently
    // double-book the attorney receiving it.
    //
    // A matter that arrived through firm-first intake has no appointment yet, so
    // there is nothing to clash with — the receiving attorney will propose a
    // time from their own diary when they quote.
    if (booking.date && booking.startTime && booking.endTime) {
      const clash = await prisma.booking.findFirst({
        where: {
          id: { not: booking.id },
          lawyerId: attorneyProfileId,
          date: booking.date,
          status: { in: SLOT_BLOCKING_STATUSES },
          startTime: { lt: booking.endTime },
          endTime: { gt: booking.startTime },
        },
        select: { bookingNumber: true, startTime: true, endTime: true },
      });

      if (clash) {
        return NextResponse.json(
          {
            error:
              `That attorney already has a matter at this time ` +
              `(${clash.startTime}–${clash.endTime}). Reschedule one of them first.`,
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        lawyerId: attorneyProfileId,
        assignedById: session.userId,
        assignedAt: new Date(),
        assignmentNote: note || null,
      },
      select: {
        id: true,
        bookingNumber: true,
        lawyerId: true,
        lawyer: {
          select: { fullName: true, user: { select: { email: true } } },
        },
        client: { select: { fullName: true, email: true } },
        firm: { select: { name: true } },
      },
    });

    // Tell the client which attorney at the firm is now handling their matter.
    // They engaged the firm, but they are entitled to know who is acting.
    if (updated.client?.email && updated.lawyer) {
      EmailService.sendMatterReassignedClient(
        updated.client.email,
        updated.client.fullName || 'Client',
        updated.bookingNumber,
        updated.firm?.name ?? 'The firm',
        updated.lawyer.fullName
      );
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: updated.id,
        lawyerId: updated.lawyerId,
        lawyerName: updated.lawyer?.fullName ?? null,
      },
    });
  } catch (error) {
    console.error('Assignment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
