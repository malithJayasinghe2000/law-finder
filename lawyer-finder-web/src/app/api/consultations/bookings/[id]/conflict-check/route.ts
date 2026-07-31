import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RecordConflictCheckSchema } from '@/schemas/consultation.schema';
import { canTransition } from '@/lib/consultations/bookingStatus';

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
      select: { id: true, lawyer: { select: { userId: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Firm-internal only. Deliberately not readable by the client or by ADMIN.
    if (booking.lawyer.userId !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const conflictCheck = await prisma.conflictCheck.findUnique({
      where: { bookingId: id },
    });

    return NextResponse.json({ conflictCheck });
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
      select: { id: true, status: true, lawyer: { select: { userId: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only the attorney whose firm received the request may run the check.
    // Platform staff must never perform or see it.
    if (booking.lawyer.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Only the attorney handling this request can record a conflict check.' },
        { status: 403 }
      );
    }

    const { outcome, screenedParties, notes } = validated.data;

    // A conflict found (or unresolved) means the firm cannot act.
    const nextStatus = outcome === 'CLEAR' ? 'CONFLICT_CHECK' : 'DECLINED';

    if (booking.status !== 'CONFLICT_CHECK' && !canTransition(booking.status, nextStatus)) {
      return NextResponse.json(
        { error: `Cannot record a conflict check on a request in "${booking.status}".` },
        { status: 400 }
      );
    }

    const [conflictCheck] = await prisma.$transaction([
      prisma.conflictCheck.upsert({
        where: { bookingId: id },
        update: { outcome, screenedParties, notes, checkedById: session.userId },
        create: { bookingId: id, outcome, screenedParties, notes, checkedById: session.userId },
      }),
      prisma.booking.update({
        where: { id },
        data:
          outcome === 'CLEAR'
            ? { status: 'CONFLICT_CHECK' }
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

    return NextResponse.json({ success: true, conflictCheck }, { status: 201 });
  } catch (error) {
    console.error('Conflict check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
