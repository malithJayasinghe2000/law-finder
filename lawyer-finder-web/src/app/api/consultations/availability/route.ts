import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { LawyerAvailabilitySchema, WeeklyScheduleSchema, AvailableSlotsQuerySchema } from '@/schemas/consultation.schema';
import { parseDateOnlyToUtc } from '@/lib/utils';
import { SLOT_BLOCKING_STATUSES } from '@/lib/consultations/bookingStatus';

// GET: Fetch lawyer's weekly availability schedule OR available slots for a date
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lawyerId = searchParams.get('lawyerId');
    const date = searchParams.get('date');

    // If date provided, return computed available slots for that date
    if (lawyerId && date) {
      const validated = AvailableSlotsQuerySchema.safeParse({ lawyerId, date });
      if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
      }

      const session = await getSession();
      const slots = await getAvailableSlots(validated.data.lawyerId, validated.data.date, session?.userId);
      return NextResponse.json(slots);
    }

    // Otherwise return raw weekly schedule (for lawyer's own dashboard)
    const session = await getSession();
    const targetLawyerId = lawyerId || session?.profileId;

    if (!targetLawyerId) {
      return NextResponse.json({ error: 'Lawyer ID required' }, { status: 400 });
    }

    const availability = await prisma.lawyerAvailability.findMany({
      where: { lawyerId: targetLawyerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(availability);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create or bulk-update weekly availability (LAWYER only)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER' || !session.profileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Support bulk schedule update
    if (body.schedule) {
      const validated = WeeklyScheduleSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
      }

      // Delete existing and replace with new schedule
      await prisma.$transaction(async (tx) => {
        await tx.lawyerAvailability.deleteMany({
          where: { lawyerId: session.profileId! },
        });

        await tx.lawyerAvailability.createMany({
          data: validated.data.schedule.map((slot) => ({
            lawyerId: session.profileId!,
            dayOfWeek: slot.dayOfWeek as any,
            startTime: slot.startTime,
            endTime: slot.endTime,
            slotDuration: slot.slotDuration,
            bufferTime: slot.bufferTime,
            mode: slot.mode as any,
            isActive: slot.isActive,
          })),
        });
      });

      const updated = await prisma.lawyerAvailability.findMany({
        where: { lawyerId: session.profileId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });

      return NextResponse.json({ success: true, availability: updated });
    }

    // Single slot creation
    const validated = LawyerAvailabilitySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const slot = await prisma.lawyerAvailability.upsert({
      where: {
        lawyerId_dayOfWeek_startTime: {
          lawyerId: session.profileId,
          dayOfWeek: validated.data.dayOfWeek as any,
          startTime: validated.data.startTime,
        },
      },
      update: {
        endTime: validated.data.endTime,
        slotDuration: validated.data.slotDuration,
        bufferTime: validated.data.bufferTime,
        mode: validated.data.mode as any,
        isActive: validated.data.isActive,
      },
      create: {
        lawyerId: session.profileId,
        dayOfWeek: validated.data.dayOfWeek as any,
        startTime: validated.data.startTime,
        endTime: validated.data.endTime,
        slotDuration: validated.data.slotDuration,
        bufferTime: validated.data.bufferTime,
        mode: validated.data.mode as any,
        isActive: validated.data.isActive,
      },
    });

    return NextResponse.json({ success: true, slot }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove an availability slot
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'LAWYER' || !session.profileId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const slotId = searchParams.get('id');

    if (!slotId) {
      return NextResponse.json({ error: 'Slot ID is required' }, { status: 400 });
    }

    // Verify ownership
    const slot = await prisma.lawyerAvailability.findFirst({
      where: { id: slotId, lawyerId: session.profileId },
    });

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    await prisma.lawyerAvailability.delete({ where: { id: slotId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============= Slot Computation Engine =============

const DAY_MAP: Record<string, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
  THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

const REVERSE_DAY_MAP: Record<number, string> = {
  0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY',
  4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY',
};

async function getAvailableSlots(lawyerId: string, dateStr: string, currentUserId?: string) {
  const targetDate = parseDateOnlyToUtc(dateStr);
  const dayOfWeek = REVERSE_DAY_MAP[targetDate.getDay()];
  const now = new Date();

  const pricing = await prisma.consultationPricing.findUnique({
    where: { lawyerId },
    include: { lawyer: { select: { contactPhone: true } } }
  });

  const minAdvanceNoticeHours = pricing?.minAdvanceNoticeHours ?? 24;
  const contactPhone = pricing?.lawyer?.contactPhone ?? null;

  // Maximum 30 days ahead
  const maxBookingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (targetDate > maxBookingDate) {
    return { slots: [], message: 'Cannot book more than 30 days in advance' };
  }

  if (targetDate < parseDateOnlyToUtc(now.toISOString().split('T')[0])) {
    return { slots: [], message: 'Cannot book past dates' };
  }

  // Check for date override
  const override = await prisma.availabilityOverride.findUnique({
    where: { lawyerId_date: { lawyerId, date: targetDate } },
  });

  if (override?.isBlocked) {
    return { slots: [], message: override.reason || 'Lawyer is unavailable on this date' };
  }

  // Get weekly rules for this day
  const weeklyRules = await prisma.lawyerAvailability.findMany({
    where: { lawyerId, dayOfWeek: dayOfWeek as any, isActive: true },
    orderBy: { startTime: 'asc' },
  });

  if (weeklyRules.length === 0 && !override) {
    return { slots: [], message: 'Lawyer is not available on this day' };
  }

  // Determine effective time windows
  let timeWindows: { start: string; end: string; slotDuration: number; bufferTime: number; mode: string }[] = [];

  if (override && !override.isBlocked && override.startTime && override.endTime) {
    // Use override times instead of weekly schedule
    const firstRule = weeklyRules[0];
    timeWindows.push({
      start: override.startTime,
      end: override.endTime,
      slotDuration: firstRule?.slotDuration || 60,
      bufferTime: firstRule?.bufferTime || 15,
      mode: firstRule?.mode || 'BOTH',
    });
  } else {
    // Use weekly rules
    timeWindows = weeklyRules.map((rule) => ({
      start: rule.startTime,
      end: rule.endTime,
      slotDuration: rule.slotDuration,
      bufferTime: rule.bufferTime,
      mode: rule.mode,
    }));
  }

  // Get existing bookings for this date (exclude cancelled)
  const rawBookings = await prisma.booking.findMany({
    where: {
      lawyerId,
      date: targetDate,
      status: { in: SLOT_BLOCKING_STATUSES },
    },
    select: { startTime: true, endTime: true, status: true, createdAt: true },
  });

  // The query already restricts to SLOT_BLOCKING_STATUSES, so every row here
  // genuinely occupies its slot. The old 24h grace period for unpaid bookings is
  // gone — an unanswered quote now expires explicitly into QUOTE_EXPIRED.
  const existingBookings = rawBookings;

  // Get active slot holds for this date
  const activeHolds = await prisma.slotHold.findMany({
    where: {
      lawyerId,
      date: targetDate,
      expiresAt: { gt: now },
    },
    select: { startTime: true, endTime: true, clientId: true },
  });

  // Generate slots.
  // Phase 0: no fee information is exposed here. Fees are quoted by the lawyer
  // after they review the request — see docs/restructure/LEGAL-GUARDRAILS.md (rule 1).
  const allSlots: {
    startTime: string;
    endTime: string;
    duration: number;
    mode: string;
    isAvailable: boolean;
    isCallToBook: boolean;
    contactPhone: string | null;
  }[] = [];

  for (const window of timeWindows) {
    const slots = generateTimeSlots(
      window.start,
      window.end,
      window.slotDuration,
      window.bufferTime
    );

    for (const slot of slots) {
      // Check if slot is already booked or held
      const isBooked = existingBookings.some(
        (b) => b.startTime === slot.start ||
               (b.startTime < slot.end && b.endTime > slot.start)
      );

      const isHeld = activeHolds.some(
        (h) => (h.startTime === slot.start ||
               (h.startTime < slot.end && h.endTime > slot.start)) &&
               h.clientId !== currentUserId
      );

      // Check notice period for standard booking
      const slotDateTime = new Date(`${dateStr}T${slot.start}:00+05:30`);
      const minBookingTime = new Date(now.getTime() + minAdvanceNoticeHours * 60 * 60 * 1000);
      const meetsNotice = slotDateTime > minBookingTime;
      const isPast = slotDateTime < now;

      // Slot is available if not booked, not held, and not in the past
      // But if it doesn't meet notice, it's 'Call to Book'
      const isSlotFree = !isBooked && !isHeld && !isPast;

      allSlots.push({
        startTime: slot.start,
        endTime: slot.end,
        duration: window.slotDuration,
        mode: window.mode,
        isAvailable: isSlotFree,
        isCallToBook: false,
        contactPhone,
      });
    }
  }

  return {
    date: dateStr,
    dayOfWeek,
    slots: allSlots,
    // Fee amounts and commission are deliberately NOT returned. Only the
    // non-monetary consultation terms a client needs in order to request a slot.
    consultationTerms: pricing
      ? {
          freeInitialConsultation: pricing.freeInitialConsultation,
          freeConsultationDuration: pricing.freeConsultationDuration,
          minAdvanceNoticeHours: pricing.minAdvanceNoticeHours,
        }
      : null,
  };
}

function generateTimeSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
  bufferTime: number
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + slotDuration <= endMinutes) {
    const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
    const slotEndMin = currentMinutes + slotDuration;
    const slotEnd = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`;

    slots.push({ start: slotStart, end: slotEnd });

    currentMinutes = slotEndMin + bufferTime;
  }

  return slots;
}
