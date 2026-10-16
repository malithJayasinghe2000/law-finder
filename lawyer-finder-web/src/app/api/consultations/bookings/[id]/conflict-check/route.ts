import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RecordConflictCheckSchema } from '@/schemas/consultation.schema';
import { EmailService } from '@/lib/email/EmailService';
import { getMatterAccess, discloseField, discloseFieldList } from '@/lib/firms/access';
import { recordAccess, actorRoleFor } from '@/lib/privacy/audit';
import { encryptField, encryptFieldList } from '@/lib/privacy/encryption';

/**
 * Conflict-of-interest screening.
 *
 * A firm must not act where it holds a conflicting interest — this is a
 * professional duty, not an optional step, and recording it gives the firm an
 * auditable trail.
 *
 * The screening record is PRIVILEGED AND FIRM-INTERNAL. Neither the client nor
 * platform staff may read `notes` or `screenedParties`.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
 */

/** GET: the firm reads its own conflict check for this request. */
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
        id: true,
        lawyerId: true,
        firmId: true,
        clientId: true,
        lawyer: { select: { userId: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Firm-internal only, and narrower than the rest of the matter.
    //
    // A conflict check names OTHER clients — that is the whole point of it — so
    // it is confidential to those clients as much as to this one. It is readable
    // by the attorney acting and by the firm's principal (who must be able to
    // check that screening actually happened), and by nobody else: not the
    // client, not another attorney at the firm, not platform staff.
    // See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
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

    const mayReadScreening =
      access.basis === 'ASSIGNED_ATTORNEY' || access.basis === 'FIRM_PRINCIPAL';

    if (!mayReadScreening) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const conflictCheck = await prisma.conflictCheck.findUnique({
      where: { bookingId: id },
    });

    // The sharpest read in the system: this record names other firms' clients
    // and opposing parties. Reading it is always worth recording.
    if (conflictCheck) {
      await recordAccess({
        actorUserId: session.userId,
        actorRole: actorRoleFor({ sessionRole: session.role, firmRole: access.basis }),
        resource: 'CONFLICT_CHECK',
        resourceId: conflictCheck.id,
        action: 'READ_DETAIL',
        bookingId: booking.id,
        firmId: booking.firmId,
      });
    }

    // `notes` and `screenedParties` are stored encrypted, bound to this
    // booking id. Only this reader — who has just been proved to be the acting
    // attorney or the principal — gets them back as words.
    return NextResponse.json({
      conflictCheck: conflictCheck && {
        ...conflictCheck,
        notes: discloseField({
          access,
          model: 'ConflictCheck',
          recordId: booking.id,
          field: 'notes',
          stored: conflictCheck.notes,
        }),
        screenedParties: discloseFieldList({
          access,
          model: 'ConflictCheck',
          recordId: booking.id,
          field: 'screenedParties',
          stored: conflictCheck.screenedParties,
        }),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: record the outcome of the firm's screening. */
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
    const validated = RecordConflictCheckSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        lawyerId: true,
        firmId: true,
        clientId: true,
        lawyer: { select: { userId: true } },
        bookingNumber: true,
        client: { select: { email: true, fullName: true } },
        firm: { select: { name: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only the attorney who will actually do the work may run the check.
    //
    // Not the principal, and not a practice manager: screening for conflicts is
    // a professional duty of the attorney taking the matter, and a record signed
    // by someone else is worth nothing if it is ever tested.
    if (!booking.lawyer) {
      return NextResponse.json(
        {
          error:
            'This matter has not been assigned to an attorney yet. A principal must assign it before the conflict check can be run.',
        },
        { status: 400 }
      );
    }

    if (booking.lawyer.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Only the attorney handling this request can record a conflict check.' },
        { status: 403 }
      );
    }

    const { outcome, screenedParties, notes } = validated.data;

    // Encrypted at rest, bound to the booking id.
    //
    // `ConflictCheck` is keyed 1:1 on `bookingId`, so the binding value is
    // already known here and no id has to be generated for the upsert. The
    // outcome itself stays in the clear — the firm needs to query on it, and
    // "this firm declined a matter" is not the confidential part. The names
    // screened are, because they belong to OTHER clients.
    const encryptedNotes = encryptField(
      { model: 'ConflictCheck', recordId: id, field: 'notes' },
      notes
    );
    const encryptedParties = encryptFieldList(
      { model: 'ConflictCheck', recordId: id, field: 'screenedParties' },
      screenedParties
    );

    // CLEAR      → the firm may act; the request moves on to a quote.
    // FOUND      → the firm cannot act; the request is declined.
    // NEEDS_REVIEW → on hold. The record is kept, the request stays a new
    //   request (or goes back to one, if it had been cleared), and nothing can be
    //   quoted until the attorney screens it again. It used to decline at once,
    //   which made "unresolved" mean exactly the same as "conflict found".
    const nextStatus =
      outcome === 'CLEAR' ? 'CONFLICT_CHECK' : outcome === 'NEEDS_REVIEW' ? 'REQUESTED' : 'DECLINED';

    // Screening is recorded before the firm quotes, and may be re-run until then.
    if (booking.status !== 'REQUESTED' && booking.status !== 'CONFLICT_CHECK') {
      return NextResponse.json(
        { error: `Cannot record a conflict check on a request in "${booking.status}".` },
        { status: 400 }
      );
    }

    const [conflictCheck] = await prisma.$transaction([
      prisma.conflictCheck.upsert({
        where: { bookingId: id },
        update: {
          outcome,
          screenedParties: encryptedParties,
          notes: encryptedNotes,
          checkedById: session.userId,
        },
        create: {
          bookingId: id,
          outcome,
          screenedParties: encryptedParties,
          notes: encryptedNotes,
          checkedById: session.userId,
        },
      }),
      prisma.booking.update({
        where: { id },
        data:
          outcome !== 'CONFLICT_FOUND'
            ? { status: nextStatus }
            : {
                status: 'DECLINED',
                // The client is told the firm cannot act, never why — the reason
                // is itself confidential to the other client involved.
                lawyerRemarks: 'The firm is unable to act in this matter.',
                cancelledAt: new Date(),
                cancelledBy: session.userId,
              },
      }),
    ]);

    // Tell the client, without the reason — it is confidential to the other
    // client involved. Before this they found out only by opening their dashboard.
    if (outcome === 'CONFLICT_FOUND' && booking.client?.email) {
      EmailService.sendRequestDeclined({
        to: booking.client.email,
        clientName: booking.client.fullName || 'Client',
        firmName: booking.firm?.name ?? 'The practice',
        bookingNumber: booking.bookingNumber,
      });
    }

    // Echo back what the attorney just typed, not the ciphertext of it.
    return NextResponse.json(
      {
        success: true,
        conflictCheck: { ...conflictCheck, screenedParties, notes },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Conflict check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
