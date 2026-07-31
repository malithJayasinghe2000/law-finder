import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { parseDateOnlyToUtc } from '@/lib/utils';

const CreateHoldSchema = z.object({
  lawyerId: z.string().uuid(),
  date: z.string().min(1), // ISO date "2026-05-15"
  startTime: z.string(),
  endTime: z.string(),
});

// POST: Create a temporary slot hold
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = CreateHoldSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { lawyerId, date, startTime, endTime } = validated.data;
    const targetDate = parseDateOnlyToUtc(date);
    const now = new Date();

    // Housekeeping: sweep every expired hold, not just this lawyer's.
    // Expired holds never block a slot (availability filters on expiresAt), but
    // scoping the delete to one lawyer meant rows for lawyers who stopped
    // receiving hold requests were never reclaimed.
    await prisma.slotHold.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Check if slot is currently booked
    const conflictBooking = await prisma.booking.findFirst({
      where: {
        lawyerId,
        date: targetDate,
        status: { notIn: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_LAWYER'] },
        OR: [
          { startTime: { lt: endTime }, endTime: { gt: startTime } },
        ],
      },
    });

    if (conflictBooking) {
      return NextResponse.json({ error: 'This time slot has already been booked.' }, { status: 409 });
    }

    // Check if slot is currently held by someone ELSE
    const activeHold = await prisma.slotHold.findFirst({
      where: {
        lawyerId,
        date: targetDate,
        expiresAt: { gt: now },
        clientId: { not: session.userId }, // Ignore our own previous holds if any
        OR: [
          { startTime: { lt: endTime }, endTime: { gt: startTime } },
        ],
      },
    });

    if (activeHold) {
      return NextResponse.json(
        { error: 'This slot is currently being reserved by another client. Please select a different time or try again in 10 minutes.' },
        { status: 409 }
      );
    }

    // We either have no holds, or the only active hold is our own.
    // Create/update a new hold for 10 minutes.
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now

    const hold = await prisma.slotHold.create({
      data: {
        clientId: session.userId,
        lawyerId,
        date: targetDate,
        startTime,
        endTime,
        expiresAt,
      },
    });

    return NextResponse.json({ success: true, holdId: hold.id, expiresAt: hold.expiresAt }, { status: 201 });
  } catch (error) {
    console.error('Slot hold creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
