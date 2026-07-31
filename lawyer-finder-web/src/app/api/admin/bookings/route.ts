import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { formatSriLankaDateIso, parseDateOnlyToUtc } from '@/lib/utils';
import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const AdminCreateBookingSchema = z.object({
  clientEmail: z.string().email('Valid client email is required'),
  lawyerId: z.string().uuid('Invalid lawyer reference'),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)'),
  mode: z.enum(['PHYSICAL', 'ONLINE']),
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  practiceArea: z.string().optional(),
  status: z.enum(['CONFIRMED', 'PENDING_PAYMENT']).default('CONFIRMED'),
  adminNotes: z.string().max(500).optional(),
});

// POST: Admin creates a booking on behalf of a client
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const validated = AdminCreateBookingSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const {
      clientEmail, lawyerId, date, startTime, endTime,
      mode, subject, description, practiceArea, status, adminNotes,
    } = validated.data;

    // Find the client user by email
    const clientUser = await prisma.user.findUnique({
      where: { email: clientEmail },
      select: { id: true, role: true },
    });

    if (!clientUser) {
      return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 });
    }

    if (clientUser.role !== 'CLIENT') {
      return NextResponse.json({ error: 'The specified user is not a client' }, { status: 400 });
    }

    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { id: lawyerId },
    });

    if (!lawyer) {
      return NextResponse.json({ error: 'Lawyer not found' }, { status: 404 });
    }

    // No fee is set here and the platform derives nothing from one. The lawyer
    // quotes their fee when they accept the request.
    // See docs/restructure/LEGAL-GUARDRAILS.md (rule 1).
    const targetDate = parseDateOnlyToUtc(date);
    const duration = calculateDuration(startTime, endTime);

    // Create booking in a transaction (check for conflicts)
    const booking = await prisma.$transaction(async (tx) => {
      // Check for conflicting bookings
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

      const now = new Date();
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

      // Clean up any holds on this slot
      await tx.slotHold.deleteMany({
        where: {
          lawyerId,
          date: targetDate,
          startTime,
          endTime,
        },
      });

      // Generate booking number, scoped to the current year (see the matching
      // logic in api/consultations/bookings/route.ts).
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

      // Create booking with admin-specified status
      return tx.booking.create({
        data: {
          bookingNumber,
          clientId: clientUser.id,
          lawyerId,
          date: targetDate,
          startTime,
          endTime,
          duration,
          mode: mode as any,
          officeAddress: mode === 'PHYSICAL' ? (lawyer.address || lawyer.district || 'Contact lawyer for address') : null,
          meetingLink: mode === 'ONLINE' ? (lawyer.onlineMeetingLink || null) : null,
          lawyerFee: 0,
          platformFee: 0,
          totalAmount: 0,
          commissionRate: 0,
          subject,
          description: adminNotes 
            ? `[Admin Notes: ${adminNotes}]\n\n${description}`
            : `[Admin Notes: Booking created by admin (call-to-book)]\n\n${description}`,
          practiceArea,
          status: status as any,
          paidAt: status === 'CONFIRMED' ? new Date() : null,
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
    if (error?.message === 'SLOT_TAKEN') {
      return NextResponse.json(
        { error: 'This time slot is already booked. The slot may have been taken since the lawyer confirmed availability.' },
        { status: 409 }
      );
    }
    console.error('Admin booking creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Fetch lawyers list for admin booking form
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'lawyers') {
      const lawyers = await prisma.lawyerProfile.findMany({
        where: {
          isVerified: true,
          consultationPricing: { isNot: null },
        },
        select: {
          id: true,
          fullName: true,
          district: true,
          contactPhone: true,
          // Fee data is not returned. Admin staff do not set or see lawyers' fees.
        },
        orderBy: { fullName: 'asc' },
      });
      return NextResponse.json({ lawyers });
    }

    if (action === 'clients') {
      const search = searchParams.get('search') || '';
      const clients = await prisma.user.findMany({
        where: {
          role: 'CLIENT',
          ...(search ? {
            email: { contains: search, mode: 'insensitive' as any },
          } : {}),
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
        take: 20,
        orderBy: { email: 'asc' },
      });
      return NextResponse.json({ clients });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
