import { NextResponse, NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { publishNotice } from '@/lib/privacy/notice';

/**
 * Publish a draft privacy notice.
 *
 * A separate, deliberate step from saving. Saving a draft changes nothing for
 * anybody; publishing changes the document every future consent record points
 * at, and supersedes — never overwrites — the one currently in force.
 *
 * The rule lives in `publishNotice()` so that the transaction that supersedes
 * the old version and promotes the new one cannot be half-applied, and so
 * `npm run check:pdpa` can assert it without going through HTTP.
 */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await props.params;

  const result = await publishNotice({ id, actorUserId: auth.userId });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  return NextResponse.json({ success: true, version: result.version });
}
