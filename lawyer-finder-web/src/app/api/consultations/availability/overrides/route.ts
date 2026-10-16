import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AvailabilityOverrideSchema } from '@/schemas/consultation.schema';
import { parseDateOnlyToUtc } from '@/lib/utils';
import { SLOT_BLOCKING_STATUSES } from '@/lib/consultations/bookingStatus';

// GET: Fetch lawyer's date overrides for a month
export async function GET(req: Request) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const lawyerId = searchParams.get('lawyerId') || session?.profileId;
    const month = searchParams.get('month'); // "2026-05"
    const year = searchParams.get('year');

    if (!lawyerId) {
      return NextResponse.json({ error: 'Lawyer ID required' }, { status: 400 });
    }

    const where: any = { lawyerId };

    if (month) {
      const [y, m] = month.split('-').map(Number);
      where.date = {
        gte: new Date(`${y}-${String(m).padStart(2, '0')}-01`),
        lt: new Date(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`),
      };
    }

    const overrides = await prisma.availabilityOverride.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(overrides);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add a date override or block a date (LAWYER only)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER' || !session.profileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = AvailabilityOverrideSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const targetDate = parseDateOnlyToUtc(validated.data.date);
    const now = new Date();

    // Cannot override past dates
    if (targetDate < parseDateOnlyToUtc(now.toISOString().split('T')[0])) {
      return NextResponse.json({ error: 'Cannot modify past dates' }, { status: 400 });
    }

    // Check for existing confirmed bookings on this date before blocking
    if (validated.data.isBlocked) {
      const existingBookings = await prisma.booking.count({
        where: {
          lawyerId: session.profileId,
          date: targetDate,
          status: { in: SLOT_BLOCKING_STATUSES },
        },
      });

      if (existingBookings > 0) {
        return NextResponse.json({
          error: `Cannot block this date - ${existingBookings} booking(s) exist. Cancel them first.`,
        }, { status: 409 });
      }
    }

    const override = await prisma.availabilityOverride.upsert({
      where: {
        lawyerId_date: {
          lawyerId: session.profileId,
          date: targetDate,
        },
      },
      update: {
        isBlocked: validated.data.isBlocked,
        startTime: validated.data.isBlocked ? null : validated.data.startTime,
        endTime: validated.data.isBlocked ? null : validated.data.endTime,
        reason: validated.data.reason,
      },
      create: {
        lawyerId: session.profileId,
        date: targetDate,
        isBlocked: validated.data.isBlocked,
        startTime: validated.data.isBlocked ? null : validated.data.startTime,
        endTime: validated.data.isBlocked ? null : validated.data.endTime,
        reason: validated.data.reason,
      },
    });

    return NextResponse.json({ success: true, override }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a date override (LAWYER only)
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER' || !session.profileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const overrideId = searchParams.get('id');

    if (!overrideId) {
      return NextResponse.json({ error: 'Override ID is required' }, { status: 400 });
    }

    const override = await prisma.availabilityOverride.findFirst({
      where: { id: overrideId, lawyerId: session.profileId },
    });

    if (!override) {
      return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    }

    await prisma.availabilityOverride.delete({ where: { id: overrideId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
