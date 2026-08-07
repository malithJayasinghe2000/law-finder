import prisma from '@/lib/db';

/**
 * Whose licence is it, and how many seats does it cover?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the only file that answers "what is this firm subscribed to". Do not
 * query `prisma.subscription` by hand in a route.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **The licence belongs to the firm.** Before Phase 3 each attorney bought
 * their own, which quietly told the wrong story about what we sell: a lawyer
 * paying a platform monthly looks like a lawyer paying for access to clients.
 * What we actually sell is practice-management software, and a practice is what
 * runs on it. An attorney's access now follows from being a member of a firm
 * that holds a licence.
 *
 * **It is priced on seats and features, never on legal work.** A seat is a
 * person who can sign in. It is not a matter, an enquiry, a message or a
 * client. The moment our revenue moves with how much law is practised through
 * the platform we are sharing fees with a non-lawyer, whichever way the invoice
 * points — see docs/restructure/LEGAL-GUARDRAILS.md (rule 1). Phase 2.5 had to
 * delete `inquiries_per_month` and `chat_messages_per_month` from the tiers for
 * exactly this reason; do not reintroduce anything shaped like them.
 *
 * The test, when you are asked to meter something new: **does the number count
 * software, or clients?** Seats, storage and templates are software. Enquiries,
 * messages, matters and introductions are clients.
 */

/** Feature key for the seat allowance. Seats are people, not matters. */
export const SEATS_FEATURE = 'firm_seats';

/** `FeatureLimitConfig.limit` uses -1 for "no limit". */
export const UNLIMITED = -1;

/**
 * The firm's current licence.
 *
 * A `CANCELED` subscription still counts until its `endDate`: the firm paid for
 * the period and cancelling should stop the renewal, not confiscate the
 * remainder. This is also what makes the Phase 3 migration safe — where several
 * attorneys at one firm each held a licence, the extras were stood down to
 * `CANCELED` with their end dates untouched, so nobody lost access they had
 * already paid for.
 */
export async function getFirmSubscription(firmId: string | null | undefined) {
  if (!firmId) return null;

  return prisma.subscription.findFirst({
    where: {
      firmId,
      OR: [{ status: 'ACTIVE' }, { status: 'CANCELED', endDate: { gte: new Date() } }],
    },
    include: {
      plan: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
}

/**
 * The licence covering a given attorney, resolved through their firm.
 *
 * Takes a `LawyerProfile.id` because that is what most callers already hold.
 */
export async function getSubscriptionForProfile(profileId: string | null | undefined) {
  if (!profileId) return null;

  const profile = await prisma.lawyerProfile.findUnique({
    where: { id: profileId },
    select: { firmId: true },
  });

  return getFirmSubscription(profile?.firmId);
}

/**
 * The licence covering a given user, resolved through their firm membership.
 *
 * Use this for non-attorney staff — a practice manager or paralegal has no
 * `LawyerProfile`, but they occupy a seat and their access comes from the same
 * firm licence.
 */
export async function getSubscriptionForUser(userId: string) {
  const membership = await prisma.firmMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    select: { firmId: true },
  });

  return getFirmSubscription(membership?.firmId);
}

export type SeatAllowance = {
  limit: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  hasLicence: boolean;
};

/**
 * How many people may sign in for this firm, and how many already do.
 *
 * A seat is an `ACTIVE` `FirmMember` — every person the firm has given access
 * to, whatever their role. Counting only attorneys would let a firm add
 * unlimited paralegals and practice managers for free, and they use the
 * software just as much.
 *
 * A firm with no licence gets zero seats rather than an error, so callers can
 * render "you need a plan" instead of failing.
 */
export async function getSeatAllowance(firmId: string): Promise<SeatAllowance> {
  const [subscription, used] = await Promise.all([
    getFirmSubscription(firmId),
    prisma.firmMember.count({ where: { firmId, status: 'ACTIVE' } }),
  ]);

  if (!subscription) {
    return { limit: 0, used, remaining: 0, unlimited: false, hasLicence: false };
  }

  const config = await prisma.featureLimitConfig.findUnique({
    where: {
      roleId_featureName: { roleId: subscription.roleId, featureName: SEATS_FEATURE },
    },
    select: { limit: true },
  });

  const limit = config?.limit ?? 0;
  const unlimited = limit === UNLIMITED;

  return {
    limit,
    used,
    remaining: unlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, limit - used),
    unlimited,
    hasLicence: true,
  };
}

export type SeatCheck = { allowed: true } | { allowed: false; reason: string };

/**
 * May this firm add one more person?
 *
 * Called before creating a `FirmMember`. Refusing here is a licensing decision
 * and nothing more — it limits how many people may use the software, never how
 * many clients the firm may take on or how many matters it may run. A firm on
 * one seat can run a thousand matters; it just does so with one login.
 */
export async function canAddFirmMember(firmId: string): Promise<SeatCheck> {
  const seats = await getSeatAllowance(firmId);

  if (!seats.hasLicence) {
    return {
      allowed: false,
      reason:
        'This firm has no active software licence, so no further people can be given access. Choose a plan to add colleagues.',
    };
  }

  if (seats.unlimited) return { allowed: true };

  if (seats.used >= seats.limit) {
    return {
      allowed: false,
      reason:
        `This plan covers ${seats.limit} ${seats.limit === 1 ? 'person' : 'people'} and all ` +
        `${seats.used} are in use. Upgrade the plan or remove a member to free a seat.`,
    };
  }

  return { allowed: true };
}
