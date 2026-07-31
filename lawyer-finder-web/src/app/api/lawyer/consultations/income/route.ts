import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * GET: The lawyer's own consultation income record.
 *
 * This replaces the previous "earnings + withdrawable balance" endpoint.
 *
 * The platform does not hold consultation fees and therefore has no balance to
 * pay out. Clients pay the lawyer directly using the bank details the lawyer
 * supplies when quoting. What follows is a *record* of fees quoted and marked
 * received by the lawyer — a bookkeeping view, not an account.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER') {
      return NextResponse.json({ error: 'Unauthorized. Lawyer access required.' }, { status: 401 });
    }

    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer profile not found' }, { status: 404 });
    }

    const consultations = await prisma.booking.findMany({
      where: {
        lawyerId: lawyer.id,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
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
        paymentMethod: true,
        client: { select: { fullName: true } },
      },
      orderBy: { date: 'desc' },
    });

    // "Received" = the lawyer confirmed the client's payment reached them.
    // "Awaiting" = quoted and confirmed, but not yet marked as received.
    const received = consultations.filter((c) => c.paidAt !== null);
    const awaiting = consultations.filter((c) => c.paidAt === null);

    const totalReceived = received.reduce((sum, c) => sum + c.lawyerFee, 0);
    const totalAwaiting = awaiting.reduce((sum, c) => sum + c.lawyerFee, 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalReceived,
        totalAwaiting,
        totalConsultations: consultations.length,
        completedConsultations: consultations.filter((c) => c.status === 'COMPLETED').length,
      },
      consultations: consultations.map((c) => ({
        ...c,
        date: c.date.toISOString().split('T')[0],
        paidAt: c.paidAt?.toISOString() || null,
      })),
    });
  } catch (error: unknown) {
    console.error('Failed to load consultation income:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
