import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseIdentityDocumentName, readIdentityDocument, TYPE_BY_EXT } from '@/lib/identityDocuments';

/**
 * An applicant's ID card or face photo (src/lib/identityDocuments.ts).
 * Only an administrator, or the person who uploaded it, may open it. Anyone else
 * gets the same 404 as for a file that does not exist.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await params;
  const parsed = parseIdentityDocumentName(name);
  const allowed = parsed && (session.role === 'ADMIN' || session.userId === parsed.ownerId);
  if (!parsed || !allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const file = await readIdentityDocument(name);
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': TYPE_BY_EXT[parsed.ext],
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
