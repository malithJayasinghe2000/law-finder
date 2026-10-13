/**
 * A practice opening a request for a client who came to it directly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Clients reach a practice by phone, walk-in and referral. The practice writes
 * the request; the CLIENT confirms it; only then is there a `Booking`. Rules:
 *
 * 1. NOTHING ENTERS A CLIENT'S ACCOUNT WITHOUT THEIR AGREEMENT. The invitation
 *    is addressed to an email, and accepting requires signing in with it — the
 *    link alone is not enough. A practice cannot use this to place itself in
 *    front of someone who never contacted it: they never accept.
 *
 * 2. THE PRACTICE CHOOSES THE ATTORNEY, NEVER US. `attorneyId` is optional and
 *    must be an active attorney of the same practice, checked when the
 *    invitation is sent AND when it is accepted. `clientSelectedAttorneyId` stays
 *    null: the client did not pick a practitioner, and that field is the evidence
 *    of who did (rule 4).
 *
 * 3. THE REQUEST STARTS AT REQUESTED. A practice-opened matter goes through the
 *    same conflict check and quote as any other — no shortcut to "scheduled".
 *
 * 4. A DEAD INVITATION HOLDS NO LEGAL PROBLEM. `subject` and `description` are
 *    encrypted while pending and wiped on accept (they now live on the Booking,
 *    re-encrypted to that row), decline, revoke and expiry.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { randomUUID } from 'crypto';
import prisma from '@/lib/db';
import { encryptField, decryptField } from '@/lib/privacy/encryption';
import { assertAttorneyBelongsToFirm } from '@/lib/firms/access';
import { invitationExpiry, newInvitationToken } from '@/lib/firms/invitations';
import { isListedFirm } from '@/lib/directory';
import { nextBookingNumber } from '@/lib/consultations/bookingNumber';
import type { CreateClientIntakeInput } from '@/schemas/clientIntake.schema';

/**
 * How many requests one practice may open in 24 hours.
 *
 * Each one sends an email to an address the practice typed. Without a cap the
 * feature is a way to email strangers in our name — which is soliciting them.
 * Generous for a real practice's walk-ins; refuses a mailing list.
 */
export const CLIENT_INTAKE_DAILY_LIMIT = 20;

const WIPED = { subject: null, description: null } as const;

type Result<T> = ({ ok: true } & T) | { ok: false; reason: string; status: number };

/** Can this practice take on new matters at all? The same test as a client's own request. */
async function firmCanReceive(firmId: string) {
  const firm = await prisma.lawFirm.findUnique({
    where: { id: firmId },
    select: { id: true, name: true, contactEmail: true, isActive: true, isRegisteredPractice: true, verificationStatus: true },
  });
  return firm && isListedFirm(firm) ? firm : null;
}

export async function createClientIntakeInvitation(params: {
  firmId: string;
  invitedById: string;
  input: CreateClientIntakeInput;
}): Promise<Result<{ id: string; token: string; firmName: string; email: string }>> {
  const { firmId, invitedById, input } = params;
  const email = input.email.toLowerCase();

  const firm = await firmCanReceive(firmId);
  if (!firm) {
    return {
      ok: false,
      status: 400,
      reason: 'Your practice must be registered and verified before it can open requests.',
    };
  }

  if (input.attorneyId) {
    const belongs = await assertAttorneyBelongsToFirm(input.attorneyId, firmId);
    if (!belongs.ok) return { ok: false, status: 400, reason: belongs.reason };
  }

  // A member cannot be a client of their own practice through this.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    const member = await prisma.firmMember.findUnique({
      where: { firmId_userId: { firmId, userId: existing.id } },
      select: { status: true },
    });
    if (member && member.status === 'ACTIVE') {
      return { ok: false, status: 400, reason: 'That address belongs to a member of your practice.' };
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.clientIntakeInvitation.count({
    where: { firmId, createdAt: { gte: since } },
  });
  if (recent >= CLIENT_INTAKE_DAILY_LIMIT) {
    return {
      ok: false,
      status: 429,
      reason: `Your practice has opened ${CLIENT_INTAKE_DAILY_LIMIT} requests in the last 24 hours. Try again tomorrow.`,
    };
  }

  const id = randomUUID();
  const token = newInvitationToken();
  await prisma.clientIntakeInvitation.create({
    data: {
      id,
      firmId,
      email,
      subject: encryptField({ model: 'ClientIntakeInvitation', recordId: id, field: 'subject' }, input.subject),
      description: encryptField({ model: 'ClientIntakeInvitation', recordId: id, field: 'description' }, input.description),
      practiceArea: input.practiceArea ?? null,
      mode: input.mode,
      attorneyId: input.attorneyId ?? null,
      token,
      invitedById,
      expiresAt: invitationExpiry(),
    },
  });

  return { ok: true, id, token, firmName: firm.name, email };
}

