import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { isPublicDirectoryEnabled } from '@/lib/directory';
import { DirectorySwitchSchema } from '@/schemas/directory.schema';

/**
 * The public directory switch, for administrators.
 *
 * Every change appends a row; nothing is edited. The newest row is the state.
 * See src/lib/directory.ts for what the switch hides and why.
 */

/** GET: the current state and every change, newest first. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [enabled, history] = await Promise.all([
    isPublicDirectoryEnabled(),
    prisma.directorySwitch.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  const people = await prisma.user.findMany({
    where: { id: { in: [...new Set(history.map((h) => h.changedById))] } },
    select: { id: true, fullName: true, email: true },
  });
  const names = new Map(people.map((p) => [p.id, p.fullName || p.email]));

  return NextResponse.json({
    enabled,
    history: history.map((h) => ({
      id: h.id,
      enabled: h.enabled,
      reason: h.reason,
      changedBy: names.get(h.changedById) ?? 'Deleted account',
      createdAt: h.createdAt.toISOString(),
    })),
  });
}

/** PUT: turn the directory on or off. A reason is required. */
export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = DirectorySwitchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid request.' },
      { status: 400 }
    );
  }

  const current = await isPublicDirectoryEnabled();
  if (current === parsed.data.enabled) {
    return NextResponse.json(
      { error: `The directory is already ${current ? 'on' : 'off'}.` },
      { status: 409 }
    );
  }

  try {
    await prisma.directorySwitch.create({
      data: {
        enabled: parsed.data.enabled,
        reason: parsed.data.reason,
        changedById: auth.userId,
      },
    });
  } catch (error) {
    console.error('[DIRECTORY_SWITCH_PUT]', error);
    return NextResponse.json({ error: 'Failed to change the directory switch.' }, { status: 500 });
  }

  return NextResponse.json({
    enabled: parsed.data.enabled,
    message: parsed.data.enabled ? 'Public directory turned on.' : 'Public directory turned off.',
  });
}
