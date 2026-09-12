import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { assertEditable } from '@/lib/privacy/notice';
import { PrivacyNoticeUpdateSchema } from '@/schemas/privacy.schema';

/**
 * Editing and discarding a single privacy-notice version.
 *
 * Both operations refuse anything that is not a DRAFT, and that refusal is the
 * feature. A PUBLISHED or SUPERSEDED version is the document people agreed to,
 * pointed at by their consent records — editing it would rewrite the evidence
 * silently, and deleting it would destroy it.
 */

/** GET: one version, for the editor. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await props.params;

  const notice = await prisma.privacyNotice.findUnique({ where: { id } });
  if (!notice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    notice: {
      ...notice,
      publishedAt: notice.publishedAt?.toISOString() ?? null,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
      editable: notice.status === 'DRAFT',
    },
  });
}

/** PATCH: change a draft's text. Never touches a published version. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await props.params;

  const existing = await prisma.privacyNotice.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const editable = assertEditable(existing.status);
  if (!editable.ok) return NextResponse.json({ error: editable.reason }, { status: 409 });

  const body = await req.json().catch(() => null);
  const parsed = PrivacyNoticeUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  const updated = await prisma.privacyNotice.update({
    where: { id },
    data: parsed.data,
    select: { id: true, version: true, status: true, updatedAt: true },
  });

  return NextResponse.json({ notice: updated });
}

/**
 * DELETE: discard a draft.
 *
 * The project convention is soft deletion and no hard deletes, and this is the
 * one place a hard delete is right: a draft has never been in force, nobody has
 * agreed to it, and no consent record can point at it. Keeping abandoned drafts
 * forever would make the register harder to read, which is the opposite of what
 * it is for. Anything published is refused.
 */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await props.params;

  const existing = await prisma.privacyNotice.findUnique({
    where: { id },
    select: { status: true, version: true },
  });

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.status !== 'DRAFT') {
    return NextResponse.json(
      {
        error:
          `Version ${existing.version} is ${existing.status} and cannot be deleted. People ` +
          'agreed to it, and their consent records point at these words. A version that ' +
          'has been in force stays readable at its own address permanently.',
      },
      { status: 409 }
    );
  }

  // Belt and braces: the status check above is the rule, and this makes the
  // delete itself unable to match a published row even if that check is ever
  // refactored away.
  await prisma.privacyNotice.deleteMany({ where: { id, status: 'DRAFT' } });

  return NextResponse.json({ success: true });
}
