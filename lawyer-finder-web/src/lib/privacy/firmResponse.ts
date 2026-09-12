/**
 * A law firm answering the part of a data-subject request that is theirs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS AT ALL.
 *
 * We are the firm's **processor** for matter data. When somebody asks us for
 * everything we hold, or asks us to delete it, the part touching their matter
 * file is not ours to answer — the firm is the controller, and it may be
 * professionally required to keep the file. Phase 6 modelled that honestly with
 * `AWAITING_FIRM` and referred the request onward.
 *
 * What it did not build was anywhere for the firm to actually answer. The
 * referral endpoint was read-only, so a referred request sat in `AWAITING_FIRM`
 * for ever: the firm could see the request and had no way to decide it. That is
 * the same defect as the rest of Phase 6 — a right that exists and cannot be
 * exercised — just at the firm's end rather than the client's.
 *
 * TWO RULES THIS FILE HOLDS, AND WHY THEY ARE NOT OBVIOUS:
 *
 *   1. **A firm answers only for itself.** One request can be referred to
 *      several firms. If the first firm to reply closed the request, the second
 *      firm's client would be told their matter had been dealt with by a
 *      practice that never looked at it.
 *
 *   2. **The parent request advances only when EVERY referred firm has
 *      replied**, and the outcome is `PARTIALLY_FULFILLED` whenever any firm
 *      retained anything. Reporting a clean `COMPLETED` over a firm that is
 *      still holding the file would be a false answer to a statutory request.
 *
 * Run `npm run check:pdpa` after changing this file.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import prisma from '@/lib/db';
import type { FirmSubjectResponseOutcome } from '@prisma/client';

/** Outcomes in which the firm is still holding matter data afterwards. */
const RETAINING_OUTCOMES: FirmSubjectResponseOutcome[] = ['REFUSED_RETAINED', 'PARTIAL'];

/**
 * The shortest reason we will accept.
 *
 * A refusal that does not name the duty is not a defensible refusal, and "no"
 * is not a reason. This is a floor on effort, not a guarantee of quality — but
 * it stops the one-word answer that would make the record worthless.
 */
export const MIN_FIRM_REASON_LENGTH = 20;

export function assertFirmReason(
  outcome: FirmSubjectResponseOutcome,
  reason: string
): { ok: true } | { ok: false; error: string } {
  if (reason.trim().length < MIN_FIRM_REASON_LENGTH) {
    return {
      ok: false,
      error:
        RETAINING_OUTCOMES.includes(outcome)
          ? 'Say which duty requires you to keep the file. A refusal that does not name the ' +
            'duty is not a defensible refusal, and the person is told your reason verbatim.'
          : 'Explain briefly what you did, in words the person can understand. It is shown ' +
            'to them as your answer.',
    };
  }
  return { ok: true };
}

/**
 * Record one firm's decision, then re-derive the parent request's state.
 *
 * `upsert` on `(requestId, firmId)`: a firm re-deciding corrects its own row
 * rather than adding a second answer to the same question.
 */
export async function recordFirmResponse(params: {
  requestId: string;
  firmId: string;
  outcome: FirmSubjectResponseOutcome;
  reason: string;
  respondedById: string;
}): Promise<{ ok: true; allFirmsResponded: boolean } | { ok: false; error: string }> {
  const request = await prisma.dataSubjectRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, referredFirmIds: true, status: true },
  });

  if (!request) return { ok: false, error: 'That request does not exist.' };

  // The gate that matters: a firm may only answer a request that was actually
  // referred to it. Without this, any firm could write an answer onto any
  // person's request — and would learn that the request exists at all.
  if (!request.referredFirmIds.includes(params.firmId)) {
    return { ok: false, error: 'That request was not referred to your firm.' };
  }

  const reasonOk = assertFirmReason(params.outcome, params.reason);
  if (!reasonOk.ok) return { ok: false, error: reasonOk.error };

  await prisma.subjectRequestFirmResponse.upsert({
    where: { requestId_firmId: { requestId: params.requestId, firmId: params.firmId } },
    create: {
      requestId: params.requestId,
      firmId: params.firmId,
      outcome: params.outcome,
      reason: params.reason.trim(),
      respondedById: params.respondedById,
    },
    update: {
      outcome: params.outcome,
      reason: params.reason.trim(),
      respondedById: params.respondedById,
    },
  });

  const responses = await prisma.subjectRequestFirmResponse.findMany({
    where: { requestId: params.requestId },
    select: { firmId: true, outcome: true },
  });

  const responded = new Set(responses.map((r) => r.firmId));
  const allFirmsResponded = request.referredFirmIds.every((id) => responded.has(id));

  if (allFirmsResponded) {
    const anyRetained = responses.some((r) => RETAINING_OUTCOMES.includes(r.outcome));

    await prisma.dataSubjectRequest.update({
      where: { id: params.requestId },
      data: {
        // PARTIALLY_FULFILLED whenever any firm is still holding the file. A
        // clean COMPLETED over a retained matter would be a false answer.
        status: anyRetained ? 'PARTIALLY_FULFILLED' : 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  return { ok: true, allFirmsResponded };
}

/**
 * The firm responses on a request, for showing the person who asked.
 *
 * This is the subject reading answers addressed to them, so the firm's name and
 * its reason are both included — unlike the firm-facing view, which is filtered
 * so one firm never learns that another holds a matter for the same client.
 */
export async function firmResponsesForSubject(requestId: string) {
  const responses = await prisma.subjectRequestFirmResponse.findMany({
    where: { requestId },
    orderBy: { respondedAt: 'asc' },
    select: {
      outcome: true,
      reason: true,
      respondedAt: true,
      firm: { select: { name: true } },
    },
  });

  return responses.map((r) => ({
    firmName: r.firm.name,
    outcome: r.outcome,
    reason: r.reason,
    respondedAt: r.respondedAt.toISOString(),
  }));
}
