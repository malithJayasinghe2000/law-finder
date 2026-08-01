import prisma from '@/lib/db';
import type { FirmRole } from '@prisma/client';

/**
 * Who inside a firm may see what.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the only file in the codebase that decides whether someone may read a
 * client's account of their legal problem. Do not re-implement any of it inline
 * in a route. If the rule changes, it changes here once.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Why it is written this conservatively:
 *
 * Before Phase 2 there was exactly one person who could read a matter — the
 * attorney the client chose. Introducing firms necessarily widens that, and
 * every person added is a person who could waive privilege under Evidence
 * Ordinance s.126. Whether non-attorney staff (paralegals, practice managers)
 * may read matter detail at all is an open question with counsel — question 8(b)
 * in docs/restructure/QUESTIONS-FOR-COUNSEL.md — so until it is answered:
 *
 *   - the assigned attorney always may;
 *   - FIRM_OWNER and FIRM_ADMIN may, because someone must be able to reassign a
 *     matter when an attorney is ill, leaves, or has a conflict;
 *   - other ATTORNEY members of the same firm may NOT, unless assigned;
 *   - PARALEGAL never may;
 *   - platform staff, including ADMIN, never may — that has been true since
 *     Phase 0.5 and firms do not change it.
 *
 * Loosening any of these is a legal decision, not an engineering one.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
 */

/** Firm roles that may read a matter belonging to their firm but not assigned to them. */
const MATTER_READING_ROLES: FirmRole[] = ['FIRM_OWNER', 'FIRM_ADMIN'];

/** Firm roles that may reassign a matter to a different attorney in the firm. */
const ASSIGNING_ROLES: FirmRole[] = ['FIRM_OWNER', 'FIRM_ADMIN'];

/** Firm roles that may edit the firm's own profile, offices and bank details. */
const FIRM_ADMIN_ROLES: FirmRole[] = ['FIRM_OWNER', 'FIRM_ADMIN'];

/** Firm roles that may add, remove or re-role other members. */
const MEMBER_MANAGING_ROLES: FirmRole[] = ['FIRM_OWNER'];

export type FirmMembership = {
  firmId: string;
  firmName: string;
  role: FirmRole;
  /** The member's own LawyerProfile id, when they are an admitted attorney. */
  profileId: string | null;
  isSoloPractice: boolean;
};

/**
 * The firm this user acts for, or null if they belong to none.
 *
 * Returns the single ACTIVE membership. A user with several active memberships
 * is unusual (an attorney consulting to a second practice) and is not supported
 * by the UI yet — the first by join date wins, deterministically.
 */
export async function getFirmMembership(
  userId: string
): Promise<FirmMembership | null> {
  const member = await prisma.firmMember.findFirst({
    where: { userId, status: 'ACTIVE', firm: { isActive: true } },
    orderBy: { joinedAt: 'asc' },
    select: {
      role: true,
      firm: { select: { id: true, name: true, isSoloPractice: true } },
      user: { select: { profile: { select: { id: true } } } },
    },
  });

  if (!member) return null;

  return {
    firmId: member.firm.id,
    firmName: member.firm.name,
    role: member.role,
    profileId: member.user.profile?.id ?? null,
    isSoloPractice: member.firm.isSoloPractice,
  };
}

/** The shape of a matter this module needs in order to decide anything. */
export type MatterOwnership = {
  /** LawyerProfile id of the attorney currently responsible */
  lawyerId: string;
  /** The firm that received the request */
  firmId: string | null;
  /** User id of the client */
  clientId: string;
};

export type MatterAccess = {
  /** May read the matter at all (list entry, status, schedule). */
  canRead: boolean;
  /**
   * May read the client's own description of their legal problem, the conflict
   * check, and the attorney's notes. Strictly narrower than `canRead`.
   */
  canReadMatterDetail: boolean;
  /** May act on the engagement: conflict check, quote, confirm payment, complete. */
  canAct: boolean;
  /** May reassign the matter to another attorney in the same firm. */
  canAssign: boolean;
  /** Why access was granted — used for audit trails and error messages. */
  basis:
    | 'CLIENT'
    | 'ASSIGNED_ATTORNEY'
    | 'FIRM_PRINCIPAL'
    | 'FIRM_MEMBER_LIMITED'
    | 'PLATFORM_STAFF'
    | 'NONE';
};

const NO_ACCESS: MatterAccess = {
  canRead: false,
  canReadMatterDetail: false,
  canAct: false,
  canAssign: false,
  basis: 'NONE',
};

/**
 * Decide what this actor may do with this matter.
 *
 * `membership` may be null for clients and platform staff — pass the result of
 * `getFirmMembership` when the actor is a LAWYER.
 */
