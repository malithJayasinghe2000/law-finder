import { NextResponse } from 'next/server';
import type { BookingStatus } from '@prisma/client';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';

/**
 * GET: the practice's fee record.
 *
 * The platform does not hold fees and has no balance to pay out. Clients pay the
 * PRACTICE directly, into the account on its quotes. What follows is a *record* of
 * fees proposed, accepted and received — a bookkeeping view, not an account.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
 *
 * WHO SEES WHAT. The fee is paid to the practice, so the principal and practice
 * manager see every matter's fee; an attorney sees the matters assigned to them; a
 * paralegal sees none. This used to be per attorney and LAWYER-only, so a principal
 * could not see the practice's fees and a practice manager was refused outright.
 *
 * WHAT COUNTS WHERE. "Awaiting payment" used to be drawn only from SCHEDULED and
 * COMPLETED — but a request is scheduled only once the practice has confirmed the
 * payment, so it could never hold anything. Accepted-but-unpaid requests are the
 * ones awaiting payment.
 */

/** The client has the fee proposal and has not answered yet. */
const PROPOSED: BookingStatus[] = ['QUOTED'];
/** The client accepted the terms; the practice has not confirmed the payment. */
const AWAITING: BookingStatus[] = ['ACCEPTED'];
/** Paid and still standing. Cancelled after payment is left out: it may be refunded. */
const RECEIVED: BookingStatus[] = ['SCHEDULED', 'RESCHEDULE_REQUESTED', 'COMPLETED', 'NO_SHOW', 'DISPUTED'];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getFirmMembership(session.userId);
    if (!membership) {
      return NextResponse.json({ error: 'You are not part of a practice.' }, { status: 403 });
    }

    const firmWide = canManageFirm(membership);
    if (!firmWide && !membership.profileId) {
      return NextResponse.json(
        { error: "Only the practice's principal, practice manager and attorneys can see fees." },
        { status: 403 }
      );
    }

    const records = await prisma.booking.findMany({
      where: {
        firmId: membership.firmId,
        ...(firmWide ? {} : { lawyerId: membership.profileId }),
        status: { in: [...PROPOSED, ...AWAITING, ...RECEIVED] },
      },
      select: {
        id: true,
        bookingNumber: true,
        date: true,
        startTime: true,
        endTime: true,
        mode: true,
        lawyerFee: true,
        paidAt: true,
        status: true,
        updatedAt: true,
        client: { select: { fullName: true } },
        lawyer: { select: { fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const stage = (status: BookingStatus, paidAt: Date | null) =>
      PROPOSED.includes(status) ? 'PROPOSED'
        : AWAITING.includes(status) || !paidAt ? 'AWAITING'
        : 'RECEIVED';

    const sum = (s: string) =>
      records.filter((r) => stage(r.status, r.paidAt) === s).reduce((t, r) => t + r.lawyerFee, 0);

    return NextResponse.json({
      success: true,
      scope: firmWide ? 'PRACTICE' : 'ATTORNEY',
      firmName: membership.firmName,
      stats: {
        totalReceived: sum('RECEIVED'),
        totalAwaiting: sum('AWAITING'),
        totalProposed: sum('PROPOSED'),
        completedConsultations: records.filter((r) => r.status === 'COMPLETED').length,
      },
      consultations: records.map((r) => ({
        ...r,
        stage: stage(r.status, r.paidAt),
        date: r.date ? r.date.toISOString().split('T')[0] : null,
        paidAt: r.paidAt?.toISOString() || null,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    console.error('Failed to load the fee record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
