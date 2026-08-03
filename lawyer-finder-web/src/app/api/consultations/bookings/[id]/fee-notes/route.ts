import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getMatterAccess } from '@/lib/firms/access';
import {
  renderFeeNote,
  allocateFeeNoteNumber,
  calculateFeeNoteTotals,
  type FeeNoteLine,
} from '@/lib/consultations/feeNote';
import { FeeNoteCreateSchema, FeeNoteActionSchema } from '@/schemas/feeNote.schema';

/**
 * Fee notes for a matter — the firm billing its own client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Nothing in this file moves money. It creates, renders and records the status
 * of a document. The client pays the firm's own bank account directly.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Who may do what:
 *
 *   - the assigned attorney or a firm principal may raise, issue and cancel a
 *     note, and record that the client settled it
 *   - the client may read notes that have been issued to them, and nothing else
 *   - platform staff may read none of it
 *
 * That last one is not squeamishness. A fee note carries the client's name, the
 * matter reference and a narration of the work done, which is privileged
 * material under Evidence Ordinance s.126 — and there is no version of "support
 * needs to see the invoice" that outweighs damaging a client's position in
 * their own case. It is also, plainly, none of our business what a firm charges
 * its clients: our revenue is a flat licence fee that does not move with it.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 1, 2, 5 and 7).
 */

type Access = {
  isClient: boolean;
  isFirmSide: boolean;
};

async function resolveAccess(
  bookingId: string,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
): Promise<{ booking: NonNullable<Awaited<ReturnType<typeof loadBooking>>>; access: Access } | null> {
  const booking = await loadBooking(bookingId);
  if (!booking) return null;

  const matterAccess = await getMatterAccess({
    actorUserId: session.userId,
    actorRole: session.role,
    actorProfileId: session.profileId,
    matter: {
      lawyerId: booking.lawyerId,
      firmId: booking.firmId,
      clientId: booking.clientId,
    },
  });

  return {
    booking,
    access: {
      isClient: matterAccess.basis === 'CLIENT',
      isFirmSide:
        matterAccess.basis === 'ASSIGNED_ATTORNEY' || matterAccess.basis === 'FIRM_PRINCIPAL',
    },
  };
}

function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingNumber: true,
      subject: true,
      clientId: true,
      lawyerId: true,
      firmId: true,
      client: { select: { fullName: true, email: true } },
      lawyer: { select: { userId: true, fullName: true } },
      firm: {
        select: {
          id: true,
          name: true,
          taxIdentificationNumber: true,
          vatNumber: true,
          isVatRegistered: true,
          vatRatePercent: true,
          bankName: true,
          accountName: true,
          accountNumber: true,
          bankBranch: true,
          offices: {
            where: { isActive: true },
            orderBy: { isPrimary: 'desc' },
            take: 1,
            select: { address: true },
          },
        },
      },
    },
  });
}

