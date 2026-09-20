import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';
import { recordFirmResponse } from '@/lib/privacy/firmResponse';
import { FirmSubjectResponseSchema } from '@/schemas/privacy.schema';

/**
 * Data-subject requests referred to this firm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The firm is the controller of its matter files. When a client asks us for
 * access to, or erasure of, everything we hold, the part of that request
 * touching their matter is not ours to answer — so it is referred here, and
 * this is where the firm sees it.
 *
 * WHAT THE FIRM IS SHOWN, AND WHAT IT IS NOT.
 *
 * The firm sees: who asked, what they asked for, when, and the deadline. It
 * does NOT see the person's note verbatim, because a request written to a
 * platform may describe circumstances the client has not chosen to put in front
 * of their attorney — and it does not see anything about the same person's
 * requests referred to a DIFFERENT firm. `referredFirmIds` is filtered on, never
 * returned: telling firm A that firm B also holds a matter for this client
 * discloses the existence of the other retainer, which is not ours to disclose.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getFirmMembership(session.userId);

  if (!membership) {
    return NextResponse.json({ error: 'You do not belong to a firm.' }, { status: 404 });
  }

  // A subject request concerns the practice as a whole and may require a
  // decision about professional retention duties, so it sits with whoever runs
  // the practice rather than with any attorney holding the matter.
  if (!canManageFirm(membership)) {
    return NextResponse.json(
      {
        error:
          "Only the firm's principal or practice manager can see data-protection requests.",
      },
      { status: 403 }
    );
  }

  const requests = await prisma.dataSubjectRequest.findMany({
    where: { referredFirmIds: { has: membership.firmId } },
    orderBy: { dueBy: 'asc' },
    select: {
      id: true,
      type: true,
      status: true,
      dueBy: true,
      createdAt: true,
      completedAt: true,
      user: { select: { id: true, fullName: true, email: true } },
      // requestNote and referredFirmIds are deliberately not selected.

      // This firm's own answer, and only this firm's. Another practice's
      // response would disclose that it holds a matter for the same client,
      // which is the existence of a retainer that is not ours to reveal.
      firmResponses: {
        where: { firmId: membership.firmId },
        select: { outcome: true, reason: true, respondedAt: true },
      },
    },
  });

  const matterCounts = await prisma.booking.groupBy({
    by: ['clientId'],
    where: {
      firmId: membership.firmId,
      clientId: { in: requests.map((r) => r.user.id) },
    },
    _count: { _all: true },
  });

  const counts = new Map(matterCounts.map((m) => [m.clientId, m._count._all]));

  return NextResponse.json({
    firmName: membership.firmName,
    requests: requests.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      dueBy: r.dueBy.toISOString(),
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      client: r.user,
      mattersHeldByThisFirm: counts.get(r.user.id) ?? 0,
      ourResponse: r.firmResponses[0]
        ? {
            outcome: r.firmResponses[0].outcome,
            reason: r.firmResponses[0].reason,
            respondedAt: r.firmResponses[0].respondedAt.toISOString(),
          }
        : null,
    })),
    guidance:
      'You are the controller of your own matter files. Decide what may be released or ' +
      'erased in light of your professional retention duties — an attorney may be required ' +
      'to keep a file regardless of the request. The platform has already dealt with the ' +
      'data it controls.',
  });
}

/**
 * The firm recording its decision.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 6 referred requests to firms and gave them nowhere to answer, so a
 * referred request sat in `AWAITING_FIRM` for ever. This is that gap closed.
 *
 * The firm decides for ITSELF and for nobody else: the parent request only
 * moves to a finished state once every referred firm has replied, which is
 * derived in `recordFirmResponse` rather than assumed from this call. A person
 * who engaged two practices gets two answers, not the first one twice.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getFirmMembership(session.userId);

  if (!membership) {
    return NextResponse.json({ error: 'You do not belong to a firm.' }, { status: 404 });
  }

  // Same gate as the read: deciding a subject request is a decision about the
  // practice's retention duties, not about any one matter.
  if (!canManageFirm(membership)) {
    return NextResponse.json(
      {
        error:
          "Only the firm's principal or practice manager can answer data-protection requests.",
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = FirmSubjectResponseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const result = await recordFirmResponse({
    requestId: parsed.data.requestId,
    firmId: membership.firmId,
    outcome: parsed.data.outcome,
    reason: parsed.data.reason,
    respondedById: session.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    allFirmsResponded: result.allFirmsResponded,
    message: result.allFirmsResponded
      ? 'Recorded, and the request is now closed. The person can see your answer.'
      : 'Recorded. The request stays open until every firm it was referred to has answered.',
  });
}
