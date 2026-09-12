import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CONSENT_PURPOSES, mayRelyOnConsentFor } from '@/lib/privacy/policy';
import {
  getPublishedNotice,
  requirePublishedVersionForConsent,
} from '@/lib/privacy/notice';
import { ConsentUpdateSchema } from '@/schemas/privacy.schema';

/**
 * Consent, for the narrow set of purposes that genuinely rest on it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What is NOT here, and why that matters more than what is.
 *
 * Matter data does not appear in `ConsentPurpose` and cannot be added to it.
 * It is processed to perform the retainer and to meet the firm's professional
 * duties — different lawful bases, with no withdrawal right attached. Asking a
 * client to "consent" to it would promise that they can withdraw it, and we
 * would then have to break that promise against a firm that is required to keep
 * the file. Treating everything as consent is the common and expensive PDPA
 * error, and `mayRelyOnConsentFor()` exists to make it a build-time
 * conversation rather than a runtime surprise.
 *
 * Consent here is also never a precondition of using anything. A person who
 * grants none of these keeps full use of the platform.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** GET: the caller's current position on each purpose. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [records, notice] = await Promise.all([
    prisma.consentRecord.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    }),
    getPublishedNotice(),
  ]);

  // Which versions the person's own consent records point at, and whether each
  // one still resolves to a document. A version that does not resolve is shown
  // as such rather than hidden: it is a defect in our evidence, not theirs.
  const referenced = [...new Set(records.map((r) => r.noticeVersion))];
  const resolvable = new Set(
    (
      await prisma.privacyNotice.findMany({
        where: { version: { in: referenced } },
        select: { version: true },
      })
    ).map((n) => n.version)
  );

  // Latest row per purpose wins; a row is never updated in place, so the newest
  // grant or withdrawal is the current state and the rest is the evidence.
  const current = new Map<string, (typeof records)[number]>();
  for (const r of records) if (!current.has(r.purpose)) current.set(r.purpose, r);

  return NextResponse.json({
    noticeVersion: notice?.version ?? null,
    noticePublished: !!notice,
    purposes: Object.entries(CONSENT_PURPOSES).map(([purpose, meta]) => {
      const latest = current.get(purpose);
      return {
        purpose,
        ...meta,
        granted: !!latest && !latest.withdrawnAt,
        decidedAt: latest?.withdrawnAt?.toISOString() ?? latest?.grantedAt.toISOString() ?? null,
        noticeVersionAgreed: latest?.noticeVersion ?? null,
        // The point of recording a version is being able to open it. A link
        // that goes nowhere would manufacture the same false assurance a dead
        // citation does in an AI answer.
        noticeVersionResolves: latest ? resolvable.has(latest.noticeVersion) : null,
      };
    }),
  });
}

/** POST: grant or withdraw one purpose. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ConsentUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { purpose, granted } = parsed.data;

  if (granted) {
    // Fails closed. Recording a grant against a version that resolves to no
    // document is unprovable consent — the exact defect the notice register
    // exists to remove — so it is refused rather than written and discovered
    // later by somebody auditing us. Withdrawal below is never blocked this
    // way: that is the person exercising a right, and a gap in our own
    // paperwork is not a reason to refuse it.
    const version = await requirePublishedVersionForConsent();

    if (!version.ok) {
      return NextResponse.json({ error: version.reason }, { status: 409 });
    }

    await prisma.consentRecord.create({
      data: {
        userId: session.userId,
        purpose,
        noticeVersion: version.version,
        sourceIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: req.headers.get('user-agent') || null,
      },
    });
  } else {
    // Withdrawal marks the outstanding grants rather than deleting them: the
    // history is the evidence that we were entitled to process it up to now.
    await prisma.consentRecord.updateMany({
      where: { userId: session.userId, purpose, withdrawnAt: null },
      data: { withdrawnAt: new Date() },
    });

    // Withdrawal that leaves the data in place is not withdrawal. The AI
    // history purpose is the one where that bites, so honour it immediately.
    if (purpose === 'AI_HISTORY_RETENTION') {
      if (!mayRelyOnConsentFor('aiConversation')) {
        // Unreachable today; here so that moving a model under firm control
        // fails loudly instead of silently deleting the firm's data.
        return NextResponse.json(
          { error: 'That data is not ours to delete on consent withdrawal.' },
          { status: 409 }
        );
      }
      await prisma.aiConversation.deleteMany({ where: { userId: session.userId } });
    }
  }

  return NextResponse.json({ success: true, purpose, granted });
}
