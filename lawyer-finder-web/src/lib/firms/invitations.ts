/**
 * Joining a firm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything about who may be in a practice, and what happens when they join,
 * lives here — the sibling of `access.ts` (who may READ) and `billing.ts` (what
 * the firm is LICENSED for). This one answers: who may be a member at all.
 *
 * Three rules it exists to hold, each of which is a legal position rather than a
 * product preference:
 *
 * 1. ONLY AN ADMITTED ATTORNEY MAY HOLD AN ATTORNEY ROLE. A matter must be the
 *    responsibility of an Attorney-at-Law, and `FIRM_OWNER` is a principal of
 *    the practice. `FIRM_ADMIN` (practice manager) and `PARALEGAL` need not be
 *    admitted, and often are not.
 *
 * 2. AN ATTORNEY PRACTISES IN ONE FIRM AT A TIME, AND CANNOT CARRY MATTERS
 *    ACROSS. Moving an attorney who still holds open matters would leave those
 *    matters in a firm they no longer belong to — and the client engaged THAT
 *    firm, so silently re-pointing the file would change the party to the
 *    retainer without telling anyone. The matters must be closed or reassigned
 *    first, which is the same rule the member-removal path already enforces.
 *
 * 3. A PRACTICE OF MORE THAN ONE IS NOT A FIRM OF ONE. The moment a second
 *    person joins, the firm stops inheriting its founder's individual
 *    verification and must be checked in its own right — so it leaves the public
 *    directory until an administrator has looked at it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { randomBytes } from 'crypto';
import type { FirmRole, Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/db';

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * How long an invitation stands.
 *
 * A pending invitation is a standing offer of access to privileged material, so
 * it expires on its own rather than relying on somebody remembering to revoke
 * it. Fourteen days is long enough for a partner on leave and short enough that
 * a forgotten invitation is not a permanent open door.
 */
export const INVITATION_VALID_DAYS = 14;

export function invitationExpiry(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + INVITATION_VALID_DAYS);
  return d;
}

/** A single-use invitation secret. 32 bytes, URL-safe. */
export function newInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Roles that may only be held by an admitted, verified Attorney-at-Law. */
export const ATTORNEY_ONLY_ROLES: FirmRole[] = ['FIRM_OWNER', 'ATTORNEY'];

export function roleRequiresAdmittedAttorney(role: FirmRole): boolean {
  return ATTORNEY_ONLY_ROLES.includes(role);
}

export type JoinEligibility = { ok: true } | { ok: false; reason: string; status: number };

/**
 * May this person take this role in this firm?
 *
 * Called at invitation time (so a principal is told immediately) AND at
 * acceptance (because the facts can change in between — an attorney may have
 * joined another practice, or lost verification, in the fourteen days the
 * invitation stood). Checking only at invitation time would let a stale
 * invitation carry someone past a rule that had since started to apply.
 */
