import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CreateBookingSchema, BookingFilterSchema } from '@/schemas/consultation.schema';
import { formatSriLankaDateIso, parseDateOnlyToUtc } from '@/lib/utils';
import { EmailService } from '@/lib/email/EmailService';

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
        orderBy: { createdAt: 'desc' },
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

    const { lawyerId, date, startTime, endTime, mode, subject, description, practiceArea } = validated.data;
    const targetDate = parseDateOnlyToUtc(date);
    const now = new Date();

    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { id: lawyerId },
      include: { user: { select: { email: true } } },
    });

    // A consultation request no longer depends on the lawyer having configured a
    // price. Previously this 404'd when consultationPricing was missing, which
    // blocked requests entirely in a flow that is not supposed to have prices.
    if (!lawyer || !lawyer.user) {
      return NextResponse.json({ error: 'Lawyer not found' }, { status: 404 });
    }

    // Cannot book yourself
    if (lawyer.userId === session.userId) {
      return NextResponse.json({ error: 'Cannot book a consultation with yourself' }, { status: 400 });
    }

    // No fee is set at request time and the platform never derives one.
    // The lawyer quotes their fee when they accept the request, and the client
    // pays that exact amount directly to the lawyer.
    // See docs/restructure/LEGAL-GUARDRAILS.md (rules 1 and 2).
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

      // Generate booking number, scoped to the current year.
      // Previously this used count() + 1 across all bookings, which collided
      // whenever a booking was deleted and restarted numbering incorrectly at
      // each year boundary. Deriving from the highest existing number for the
      // year is stable; the Serializable isolation level below prevents races.
      const year = new Date().getFullYear();
      const prefix = `BK-${year}-`;

      const latest = await tx.booking.findFirst({
        where: { bookingNumber: { startsWith: prefix } },
        orderBy: { bookingNumber: 'desc' },
        select: { bookingNumber: true },
      });

      const lastSequence = latest
        ? parseInt(latest.bookingNumber.slice(prefix.length), 10) || 0
        : 0;
      const bookingNumber = `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;

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
          lawyerFee: 0,
          platformFee: 0,
          totalAmount: 0,
          commissionRate: 0,
          subject,
          description,
          practiceArea,
          status: 'AWAITING_LAWYER_APPROVAL',
        },
      });
    }, {
      isolationLevel: 'Serializable',
    });

    // Send emails asynchronously
    const client = await prisma.user.findUnique({ where: { id: session.userId } });
    if (client && client.email) {
      const formattedDate = formatSriLankaDateIso(booking.date);
      const clientName = client.fullName || 'Client';
      
      EmailService.sendBookingCreatedClient(client.email, clientName, lawyer.fullName, formattedDate, startTime, booking.bookingNumber);
      
      if (lawyer.user?.email) {
        EmailService.sendBookingCreatedLawyer(lawyer.user.email, lawyer.fullName, clientName, formattedDate, startTime);
      }
      
      EmailService.sendBookingCreatedAdmin(clientName, lawyer.fullName, formattedDate, startTime, booking.bookingNumber);
    }

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
