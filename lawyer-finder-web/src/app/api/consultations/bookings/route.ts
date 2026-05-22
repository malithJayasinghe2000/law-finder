import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CreateBookingSchema, BookingFilterSchema } from '@/schemas/consultation.schema';
import { formatSriLankaDateIso, parseDateOnlyToUtc } from '@/lib/utils';

// GET: List bookings (filtered by role)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filters = BookingFilterSchema.safeParse({
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 10,
    });

    if (!filters.success) {
      return NextResponse.json({ error: filters.error.format() }, { status: 400 });
    }

    const { status, dateFrom, dateTo, page, limit } = filters.data;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Role-based filtering
    if (session.role === 'CLIENT') {
      where.clientId = session.userId;
    } else if (session.role === 'LAWYER' && session.profileId) {
      where.lawyerId = session.profileId;
    }
    // ADMIN sees all

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          client: { select: { id: true, fullName: true, email: true, profileImageUrl: true } },
          lawyer: { select: { id: true, fullName: true, profileImageUrl: true, district: true, address: true, contactPhone: true } },
          payment: true,
        },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        ...b,
        date: formatSriLankaDateIso(b.date),
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        paidAt: b.paidAt?.toISOString() || null,
        cancelledAt: b.cancelledAt?.toISOString() || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new booking (CLIENT only) with race-condition protection
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user actually exists in database (handles DB resets while cookie remains)
    const userExists = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true },
    });

    if (!userExists) {
      return NextResponse.json({ error: 'Your session is invalid or your account was deleted. Please log out and log in again.' }, { status: 401 });
    }

    const body = await req.json();
    const validated = CreateBookingSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { lawyerId, date, startTime, endTime, mode, subject, description, practiceArea, paymentMethod } = validated.data;
    const targetDate = parseDateOnlyToUtc(date);
    const now = new Date();

    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { id: lawyerId },
      include: { consultationPricing: true },
    });

    if (!lawyer || !lawyer.consultationPricing) {
      return NextResponse.json({ error: 'Lawyer or pricing not found' }, { status: 404 });
    }

    const minAdvanceNoticeHours = lawyer.consultationPricing.minAdvanceNoticeHours || 24;

    // Enforce dynamic notice period
    const slotDateTime = new Date(`${date}T${startTime}:00+05:30`);
    const minNotice = new Date(now.getTime() + minAdvanceNoticeHours * 60 * 60 * 1000);

    if (slotDateTime < minNotice) {
      return NextResponse.json(
        { error: `Bookings require at least ${minAdvanceNoticeHours} hours advance notice` },
        { status: 400 }
      );
    }

    // For bank transfer (offline), enforce notice + 24 hours (or whatever buffer is preferred, keeping it as max(minNotice, 48h) or just sticking to minNotice)
    if (paymentMethod === 'BANK_TRANSFER') {
      const minOfflineNotice = new Date(now.getTime() + Math.max(48, minAdvanceNoticeHours) * 60 * 60 * 1000);
      if (slotDateTime < minOfflineNotice) {
        return NextResponse.json(
          { error: `Offline payment bookings require at least ${Math.max(48, minAdvanceNoticeHours)} hours advance notice to allow payment verification` },
          { status: 400 }
        );
      }
    }


    // Cannot book yourself
    if (lawyer.userId === session.userId) {
      return NextResponse.json({ error: 'Cannot book a consultation with yourself' }, { status: 400 });
    }

    // Calculate pricing
    const pricing = lawyer.consultationPricing;
    const lawyerFee = mode === 'PHYSICAL' ? pricing.physicalPrice : pricing.onlinePrice;
    const platformFee = Math.round(lawyerFee * pricing.commissionRate);
    const totalAmount = lawyerFee + platformFee;
    const duration = calculateDuration(startTime, endTime);

    // Race-condition-safe booking creation using serializable transaction
    const booking = await prisma.$transaction(async (tx) => {
      // Check for conflicting bookings (atomic check)
      const conflicts = await tx.booking.findMany({
        where: {
          lawyerId,
          date: targetDate,
          status: { notIn: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_LAWYER'] },
          OR: [
            { startTime: { lt: endTime }, endTime: { gt: startTime } },
          ],
        },
      });

      const validConflict = conflicts.find((b) => {
        if (b.status === 'PENDING_PAYMENT') {
          const hoursSinceCreation = (now.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceCreation > 24) return false;
        }
        return true;
      });

      if (validConflict) {
        throw new Error('SLOT_TAKEN');
      }

      // Check for conflicting holds by OTHER clients
      const conflictingHold = await tx.slotHold.findFirst({
        where: {
          lawyerId,
          date: targetDate,
          expiresAt: { gt: new Date() },
          clientId: { not: session.userId },
          OR: [
            { startTime: { lt: endTime }, endTime: { gt: startTime } },
          ],
        },
      });

      if (conflictingHold) {
        throw new Error('SLOT_HELD');
      }

      // Clean up the client's own hold if it exists
      await tx.slotHold.deleteMany({
        where: {
          lawyerId,
          date: targetDate,
          clientId: session.userId,
          startTime,
          endTime,
        },
      });

      // Generate booking number
      const bookingCount = await tx.booking.count();
      const year = new Date().getFullYear();
      const bookingNumber = `BK-${year}-${String(bookingCount + 1).padStart(4, '0')}`;

      // Create booking
      return tx.booking.create({
        data: {
          bookingNumber,
          clientId: session.userId,
          lawyerId,
          date: targetDate,
          startTime,
          endTime,
          duration,
          mode: mode as any,
          officeAddress: mode === 'PHYSICAL' ? (lawyer.address || lawyer.district || 'Contact lawyer for address') : null,
          lawyerFee,
          platformFee,
          totalAmount,
          commissionRate: pricing.commissionRate,
          subject,
          description,
          practiceArea,
          status: 'PENDING_PAYMENT',
        },
      });
    }, {
      isolationLevel: 'Serializable',
    });

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        date: formatSriLankaDateIso(booking.date),
        createdAt: booking.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'SLOT_TAKEN' || error?.message === 'SLOT_HELD') {
      return NextResponse.json(
        { error: 'This time slot has already been booked or is currently being reserved by another client.' },
        { status: 409 }
      );
    }
    console.error('Booking creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