/** GET: list the fee notes on this matter. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const resolved = await resolveAccess(id, session);
    if (!resolved) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { access } = resolved;
    if (!access.isClient && !access.isFirmSide) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const feeNotes = await prisma.feeNote.findMany({
      where: {
        bookingId: id,
        // A client sees issued notes, not the firm's drafts. A draft is the
        // firm's internal working, and showing a client a figure that has not
        // been settled on internally invites a dispute about a number nobody
        // meant to send.
        ...(access.isClient ? { status: { in: ['ISSUED', 'SETTLED', 'CANCELLED'] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ feeNotes: feeNotes.map(serialise) });
  } catch (error) {
    console.error('[FEE_NOTE_LIST_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: raise a draft fee note. Firm side only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const resolved = await resolveAccess(id, session);
    if (!resolved) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { booking, access } = resolved;
    if (!access.isFirmSide) {
      return NextResponse.json(
        { error: 'Only the attorney acting or a firm principal can raise a fee note.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const validated = FeeNoteCreateSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { lines, dueDate, quoteId } = validated.data;

    // VAT applies only where the FIRM is registered for it. We do not decide a
    // firm's tax status, and we never add a rate it has not told us about.
    const vatRate = booking.firm.isVatRegistered ? booking.firm.vatRatePercent ?? 0 : 0;
    const totals = calculateFeeNoteTotals(lines as FeeNoteLine[], vatRate);

    const feeNote = await prisma.$transaction(async (tx) => {
      const noteNumber = await allocateFeeNoteNumber(tx, booking.firmId);

      return tx.feeNote.create({
        data: {
          noteNumber,
          firmId: booking.firmId,
          bookingId: booking.id,
          quoteId: quoteId ?? null,

          // Snapshotted now, frozen at issue. A fee note is a tax document.
          firmName: booking.firm.name,
          firmAddress: booking.firm.offices[0]?.address ?? null,
          firmTin: booking.firm.taxIdentificationNumber,
          firmVatNumber: booking.firm.vatNumber,
          firmBankName: booking.firm.bankName,
          firmAccountName: booking.firm.accountName,
          firmAccountNumber: booking.firm.accountNumber,
          firmBankBranch: booking.firm.bankBranch,

          clientName: booking.client.fullName ?? 'Client',
          clientEmail: booking.client.email,
          attorneyName: booking.lawyer?.fullName ?? null,

          lineItems: lines,
          subtotal: totals.subtotal,
          vatRatePercent: vatRate > 0 ? vatRate : null,
          vatAmount: totals.vatAmount,
          total: totals.total,

          status: 'DRAFT',
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });
    });

    return NextResponse.json({ feeNote: serialise(feeNote) }, { status: 201 });
  } catch (error) {
    console.error('[FEE_NOTE_CREATE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH: issue, settle, or cancel a fee note.
 *
 * `settle` records that the FIRM says its client paid it. There is no admin
 * approval step and no confirmation from us, by design — we did not see the
 * money and cannot honestly attest to it. The same reasoning governs booking
 * payments since Phase 1.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const resolved = await resolveAccess(id, session);
    if (!resolved) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const { booking, access } = resolved;
    if (!access.isFirmSide) {
      return NextResponse.json(
        { error: 'Only the attorney acting or a firm principal can change a fee note.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const validated = FeeNoteActionSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { feeNoteId, action, note } = validated.data;

    const feeNote = await prisma.feeNote.findFirst({
      where: { id: feeNoteId, bookingId: booking.id },
    });
    if (!feeNote) {
      return NextResponse.json({ error: 'Fee note not found' }, { status: 404 });
    }

    if (action === 'issue') {
      if (feeNote.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'Only a draft fee note can be issued.' },
          { status: 409 }
        );
      }

      const issuedAt = new Date();
      const content = renderFeeNote({
        noteNumber: feeNote.noteNumber,
        issuedAt,
        dueDate: feeNote.dueDate,
        firmName: feeNote.firmName,
        firmAddress: feeNote.firmAddress,
        firmTin: feeNote.firmTin,
        firmVatNumber: feeNote.firmVatNumber,
        firmBankName: feeNote.firmBankName,
        firmAccountName: feeNote.firmAccountName,
        firmAccountNumber: feeNote.firmAccountNumber,
        firmBankBranch: feeNote.firmBankBranch,
        clientName: feeNote.clientName,
        clientAddress: feeNote.clientAddress,
        clientEmail: feeNote.clientEmail,
        attorneyName: feeNote.attorneyName,
        matterReference: booking.bookingNumber,
        lines: feeNote.lineItems as unknown as FeeNoteLine[],
        subtotal: feeNote.subtotal,
        vatRatePercent: feeNote.vatRatePercent,
        vatAmount: feeNote.vatAmount,
        total: feeNote.total,
        currency: feeNote.currency,
      });

      const updated = await prisma.feeNote.update({
        where: { id: feeNote.id },
        // Content is snapshotted here and never regenerated. If the firm's
        // details change tomorrow, this note still says what it said today.
        data: { status: 'ISSUED', issuedAt, content },
      });

      return NextResponse.json({ feeNote: serialise(updated) });
    }

    if (action === 'settle') {
      if (feeNote.status !== 'ISSUED') {
        return NextResponse.json(
          { error: 'Only an issued fee note can be marked settled.' },
          { status: 409 }
        );
      }

      const updated = await prisma.feeNote.update({
        where: { id: feeNote.id },
        data: { status: 'SETTLED', settledAt: new Date(), settlementNote: note ?? null },
      });

      return NextResponse.json({ feeNote: serialise(updated) });
    }

    // Cancel. The note keeps its number: a gap in the series is a question the
    // firm would have to answer to a tax officer.
    if (feeNote.status === 'SETTLED') {
      return NextResponse.json(
        { error: 'A settled fee note cannot be cancelled. Raise a credit note instead.' },
        { status: 409 }
      );
    }

    const updated = await prisma.feeNote.update({
      where: { id: feeNote.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationNote: note ?? null },
    });

    return NextResponse.json({ feeNote: serialise(updated) });
  } catch (error) {
    console.error('[FEE_NOTE_UPDATE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function serialise(feeNote: {
  createdAt: Date;
  updatedAt: Date;
  issuedAt: Date | null;
  dueDate: Date | null;
  settledAt: Date | null;
  cancelledAt: Date | null;
  [key: string]: unknown;
}) {
  return {
    ...feeNote,
    createdAt: feeNote.createdAt.toISOString(),
    updatedAt: feeNote.updatedAt.toISOString(),
    issuedAt: feeNote.issuedAt?.toISOString() ?? null,
    dueDate: feeNote.dueDate?.toISOString() ?? null,
    settledAt: feeNote.settledAt?.toISOString() ?? null,
    cancelledAt: feeNote.cancelledAt?.toISOString() ?? null,
  };
}
