import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RectificationSchema } from '@/schemas/privacy.schema';
import { recordAccess } from '@/lib/privacy/audit';

/**
 * Rectification — correcting your own details.
 *
 * Deliberately narrow. A person may correct what they told us about
 * themselves; they may not reach `role`, `status`, verification state, or
 * anything on a matter. Matter data is the firm's record of what happened, and
 * a client rewriting it would corrupt the firm's file rather than correct it —
 * so a correction to a matter goes to the firm as a request, not as an edit.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = RectificationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to correct.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { status: true },
  });

  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  if (user.status === 'ERASED') {
    return NextResponse.json(
      { error: 'This account has been erased and cannot be edited.' },
      { status: 409 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: parsed.data,
    select: { id: true, email: true, fullName: true, profileImageUrl: true },
  });

  await recordAccess({
    actorUserId: session.userId,
    actorRole: session.role,
    resource: 'SUBJECT_REQUEST',
    resourceId: session.userId,
    action: 'RECTIFIED',
  });

  return NextResponse.json({ user: updated });
}
