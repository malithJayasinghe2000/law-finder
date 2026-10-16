import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { listNotices, getPublishedNotice, assertVersionLabel } from '@/lib/privacy/notice';
import { PrivacyNoticeCreateSchema } from '@/schemas/privacy.schema';

/**
 * The privacy-notice register, for administrators.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the only place the notice can be written, and the rules that make it
 * evidence rather than a web page live one layer down in
 * `src/lib/privacy/notice.ts`:
 *
 *   - publishing creates a NEW version and supersedes the old one
 *   - a published version can never be edited or deleted
 *
 * A new draft is pre-filled with the text currently in force, because the
 * realistic edit is "change two paragraphs", and making somebody retype a legal
 * document from scratch is how clauses go missing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** GET: every version, plus the text to start a new draft from. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [notices, published] = await Promise.all([listNotices(), getPublishedNotice()]);

  // How many consent records point at each version. An administrator about to
  // publish should be able to see that people agreed under the current wording
  // — it is the reason the old version cannot be edited or removed.
  const consentCounts = await prisma.consentRecord.groupBy({
    by: ['noticeVersion'],
    _count: { _all: true },
  });
  const counts = new Map(consentCounts.map((c) => [c.noticeVersion, c._count._all]));

  return NextResponse.json({
    notices: notices.map((n) => ({
      ...n,
      publishedAt: n.publishedAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      consentRecordsAgreedUnderIt: counts.get(n.version) ?? 0,
      editable: n.status === 'DRAFT',
    })),
    currentVersion: published?.version ?? null,
    /** Starting point for a new draft: what is in force today. */
    currentBody: published?.body ?? '',
    /** Versions referenced by consent records but missing from the register. */
    danglingVersions: [...counts.keys()].filter(
      (v) => !notices.some((n) => n.version === v)
    ),
  });
}

/** POST: create a draft. Never publishes — that is a second, deliberate step. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = PrivacyNoticeCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const label = assertVersionLabel(parsed.data.version);
  if (!label.ok) return NextResponse.json({ error: label.reason }, { status: 400 });

  // A version label is never reused, even for a version that only ever existed
  // as a draft. Two documents that have answered to one name is exactly the
  // ambiguity a consent record cannot survive.
  const clash = await prisma.privacyNotice.findUnique({
    where: { version: parsed.data.version },
    select: { status: true },
  });

  if (clash) {
    return NextResponse.json(
      {
        error:
          `Version ${parsed.data.version} already exists (${clash.status}). Version labels are ` +
          'never reused - add a suffix, e.g. ' +
          `${parsed.data.version}-b.`,
      },
      { status: 409 }
    );
  }

  const created = await prisma.privacyNotice.create({
    data: {
      version: parsed.data.version,
      title: parsed.data.title ?? 'Privacy Notice',
      body: parsed.data.body,
      changeSummary: parsed.data.changeSummary ?? null,
      status: 'DRAFT',
    },
    select: { id: true, version: true, status: true },
  });

  return NextResponse.json({ notice: created }, { status: 201 });
}