/** The invitation behind a link, with its status corrected for expiry. */
export async function findClientIntakeByToken(token: string) {
  const inv = await prisma.clientIntakeInvitation.findUnique({
    where: { token },
    include: { firm: { select: { name: true, district: true } } },
  });
  if (!inv) return null;
  if (inv.status === 'PENDING' && inv.expiresAt.getTime() < Date.now()) {
    await prisma.clientIntakeInvitation.update({
      where: { id: inv.id },
      data: { status: 'EXPIRED', ...WIPED },
    });
    return { ...inv, status: 'EXPIRED' as const, ...WIPED };
  }
  return inv;
}

/** The request's text, for the invited client only. Never call for anyone else. */
export function revealClientIntake(inv: { id: string; subject: string | null; description: string | null }) {
  const read = (field: 'subject' | 'description') => {
    const stored = inv[field];
    if (!stored) return null;
    try {
      return decryptField({ model: 'ClientIntakeInvitation', recordId: inv.id, field }, stored);
    } catch {
      return null;
    }
  };
  return { subject: read('subject'), description: read('description') };
}

/**
 * The client accepts: the Booking is created now, in the client's name.
 * Everything is re-checked — fourteen days is long enough for the practice to
 * lose verification or the attorney to leave.
 */
export async function acceptClientIntake(params: {
  invitationId: string;
  clientId: string;
}): Promise<Result<{ bookingId: string; bookingNumber: string; firmName: string; firmEmail: string | null }>> {
  const inv = await prisma.clientIntakeInvitation.findUnique({ where: { id: params.invitationId } });
  if (!inv || inv.status !== 'PENDING') {
    return { ok: false, status: 409, reason: 'That request has already been answered or withdrawn.' };
  }

  const firm = await firmCanReceive(inv.firmId);
  if (!firm) {
    return { ok: false, status: 400, reason: 'This practice is not currently accepting requests through the platform.' };
  }

  let lawyerId = inv.attorneyId;
  if (lawyerId) {
    const belongs = await assertAttorneyBelongsToFirm(lawyerId, inv.firmId);
    // The attorney left. The request still belongs to the practice, which
    // assigns someone else — better than refusing the client.
    if (!belongs.ok) lawyerId = null;
  }

  const { subject, description } = revealClientIntake(inv);
  if (!subject || !description) {
    return { ok: false, status: 500, reason: 'This request could not be read. Ask the practice to send it again.' };
  }

  const booking = await prisma.$transaction(
    async (tx) => {
      const bookingId = randomUUID();
      const bookingNumber = await nextBookingNumber(tx);
      const created = await tx.booking.create({
        data: {
          id: bookingId,
          bookingNumber,
          clientId: params.clientId,
          firmId: inv.firmId,
          lawyerId,
          // The client did not choose a practitioner; the practice did.
          clientSelectedAttorneyId: null,
          assignedById: lawyerId ? inv.invitedById : null,
          assignedAt: lawyerId ? new Date() : null,
          mode: inv.mode,
          lawyerFee: 0,
          totalAmount: 0,
          subject: encryptField({ model: 'Booking', recordId: bookingId, field: 'subject' }, subject),
          description: encryptField({ model: 'Booking', recordId: bookingId, field: 'description' }, description),
          practiceArea: inv.practiceArea,
          status: 'REQUESTED',
        },
        select: { id: true, bookingNumber: true },
      });

      // Conditional on still being PENDING, so a double click cannot make two matters.
      const { count } = await tx.clientIntakeInvitation.updateMany({
        where: { id: inv.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date(), bookingId: created.id, ...WIPED },
      });
      if (count !== 1) throw new Error('CLIENT_INTAKE_ALREADY_ANSWERED');
      return created;
    },
    { isolationLevel: 'Serializable' }
  ).catch((e: unknown) => {
    if (e instanceof Error && e.message === 'CLIENT_INTAKE_ALREADY_ANSWERED') return null;
    throw e;
  });

  if (!booking) {
    return { ok: false, status: 409, reason: 'That request has already been answered.' };
  }

  return {
    ok: true,
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    firmName: firm.name,
    firmEmail: firm.contactEmail,
  };
}

/** Declined by the client or withdrawn by the practice. Wipes the text either way. */
export async function closeClientIntake(invitationId: string, status: 'DECLINED' | 'REVOKED'): Promise<boolean> {
  const { count } = await prisma.clientIntakeInvitation.updateMany({
    where: { id: invitationId, status: 'PENDING' },
    data: { status, respondedAt: new Date(), ...WIPED },
  });
  return count === 1;
}

/** Expire the ones that ran out, and wipe their text. */
export async function expireStaleClientIntakes(): Promise<number> {
  const { count } = await prisma.clientIntakeInvitation.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED', ...WIPED },
  });
  return count;
}
