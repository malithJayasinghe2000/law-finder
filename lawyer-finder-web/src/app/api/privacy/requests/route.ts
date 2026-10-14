import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  subjectRequestDueDate,
  needsFirmReferral,
  SUBJECT_REQUEST_DUE_DAYS,
} from '@/lib/privacy/policy';
import { eraseSubject, erasurePreview } from '@/lib/privacy/subject';
import { firmResponsesForSubject } from '@/lib/privacy/firmResponse';
import { SubjectRequestCreateSchema } from '@/schemas/privacy.schema';
import { EmailService } from '@/lib/email/EmailService';

/**
 * Data-subject requests under the PDPA.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The endpoints are the easy part. The hard part is that a request spanning
 * matter data has TWO decision-makers, and pretending otherwise is how a
 * platform ends up either breaching a statute or destroying a firm's file.
 *
 *   - For the data WE control, we act now.
 *   - For the matter file the FIRM controls, we refer. We are their processor;
 *     releasing or deleting it on our own authority is exactly what a processor
 *     may not do, and the firm may have a professional duty to retain it.
 *
 * `AWAITING_FIRM` is that split made explicit in the model rather than hidden
 * in a support inbox. A request that touches both ends as
 * `PARTIALLY_FULFILLED`, and the response says which parts and why — a refusal
 * that does not name the duty requiring retention is not a defensible refusal.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** GET: the caller's own requests, and a preview of what erasure would do. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requests = await prisma.dataSubjectRequest.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });

  // What each firm decided about the matter half of the request. Referring a
  // request onward and never showing the person the answer would make the
  // referral a black hole from their side — they would see AWAITING_FIRM and
  // never learn what the firm said.
  const firmAnswers = await Promise.all(
    requests.map((r) => firmResponsesForSubject(r.id))
  );

  return NextResponse.json({
    requests: requests.map((r, i) => ({
      ...r,
      dueBy: r.dueBy.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      firmResponses: firmAnswers[i],
    })),
    responseTargetDays: SUBJECT_REQUEST_DUE_DAYS,
    erasurePreview: erasurePreview(),
  });
}

/** POST: raise a request. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = SubjectRequestCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { type, requestNote, confirm } = parsed.data;

  // Erasure is irreversible and partial. Requiring an explicit confirmation
  // after the preview has been shown is not friction for its own sake — the
  // person is agreeing to something that cannot be undone and does not do what
  // its name suggests.
  if (type === 'ERASURE' && !confirm) {
    return NextResponse.json(
      {
        error:
          'Erasure needs explicit confirmation. Review what will and will not be deleted first.',
        preview: erasurePreview(),
      },
      { status: 400 }
    );
  }

  const firmIds = needsFirmReferral(type)
    ? await prisma.booking
        .findMany({
          where: { clientId: session.userId },
          select: { firmId: true },
          distinct: ['firmId'],
        })
        .then((rows) => rows.map((r) => r.firmId))
    : [];

  const request = await prisma.dataSubjectRequest.create({
    data: {
      userId: session.userId,
      type,
      requestNote: requestNote ?? null,
      referredFirmIds: firmIds,
      dueBy: subjectRequestDueDate(),
      status: firmIds.length > 0 ? 'AWAITING_FIRM' : 'IN_PROGRESS',
    },
  });

  // Tell each practice the request was sent to. It has a legal deadline and the
  // practice had no other way to learn of it. Only those who may answer it — the
  // principal and the practice manager — and never a word about the request.
  if (firmIds.length > 0) {
    const answerers = await prisma.firmMember.findMany({
      where: { firmId: { in: firmIds }, status: 'ACTIVE', role: { in: ['FIRM_OWNER', 'FIRM_ADMIN'] } },
      select: { user: { select: { email: true } }, firm: { select: { name: true } } },
    });
    // Not awaited: the mail server took ~18s here, and the person making the
    // request should not wait on it. This runs on a long-lived Node server
    // (server.js), so the sends complete after the response; a failure is logged
    // by sendMailSafe and never fails the request.
    void Promise.allSettled(
      answerers.map((m) =>
        EmailService.sendDataRequestReferred({ to: m.user.email, firmName: m.firm.name, dueBy: request.dueBy })
      )
    );
  }

  // Erasure runs immediately against platform-controlled data. Access and
  // portability are served by /api/privacy/export; rectification by
  // PATCH /api/privacy/me.
  if (type === 'ERASURE') {
    const result = await eraseSubject(session.userId);

    if (!result) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const updated = await prisma.dataSubjectRequest.update({
      where: { id: request.id },
      data: {
        status: firmIds.length > 0 ? 'PARTIALLY_FULFILLED' : 'COMPLETED',
        completedAt: new Date(),
        outcomeNote:
          'Account anonymised and platform-held data deleted. ' +
          (firmIds.length > 0
            ? `Matter files held for ${firmIds.length} law firm(s) were referred to them — ` +
              'the firm decides, and may be professionally required to retain them.'
            : 'No law firm holds a matter for you.'),
      },
    });

    return NextResponse.json(
      {
        request: updated,
        result,
        message:
          'Your account has been anonymised. Some records are kept — see `retained` for ' +
          'each one and the reason.',
      },
      { status: 201 }
    );
  }

  return NextResponse.json({ request }, { status: 201 });
}
