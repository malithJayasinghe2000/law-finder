import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { buildSubjectExport } from '@/lib/privacy/subject';
import { recordAccess } from '@/lib/privacy/audit';

/**
 * Subject access and portability: everything we hold about you as controller,
 * as a JSON file.
 *
 * What is NOT in it — matter files, quotes, engagement letters, fee notes,
 * attorney messages and conflict-check records — is not an omission. Those
 * belong to the law firm, and a conflict-check record in particular names other
 * people; releasing it on one party's request would answer this person by
 * breaching several others. The document says so in `notIncluded` rather than
 * leaving the gap unexplained.
 *
 * See src/lib/privacy/subject.ts for the reasoning in full.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await buildSubjectExport(session.userId);

  if (!data) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // Exporting one's own data is still an access event worth recording — it is
  // the moment a copy leaves the system.
  await recordAccess({
    actorUserId: session.userId,
    actorRole: session.role,
    resource: 'SUBJECT_REQUEST',
    resourceId: session.userId,
    action: 'EXPORTED',
  });

  const filename = `my-data-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