export async function checkJoinEligibility(params: {
  firmId: string;
  role: FirmRole;
  /** Null when the invitee has not registered yet — that is allowed. */
  userId: string | null;
}): Promise<JoinEligibility> {
  const { firmId, role, userId } = params;

  if (!userId) {
    // Nothing more can be checked until they have an account. The same function
    // runs again at acceptance, when it can.
    return { ok: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      profile: { select: { id: true, firmId: true, isVerified: true, fullName: true } },
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    return { ok: false, reason: 'That account is not active.', status: 409 };
  }

  if (roleRequiresAdmittedAttorney(role)) {
    if (!user.profile) {
      return {
        ok: false,
        reason:
          'That person is not registered as an Attorney-at-Law on this platform. Only an ' +
          'admitted attorney can be a partner or hold matters. They can be invited as a ' +
          'practice manager or paralegal instead, or apply to be verified first.',
        status: 400,
      };
    }

    if (!user.profile.isVerified) {
      return {
        ok: false,
        reason:
          'That attorney has not completed BASL verification yet. They can join the ' +
          'practice once their own registration has been verified.',
        status: 400,
      };
    }

    if (user.profile.firmId && user.profile.firmId !== firmId) {
      // They are moving practice. Allowed — but not while they still hold live
      // matters at the firm the client actually engaged.
      const openMatters = await prisma.booking.count({
        where: {
          lawyerId: user.profile.id,
          firmId: user.profile.firmId,
          status: {
            notIn: [
              'COMPLETED',
              'DECLINED',
              'QUOTE_EXPIRED',
              'CLIENT_DECLINED',
              'CANCELLED_BY_CLIENT',
              'CANCELLED_BY_FIRM',
              'NO_SHOW',
            ],
          },
        },
      });

      if (openMatters > 0) {
        return {
          ok: false,
          reason:
            `That attorney is still responsible for ${openMatters} open ` +
            `${openMatters === 1 ? 'matter' : 'matters'} at their current practice. ` +
            'Those clients engaged that firm, so the matters have to be closed or ' +
            'reassigned there before the attorney can move - moving them silently would ' +
            'change who the client is retained by without telling them.',
          status: 409,
        };
      }
    }
  }

  const existing = await prisma.firmMember.findUnique({
    where: { firmId_userId: { firmId, userId } },
    select: { status: true },
  });

  if (existing?.status === 'ACTIVE') {
    return { ok: false, reason: 'That person is already a member of this firm.', status: 409 };
  }

  return { ok: true };
}

/**
 * A firm that has gained a second member is no longer a firm of one.
 *
 * It stops inheriting its founder's individual BASL verification and goes back
 * into the queue to be checked as a practice — which means it leaves the public
 * directory, because `GET /api/firms` only lists VERIFIED firms. That is the
 * intended behaviour and not a regression: we have not checked that this
 * practice exists as it now claims to.
 *
 * Idempotent, so it is safe to call on every join.
 */
export async function reassessFirmStandingAfterJoin(tx: Tx, firmId: string): Promise<void> {
  const activeCount = await tx.firmMember.count({
    where: { firmId, status: 'ACTIVE' },
  });

  if (activeCount <= 1) return;

  const firm = await tx.lawFirm.findUnique({
    where: { id: firmId },
    select: { isSoloPractice: true, verificationStatus: true },
  });

  if (!firm?.isSoloPractice) return;

  await tx.lawFirm.update({
    where: { id: firmId },
    data: {
      isSoloPractice: false,
      firmType: 'PARTNERSHIP',
      verificationStatus: 'PENDING',
      verifiedAt: null,
      verificationNotes:
        'Re-verification required: the practice is no longer a sole practitioner.',
    },
  });
}

/**
 * Put a person into a firm, having already established that they may be there.
 *
 * The single place membership is actually created, so the side effects — the
 * attorney's profile following them to the practice, and the firm's standing
 * being reassessed — cannot be done in one path and forgotten in another.
 */
export async function admitMemberToFirm(
  tx: Tx,
  params: {
    firmId: string;
    userId: string;
    role: FirmRole;
    title?: string | null;
    invitedById?: string | null;
  }
): Promise<void> {
  const { firmId, userId, role, title, invitedById } = params;

  const existing = await tx.firmMember.findUnique({
    where: { firmId_userId: { firmId, userId } },
    select: { id: true },
  });

  if (existing) {
    await tx.firmMember.update({
      where: { id: existing.id },
      data: { role, title: title || null, status: 'ACTIVE', removedAt: null, joinedAt: new Date() },
    });
  } else {
    await tx.firmMember.create({
      data: {
        firmId,
        userId,
        role,
        title: title || null,
        status: 'ACTIVE',
        invitedById: invitedById ?? null,
        invitedAt: invitedById ? new Date() : null,
      },
    });
  }

  // An attorney practises in the firm they have joined.
  if (roleRequiresAdmittedAttorney(role)) {
    const profile = await tx.lawyerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (profile) {
      await tx.lawyerProfile.update({ where: { id: profile.id }, data: { firmId } });
    }
  }

  await reassessFirmStandingAfterJoin(tx, firmId);
}

/** Expire invitations that have run out, so a stale one cannot be accepted. */
export async function expireStaleInvitations(): Promise<number> {
  const { count } = await prisma.firmInvitation.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return count;
}
