import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CreateBookingSchema, BookingFilterSchema } from '@/schemas/consultation.schema';
import { formatSriLankaDateIso, formatSriLankaDateIsoOrNull, parseDateOnlyToUtc } from '@/lib/utils';
import { EmailService } from '@/lib/email/EmailService';
import { SLOT_BLOCKING_STATUSES } from '@/lib/consultations/bookingStatus';
import { expireStaleQuotes } from '@/lib/consultations/expireQuotes';
import { getFirmMembership, resolveMatterAccess, discloseMatter } from '@/lib/firms/access';
import { encryptField } from '@/lib/privacy/encryption';
import { randomUUID } from 'crypto';
import { findAttorneyFirmId } from '@/lib/firms/provisioning';
import { isListedFirm } from '@/lib/directory';
import { ATTORNEY_BOOKING_ENABLED } from '@/lib/directoryLinks';
import { nextBookingNumber } from '@/lib/consultations/bookingNumber';
import { staffRequestView } from '@/lib/consultations/staffView';

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

    // Sweep lapsed quotes so a stale QUOTED row cannot keep blocking a slot.
    await expireStaleQuotes();

    const { status, dateFrom, dateTo, page, limit } = filters.data;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Role-based filtering.
    //
    // Phase 2: an attorney sees their FIRM's matters, not only their own. That
    // is what makes a firm queue possible — a principal has to be able to see a
    // request in order to assign it. What each of them may *read* about those
    // matters is decided per row below, by src/lib/firms/access.ts.
    //
    // Membership is loaded for everyone but platform staff: a practice manager
    // or paralegal is not an admitted attorney, so their account is CLIENT, and
    // gating this on LAWYER left a manager with an empty queue. The client and
    // firm dashboards share this endpoint, so a CLIENT account gets the firm's
    // queue only when the firm dashboard asks for it (`scope=firm`) — otherwise
    // a manager's own requests as a client would vanish from their client view.
    const membership =
      session.role === 'ADMIN' ? null : await getFirmMembership(session.userId);
    const firmView = session.role === 'LAWYER' || searchParams.get('scope') === 'firm';

    if (session.role === 'CLIENT' && !firmView) {
      where.clientId = session.userId;
    } else if (session.role !== 'ADMIN') {
      if (membership) {
        where.firmId = membership.firmId;
      } else if (session.profileId) {
        // An attorney with no firm yet (pre-Phase-2 profile that has not been
        // through the backfill). Falls back to their own matters so nothing
        // disappears from their dashboard.
        where.lawyerId = session.profileId;
      } else {
        where.id = '__no_access__';
      }
    }
    // ADMIN sees that matters exist, never what they are about.

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    // Platform staff get the slim view only (src/lib/consultations/staffView.ts),
    // and may look a request up by its number.
    if (session.role === 'ADMIN') {
      const number = searchParams.get('q')?.trim().slice(0, 40);
      if (number) where.bookingNumber = { contains: number, mode: 'insensitive' };

      const [rows, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          select: { id: true, bookingNumber: true, status: true, createdAt: true, firm: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.booking.count({ where }),
      ]);

      return NextResponse.json({
        bookings: rows.map(staffRequestView),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          client: { select: { id: true, fullName: true, email: true, profileImageUrl: true } },
          lawyer: { select: { id: true, fullName: true, profileImageUrl: true, district: true, address: true, contactPhone: true } },
          firm: { select: { name: true } },
          payment: true,
          conflictCheck: { select: { outcome: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    // Legal professional privilege (Evidence Ordinance s.126).
    //
    // Who may read the client's own account of their legal problem is decided in
    // exactly one place — src/lib/firms/access.ts — and applied per row. Platform
    // staff never may; inside a firm, only the assigned attorney and the
    // principal do. See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
    return NextResponse.json({
      bookings: bookings.map(({ conflictCheck, ...b }) => {
        const access = resolveMatterAccess({
          actorUserId: session.userId,
          actorRole: session.role,
          actorProfileId: session.profileId,
          membership,
          matter: { lawyerId: b.lawyerId, firmId: b.firmId, clientId: b.clientId },
        });

        return {
        ...discloseMatter(b, access),
        access: {
          canReadMatterDetail: access.canReadMatterDetail,
          canAct: access.canAct,
          canAssign: access.canAssign,
          basis: access.basis,
        },
        // Firm side only. The client is told whether the firm can act, never
        // the screening behind it — that concerns another client.
        conflictOutcome:
          access.basis === 'CLIENT' || access.basis === 'PLATFORM_STAFF'
            ? null
            : conflictCheck?.outcome ?? null,
        date: formatSriLankaDateIsoOrNull(b.date),
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        paidAt: b.paidAt?.toISOString() || null,
        cancelledAt: b.cancelledAt?.toISOString() || null,
        };
      }),
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

    const { lawyerId, firmId: requestedFirmId, date, startTime, endTime, mode, subject, description, practiceArea } = validated.data;

    // Two lawful ways in. Both are the CLIENT choosing; neither is us choosing.
    //   attorney-first — they named a practitioner and picked one of their slots
    //   firm-first     — they engaged a firm and left the practitioner to it
    // See docs/restructure/LEGAL-GUARDRAILS.md (rules 4 and 7).
    const isFirmFirst = !lawyerId;

    // Attorney-first is switched off for launch: requests go to the practice,
    // which assigns the attorney. Refused here as well as hidden in the UI, or
    // a direct POST would still book an attorney. See src/lib/directoryLinks.ts.
    if (!isFirmFirst && !ATTORNEY_BOOKING_ENABLED) {
      return NextResponse.json(
        { error: 'Requests are sent to a practice, which assigns the attorney.' },
        { status: 400 }
      );
    }

    const targetDate = date ? parseDateOnlyToUtc(date) : null;

    const lawyer = lawyerId
      ? await prisma.lawyerProfile.findUnique({
          where: { id: lawyerId },
          include: { user: { select: { email: true } } },
        })
      : null;

    // A consultation request no longer depends on the lawyer having configured a
    // price. Previously this 404'd when consultationPricing was missing, which
    // blocked requests entirely in a flow that is not supposed to have prices.
    if (lawyerId && (!lawyer || !lawyer.user)) {
      return NextResponse.json({ error: 'Lawyer not found' }, { status: 404 });
    }

    // Cannot book yourself
    if (lawyer && lawyer.userId === session.userId) {
      return NextResponse.json({ error: 'Cannot book a consultation with yourself' }, { status: 400 });
    }

    // Resolve the firm that will actually be engaged.
    //
    // Attorney-first: the firm the chosen attorney practises in. Firm-first: the
    // firm the client named. Either way the FIRM is the provider of legal
    // services, not the individual and certainly not us.
    let firmId: string | null;
    let firm: {
      id: string; name: string; contactEmail: string | null; verificationStatus: string;
      isActive: boolean; isRegisteredPractice: boolean;
    } | null = null;

    if (isFirmFirst) {
      firm = await prisma.lawFirm.findUnique({
        where: { id: requestedFirmId! },
        select: { id: true, name: true, contactEmail: true, verificationStatus: true, isActive: true, isRegisteredPractice: true },
      });

      if (!firm || !firm.isActive) {
        return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
      }

      // Only a registered, verified practice can receive an engagement request.
      // An unverified firm is one we have not confirmed exists.
      if (!isListedFirm(firm)) {
        return NextResponse.json(
          { error: 'This firm is not currently accepting requests through the platform.' },
          { status: 400 }
        );
      }

      // A member of the firm cannot instruct their own firm.
      const ownMembership = await prisma.firmMember.findUnique({
        where: { firmId_userId: { firmId: firm.id, userId: session.userId } },
        select: { id: true },
      });
      if (ownMembership) {
        return NextResponse.json(
          { error: 'You cannot send an engagement request to your own firm.' },
          { status: 400 }
        );
      }

      firmId = firm.id;
    } else {
      // No practice is created here. An attorney with none — or with a firm of
      // one that was never registered — cannot be engaged until they register
      // their practice. See src/lib/directory.ts.
      firmId = await findAttorneyFirmId(prisma, lawyerId!);

      // The same test as the firm-first path above. Without it, a request sent
      // from an attorney's page reached a firm an administrator had
      // deactivated or un-verified, because only the firm-first path checked.
      if (firmId) {
        const attorneyFirm = await prisma.lawFirm.findUnique({
          where: { id: firmId },
          select: { isActive: true, isRegisteredPractice: true, verificationStatus: true },
        });
        if (!isListedFirm(attorneyFirm)) {
          return NextResponse.json(
            { error: "This attorney's firm is not currently accepting requests through the platform." },
            { status: 400 }
          );
        }
      }
    }

    if (!firmId) {
      return NextResponse.json(
        { error: 'That attorney is not currently attached to a firm, so cannot be engaged.' },
        { status: 400 }
      );
    }

    // No fee is set at request time and the platform never derives one.
    // The lawyer quotes their fee when they accept the request, and the client
    // pays that exact amount directly to the lawyer.
    // See docs/restructure/LEGAL-GUARDRAILS.md (rules 1 and 2).
    const duration = startTime && endTime ? calculateDuration(startTime, endTime) : null;

    // Race-condition-safe booking creation using serializable transaction
    const booking = await prisma.$transaction(async (tx) => {
      // Slot checks only apply to the attorney-first path. A firm-first request
      // has no appointment yet — there is no calendar to clash with until the
      // firm has assigned someone and proposed a time.
      if (!isFirmFirst) {
        // Inside this branch the schema has already guaranteed a full slot —
        // CreateBookingSchema refuses an attorney without a date and time.
        const slotDate = targetDate!;
        const slotStart = startTime!;
        const slotEnd = endTime!;

        // Check for conflicting bookings (atomic check)
        const conflicts = await tx.booking.findMany({
          where: {
            lawyerId,
            date: slotDate,
            status: { in: SLOT_BLOCKING_STATUSES },
            OR: [
              { startTime: { lt: slotEnd }, endTime: { gt: slotStart } },
            ],
          },
        });

        // SLOT_BLOCKING_STATUSES already excludes released slots, so any hit is a
        // genuine conflict. The old 24h grace period for unpaid bookings is gone —
        // an unanswered quote now expires explicitly into QUOTE_EXPIRED.
        if (conflicts.length > 0) {
          throw new Error('SLOT_TAKEN');
        }

        // Check for conflicting holds by OTHER clients
        const conflictingHold = await tx.slotHold.findFirst({
          where: {
            lawyerId,
            date: slotDate,
            expiresAt: { gt: new Date() },
            clientId: { not: session.userId },
            OR: [
              { startTime: { lt: slotEnd }, endTime: { gt: slotStart } },
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
            date: slotDate,
            clientId: session.userId,
            startTime: slotStart,
            endTime: slotEnd,
          },
        });
      }

      const bookingNumber = await nextBookingNumber(tx);

      // Create the engagement request.
      //
      // `clientSelectedAttorneyId` is set only where the CLIENT named the
      // practitioner. It is never written later, so it stays true even after the
      // firm reassigns the matter — which is the evidence that the choice of
      // practitioner was theirs and never ours (rule 4).
      //
      // The id is generated here rather than left to the database default
      // because the privileged fields are encrypted bound to it — see
      // src/lib/privacy/encryption.ts. Without an id before the insert there is
      // nothing to bind the ciphertext to, and ciphertext that is not bound to
      // its row can be moved to a row somebody is allowed to read.
      const bookingId = randomUUID();

      return tx.booking.create({
        data: {
          id: bookingId,
          bookingNumber,
          clientId: session.userId,
          lawyerId: lawyerId ?? null,
          clientSelectedAttorneyId: lawyerId ?? null,
          firmId,
          date: targetDate,
          startTime: startTime ?? null,
          endTime: endTime ?? null,
          duration,
          mode: mode as any,
          officeAddress:
            mode === 'PHYSICAL' && lawyer
              ? lawyer.address || lawyer.district || 'Contact lawyer for address'
              : null,
          lawyerFee: 0,
          totalAmount: 0,
          // The client's own account of their legal problem, encrypted at rest
          // and bound to this row. `practiceArea` stays in the clear: it is a
          // category the client picked from a list, it is what the firm filters
          // its queue on, and it says nothing about the matter that the choice
          // of firm does not already say.
          subject: encryptField(
            { model: 'Booking', recordId: bookingId, field: 'subject' },
            subject
          ),
          description: encryptField(
            { model: 'Booking', recordId: bookingId, field: 'description' },
            description
          ),
          practiceArea,
          status: 'REQUESTED',
        },
      });
    }, {
      isolationLevel: 'Serializable',
    });

    // Send emails asynchronously
    const client = await prisma.user.findUnique({ where: { id: session.userId } });
    if (client && client.email) {
      const clientName = client.fullName || 'Client';
      // A firm-first request has no appointment yet, so there is no date to
      // confirm — only that the request reached the firm.
      const formattedDate = booking.date ? formatSriLankaDateIso(booking.date) : 'To be arranged';
      const slotTime = booking.startTime ?? ' - ';
      const recipientName = lawyer?.fullName ?? firm?.name ?? 'the firm';

      EmailService.sendBookingCreatedClient(client.email, clientName, recipientName, formattedDate, slotTime, booking.bookingNumber);

      if (lawyer?.user?.email) {
        EmailService.sendBookingCreatedLawyer(lawyer.user.email, lawyer.fullName, clientName, formattedDate, slotTime);
      } else if (firm?.contactEmail) {
        EmailService.sendBookingCreatedLawyer(firm.contactEmail, firm.name, clientName, formattedDate, slotTime);
      }

      EmailService.sendBookingCreatedAdmin(clientName, recipientName, formattedDate, slotTime, booking.bookingNumber);
    }

    // The row that just came back holds ciphertext in `subject` and
    // `description`. Returning it raw would send the client base64 where they
    // expect the words they typed — so this goes back through the same
    // disclosure gate as every other read, with the client's own access.
    const created = discloseMatter(booking, {
      canRead: true,
      canReadMatterDetail: true,
      canAct: false,
      canAssign: false,
      basis: 'CLIENT',
    });

    return NextResponse.json({
      success: true,
      booking: {
        ...created,
        date: created.date ? formatSriLankaDateIso(created.date) : null,
        createdAt: created.createdAt.toISOString(),
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