export function resolveMatterAccess(params: {
  actorUserId: string;
  actorRole: 'ADMIN' | 'LAWYER' | 'CLIENT';
  actorProfileId?: string | null;
  membership: FirmMembership | null;
  matter: MatterOwnership;
}): MatterAccess {
  const { actorUserId, actorRole, actorProfileId, membership, matter } = params;

  // The client owns their own matter. They see everything they told us and
  // everything the firm has sent them — but never the firm's internal conflict
  // screening, which is handled separately because it concerns other clients.
  if (matter.clientId === actorUserId) {
    return {
      canRead: true,
      canReadMatterDetail: true,
      canAct: false,
      canAssign: false,
      basis: 'CLIENT',
    };
  }

  // Platform staff. ADMIN can see that a matter exists — they have to be able to
  // support the product and count things — but never what it is about. This is
  // Evidence Ordinance s.126: a third party who can read privileged material can
  // be used to argue privilege was waived.
  if (actorRole === 'ADMIN') {
    return {
      canRead: true,
      canReadMatterDetail: false,
      canAct: false,
      canAssign: false,
      basis: 'PLATFORM_STAFF',
    };
  }

  if (actorRole !== 'LAWYER') return NO_ACCESS;

  // The attorney the client chose, or the attorney the firm has since assigned.
  if (actorProfileId && actorProfileId === matter.lawyerId) {
    return {
      canRead: true,
      canReadMatterDetail: true,
      canAct: true,
      canAssign: false,
      basis: 'ASSIGNED_ATTORNEY',
    };
  }

  // Everyone else must be in the same firm. A matter never crosses firms.
  if (!membership || !matter.firmId || membership.firmId !== matter.firmId) {
    return NO_ACCESS;
  }

  // The principal or practice manager. They can see the matter and move it to
  // another attorney, but they do not act on the engagement itself — quoting and
  // conflict-checking belong to the attorney who will do the work.
  if (MATTER_READING_ROLES.includes(membership.role)) {
    return {
      canRead: true,
      canReadMatterDetail: true,
      canAct: false,
      canAssign: ASSIGNING_ROLES.includes(membership.role),
      basis: 'FIRM_PRINCIPAL',
    };
  }

  // An unassigned attorney or a paralegal at the same firm. They can see that
  // the matter exists — enough to run a diary and answer the phone — and nothing
  // about what it concerns.
  return {
    canRead: true,
    canReadMatterDetail: false,
    canAct: false,
    canAssign: false,
    basis: 'FIRM_MEMBER_LIMITED',
  };
}

/**
 * Convenience wrapper: load the membership and resolve access in one call.
 */
export async function getMatterAccess(params: {
  actorUserId: string;
  actorRole: 'ADMIN' | 'LAWYER' | 'CLIENT';
  actorProfileId?: string | null;
  matter: MatterOwnership;
}): Promise<MatterAccess> {
  const membership =
    params.actorRole === 'LAWYER'
      ? await getFirmMembership(params.actorUserId)
      : null;

  return resolveMatterAccess({ ...params, membership });
}

/**
 * Redact a matter for an actor who may read it but not its detail.
 *
 * Always run list and detail payloads through this rather than redacting by
 * hand at each call site — Phase 0 shipped a redaction on one booking read path
 * and missed the other.
 */
export function redactMatter<
  T extends {
    subject?: string | null;
    description?: string | null;
    lawyerNotes?: string | null;
  },
>(matter: T, access: MatterAccess): T {
  if (access.canReadMatterDetail) return matter;

  return {
    ...matter,
    subject: '[Withheld — privileged]',
    description: '[Withheld — privileged]',
    lawyerNotes: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Firm administration
// ─────────────────────────────────────────────────────────────────────────────

export function canManageFirm(membership: FirmMembership | null): boolean {
  return !!membership && FIRM_ADMIN_ROLES.includes(membership.role);
}

export function canManageMembers(membership: FirmMembership | null): boolean {
  return !!membership && MEMBER_MANAGING_ROLES.includes(membership.role);
}

/**
 * Confirm that an attorney may be given a matter belonging to a firm.
 *
 * This is the invariant that keeps `Booking.lawyerId` and `Booking.firmId`
 * consistent: the responsible attorney must be an ACTIVE attorney member of the
 * owning firm. Nothing may move a matter to an attorney at another practice —
 * that would be a referral, and a referral is exactly what we must never make.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 3 and 4).
 */
export async function assertAttorneyBelongsToFirm(
  profileId: string,
  firmId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const profile = await prisma.lawyerProfile.findUnique({
    where: { id: profileId },
    select: { id: true, firmId: true, isVerified: true, userId: true },
  });

  if (!profile) return { ok: false, reason: 'That attorney does not exist.' };

  if (profile.firmId !== firmId) {
    return {
      ok: false,
      reason: 'A matter can only be assigned to an attorney in the same firm.',
    };
  }

  const member = await prisma.firmMember.findUnique({
    where: { firmId_userId: { firmId, userId: profile.userId } },
    select: { role: true, status: true },
  });

  if (!member || member.status !== 'ACTIVE') {
    return {
      ok: false,
      reason: 'That attorney is not an active member of this firm.',
    };
  }

  if (member.role === 'PARALEGAL' || member.role === 'FIRM_ADMIN') {
    return {
      ok: false,
      reason:
        'A matter must be the responsibility of an admitted attorney, not support staff.',
    };
  }

  return { ok: true };
}
