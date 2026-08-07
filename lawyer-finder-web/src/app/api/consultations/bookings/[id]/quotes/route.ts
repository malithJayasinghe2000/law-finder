import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { IssueQuoteSchema, RespondToQuoteSchema } from '@/schemas/consultation.schema';
import { canTransition, SLOT_BLOCKING_STATUSES } from '@/lib/consultations/bookingStatus';
import { renderEngagementLetter, buildLetterReference } from '@/lib/consultations/engagementLetter';
import { EmailService } from '@/lib/email/EmailService';
import { formatSriLankaDateIso, formatSriLankaDateIsoOrNull, parseDateOnlyToUtc } from '@/lib/utils';

/** Minutes between two "HH:mm" times on the same day. */
function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/**
 * Fee quotes.
 *
 * The firm sets its own fee and supplies its own bank details; the client pays
 * the firm directly. The platform derives nothing from the amount and receives
 * none of it. See docs/restructure/LEGAL-GUARDRAILS.md (rules 1, 2 and 7).
 *
 * Quotes are versioned so a firm can re-quote — for example after the client
 * asks for a narrower scope — without destroying what was previously offered.
 */

/** GET: list quotes on this request (client, firm, but not platform staff). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { clientId: true, lawyer: { select: { userId: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const isClient = booking.clientId === session.userId;
    const isLawyer = !!booking.lawyer && booking.lawyer.userId === session.userId;

    // A quote is a commercial term between the client and the firm. Platform
    // staff have no need to see it.
    if (!isClient && !isLawyer) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const quotes = await prisma.quote.findMany({
      where: { bookingId: id },
      orderBy: { version: 'desc' },
    });

    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: the firm issues a quote. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = IssueQuoteSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: { select: { email: true, fullName: true } },
        lawyer: { select: { userId: true, fullName: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (!booking.lawyer) {
      return NextResponse.json(
        {
          error:
            'This matter has not been assigned to an attorney yet. A principal must assign it before a quote can be issued.',
        },
        { status: 400 }
      );
    }

    if (booking.lawyer.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Only the attorney handling this request can issue a quote.' },
        { status: 403 }
      );
    }

    if (!canTransition(booking.status, 'QUOTED')) {
      return NextResponse.json(
        {
          error:
            booking.status === 'REQUESTED'
              ? 'Run the conflict check before quoting a fee.'
              : `Cannot quote on a request in "${booking.status}".`,
        },
        { status: 400 }
      );
    }

    const data = validated.data;

    // A matter that arrived without an appointment (the client engaged the firm,
    // not an individual) needs one proposed now — the quote is where the firm
    // offers both a fee and a time.
    const needsAppointment = !booking.date || !booking.startTime || !booking.endTime;

    if (needsAppointment && !data.proposedDate) {
      return NextResponse.json(
        {
          error:
            'This matter has no appointment yet. Propose a date and time along with your fee.',
        },
        { status: 400 }
      );
    }

    // The proposed slot must be free in this attorney's own diary. Availability
    // belongs to the attorney, never to the firm.
    if (data.proposedDate && data.proposedStartTime && data.proposedEndTime) {
      const proposedDate = parseDateOnlyToUtc(data.proposedDate);
      const clash = await prisma.booking.findFirst({
        where: {
          id: { not: id },
          lawyerId: booking.lawyerId!,
          date: proposedDate,
          status: { in: SLOT_BLOCKING_STATUSES },
          startTime: { lt: data.proposedEndTime },
          endTime: { gt: data.proposedStartTime },
        },
        select: { bookingNumber: true, startTime: true, endTime: true },
      });

      if (clash) {
        return NextResponse.json(
          {
            error: `You already have a matter at that time (${clash.startTime}–${clash.endTime}). Choose another slot.`,
          },
          { status: 409 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Supersede any quote still outstanding
      await tx.quote.updateMany({
        where: { bookingId: id, status: 'SENT' },
        data: { status: 'WITHDRAWN' },
      });

      const latest = await tx.quote.findFirst({
        where: { bookingId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const quote = await tx.quote.create({
        data: {
          bookingId: id,
          version: (latest?.version ?? 0) + 1,
          status: 'SENT',
          feeBasis: data.feeBasis,
          amount: data.amount,
          hourlyRate: data.hourlyRate,
          estimatedHours: data.estimatedHours,
          scopeOfWork: data.scopeOfWork,
          exclusions: data.exclusions,
          paymentInstructions: data.paymentInstructions,
          validUntil: new Date(data.validUntil),
          proposedDate: data.proposedDate ? parseDateOnlyToUtc(data.proposedDate) : null,
          proposedStartTime: data.proposedStartTime ?? null,
          proposedEndTime: data.proposedEndTime ?? null,
          issuedById: session.userId,
        },
      });

      // The proposed appointment is written onto the matter now, not on
      // acceptance, so the slot is held against the attorney's diary while the
      // client considers the quote — QUOTED is a slot-blocking status.
      await tx.booking.update({
        where: { id },
        data: {
          status: 'QUOTED',
          ...(data.proposedDate && data.proposedStartTime && data.proposedEndTime
            ? {
                date: parseDateOnlyToUtc(data.proposedDate),
                startTime: data.proposedStartTime,
                endTime: data.proposedEndTime,
                duration: minutesBetween(data.proposedStartTime, data.proposedEndTime),
              }
            : {}),
        },
      });

      return quote;
    });

    await EmailService.sendBookingApprovedClient(
      booking.client.email,
      booking.client.fullName || 'Client',
      booking.bookingNumber,
      booking.lawyer.fullName,
      data.proposedDate ?? formatSriLankaDateIsoOrNull(booking.date) ?? 'To be arranged',
      `${data.proposedStartTime ?? booking.startTime ?? '—'} - ${data.proposedEndTime ?? booking.endTime ?? '—'}`
    );

    return NextResponse.json({ success: true, quote: result }, { status: 201 });
  } catch (error) {
    console.error('Quote issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH: the client accepts or declines the outstanding quote. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = RespondToQuoteSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: { select: { email: true, fullName: true } },
        // The FIRM is the party to the retainer; the attorney acts for it.
        // See docs/restructure/LEGAL-GUARDRAILS.md (rule 7).
        firm: {
          select: {
            name: true,
            registrationNumber: true,
            principalBaslNumber: true,
            contactPhone: true,
            contactEmail: true,
            offices: {
              where: { isActive: true },
              orderBy: [{ isPrimary: 'desc' }],
              take: 1,
              select: { address: true },
            },
          },
        },
        lawyer: {
          select: {
            fullName: true,
            baslNumber: true,
            address: true,
            contactPhone: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (booking.clientId !== session.userId) {
      return NextResponse.json({ error: 'Only the client can respond to a quote' }, { status: 403 });
    }

    const quote = await prisma.quote.findFirst({
      where: { bookingId: id, status: 'SENT' },
      orderBy: { version: 'desc' },
    });

    if (!quote) {
      return NextResponse.json({ error: 'There is no outstanding quote to respond to' }, { status: 400 });
    }

    // A lapsed quote cannot be accepted. Record the lapse rather than silently
    // letting the client accept stale terms.
    if (quote.validUntil.getTime() < Date.now()) {
      await prisma.$transaction([
        prisma.quote.update({ where: { id: quote.id }, data: { status: 'EXPIRED' } }),
        prisma.booking.update({ where: { id }, data: { status: 'QUOTE_EXPIRED' } }),
      ]);

      return NextResponse.json(
        { error: 'This quote has expired. Ask the firm to issue a new one.' },
        { status: 410 }
      );
    }

    const accepting = validated.data.action === 'accept';
    const nextStatus = accepting ? 'ACCEPTED' : 'CLIENT_DECLINED';

    if (!canTransition(booking.status, nextStatus)) {
      return NextResponse.json(
        { error: `Cannot respond to a quote on a request in "${booking.status}".` },
        { status: 400 }
      );
    }

    const { updatedBooking, engagementLetter } = await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: accepting ? 'ACCEPTED' : 'DECLINED',
          respondedAt: new Date(),
          declineReason: accepting ? null : validated.data.reason,
        },
      });

      const updated = await tx.booking.update({
        where: { id },
        data: accepting
          ? {
              status: 'ACCEPTED',
              termsAcceptedAt: new Date(),
              // Fee snapshot: the client pays this in full, directly to the firm.
              lawyerFee: quote.amount,
              totalAmount: quote.amount,
              paymentInstructions: quote.paymentInstructions,
            }
          : {
              status: 'CLIENT_DECLINED',
              cancelReason: validated.data.reason || 'Client declined the quoted fee',
              cancelledAt: new Date(),
              cancelledBy: session.userId,
            },
      });

      if (!accepting) return { updatedBooking: updated, engagementLetter: null };

      // Accepting the quote is the moment terms are agreed, so the engagement
      // letter is issued here. Content is snapshotted, not joined at read time —
      // the letter must always reflect the terms as they were accepted.
      const issuedAt = new Date();
      const year = issuedAt.getFullYear();
      const prefix = `EL-${year}-`;

      const latestLetter = await tx.engagementLetter.findFirst({
        where: { reference: { startsWith: prefix } },
        orderBy: { reference: 'desc' },
        select: { reference: true },
      });
      const nextSeq = latestLetter
        ? (parseInt(latestLetter.reference.slice(prefix.length), 10) || 0) + 1
        : 1;

      const reference = buildLetterReference(year, nextSeq);
      const clientName = booking.client.fullName || 'Client';

      // Which entity the letter names.
      //
      // The client engages the FIRM, so the firm is the party. Where the firm
      // is a solo practice the two names are identical and the letter reads
      // exactly as it did before Phase 2. Where they differ, the attorney is
      // named separately as the person acting.
      //
      // Letters already issued are untouched: their body was snapshotted at
      // issue time and is never re-rendered.
      // A quote cannot exist without an assigned attorney and an appointment —
      // POST refuses both — so by acceptance these are always present.
      const actingAttorney = booking.lawyer!;

      const firmName = booking.firm?.name || actingAttorney.fullName;
      const firmAddress =
        booking.firm?.offices?.[0]?.address || actingAttorney.address;
      const firmContact =
        booking.firm?.contactPhone || actingAttorney.contactPhone;
      const firmBaslNumber =
        booking.firm?.principalBaslNumber || actingAttorney.baslNumber;

      const body = renderEngagementLetter({
        reference,
        issuedAt,
        firmName,
        firmBaslNumber,
        firmAddress,
        firmContact,
        firmRegistrationNumber: booking.firm?.registrationNumber,
        attorneyName: actingAttorney.fullName,
        attorneyBaslNumber: actingAttorney.baslNumber,
        clientName,
        clientEmail: booking.client.email,
        matterSubject: booking.subject,
        scopeOfWork: quote.scopeOfWork,
        exclusions: quote.exclusions,
        feeBasis: quote.feeBasis,
        feeAmount: quote.amount,
        currency: quote.currency,
        hourlyRate: quote.hourlyRate,
        estimatedHours: quote.estimatedHours,
        paymentInstructions: quote.paymentInstructions,
        consultationDate: formatSriLankaDateIsoOrNull(booking.date) ?? 'To be confirmed',
        consultationTime:
          booking.startTime && booking.endTime
            ? `${booking.startTime} - ${booking.endTime}`
            : 'To be confirmed',
        mode: booking.mode,
      });

      const letter = await tx.engagementLetter.create({
        data: {
          bookingId: id,
          quoteId: quote.id,
          reference,
          firmName,
          firmBaslNumber,
          firmAddress,
          firmContact,
          clientName,
          clientEmail: booking.client.email,
          matterSubject: booking.subject,
          scopeOfWork: quote.scopeOfWork,
          exclusions: quote.exclusions,
          feeBasis: quote.feeBasis,
          feeAmount: quote.amount,
          currency: quote.currency,
          paymentTerms: quote.paymentInstructions,
          body,
          issuedAt,
        },
      });

      return { updatedBooking: updated, engagementLetter: letter };
    });

    if (booking.lawyer?.user?.email) {
      await EmailService.sendBookingCreatedLawyer(
        booking.lawyer.user.email,
        booking.lawyer.fullName,
        booking.client.fullName || 'Client',
        formatSriLankaDateIsoOrNull(booking.date) ?? 'To be confirmed',
        booking.startTime ?? '—'
      );
    }

    return NextResponse.json({
      success: true,
      booking: { ...updatedBooking, date: formatSriLankaDateIsoOrNull(updatedBooking.date) },
    });
  } catch (error) {
    console.error('Quote response error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
