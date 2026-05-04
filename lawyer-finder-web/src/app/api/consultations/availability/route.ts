import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { LawyerAvailabilitySchema, WeeklyScheduleSchema, AvailableSlotsQuerySchema } from '@/schemas/consultation.schema';

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

      const slots = await getAvailableSlots(validated.data.lawyerId, validated.data.date);
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

async function getAvailableSlots(lawyerId: string, dateStr: string) {
  const targetDate = new Date(dateStr + 'T00:00:00+05:30');
  const dayOfWeek = REVERSE_DAY_MAP[targetDate.getDay()];
  const now = new Date();

  // Minimum 24 hours notice
  const minBookingTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Maximum 30 days ahead
  const maxBookingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (targetDate > maxBookingDate) {
    return { slots: [], message: 'Cannot book more than 30 days in advance' };
  }

  if (targetDate < new Date(now.toISOString().split('T')[0] + 'T00:00:00+05:30')) {
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
  const existingBookings = await prisma.booking.findMany({
    where: {
      lawyerId,
      date: targetDate,
      status: { notIn: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_LAWYER'] },
    },
    select: { startTime: true, endTime: true },
  });

  // Get pricing info
  const pricing = await prisma.consultationPricing.findUnique({
    where: { lawyerId },
  });

  // Generate slots
  const allSlots: {
    startTime: string;
    endTime: string;
    duration: number;
    mode: string;
    isAvailable: boolean;
    physicalPrice: number | null;
    onlinePrice: number | null;
    platformFee: number | null;
  }[] = [];

  for (const window of timeWindows) {
    const slots = generateTimeSlots(
      window.start,
      window.end,
      window.slotDuration,
      window.bufferTime
    );

    for (const slot of slots) {
      // Check if slot is already booked
      const isBooked = existingBookings.some(
        (b) => b.startTime === slot.start || 
               (b.startTime < slot.end && b.endTime > slot.start)
      );

      // Check notice period (24 hours minimum)
      const slotDateTime = new Date(`${dateStr}T${slot.start}:00+05:30`);
      const meetsNotice = slotDateTime > minBookingTime;

      const commissionRate = pricing?.commissionRate || 0.15;
      const physicalPrice = pricing?.physicalPrice || null;
      const onlinePrice = pricing?.onlinePrice || null;

      allSlots.push({
        startTime: slot.start,
        endTime: slot.end,
        duration: window.slotDuration,
        mode: window.mode,
        isAvailable: !isBooked && meetsNotice,
        physicalPrice,
        onlinePrice,
        platformFee: physicalPrice ? Math.round(physicalPrice * commissionRate) : null,
      });
    }
  }

  return {
    date: dateStr,
    dayOfWeek,
    slots: allSlots,
    pricing: pricing
      ? {
          pricingType: pricing.pricingType,
          physicalPrice: pricing.physicalPrice,
          onlinePrice: pricing.onlinePrice,
          commissionRate: pricing.commissionRate,
          freeInitialConsultation: pricing.freeInitialConsultation,
          freeConsultationDuration: pricing.freeConsultationDuration,
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
