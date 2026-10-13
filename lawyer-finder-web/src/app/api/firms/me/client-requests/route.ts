import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';
import { CreateClientIntakeSchema, RevokeClientIntakeSchema } from '@/schemas/clientIntake.schema';
import {
  createClientIntakeInvitation,
  closeClientIntake,
  expireStaleClientIntakes,
} from '@/lib/firms/clientIntake';
import { EmailService } from '@/lib/email/EmailService';

/**
 * Requests this practice opened for clients who came to it directly.
 *
 * Principal or practice manager only (`canManageFirm`) — the same people who
 * assign matters. Authority comes from MEMBERSHIP, never the platform role: a
 * practice manager's role is CLIENT. See src/lib/firms/clientIntake.ts.
 */

async function managerOrError() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const membership = await getFirmMembership(session.userId);
  if (!membership) {
    return { error: NextResponse.json({ error: 'You do not belong to a firm.' }, { status: 404 }) };
  }
  if (!canManageFirm(membership)) {
    return {
      error: NextResponse.json(
        { error: 'Only a principal or practice manager can open requests for clients.' },
        { status: 403 }
      ),
    };
  }
  return { session, membership };
}

/** GET: the practice's attorneys (for the form) and its recent requests. */
export async function GET() {
  try {
    const ctx = await managerOrError();
    if ('error' in ctx) return ctx.error;
    const { firmId } = ctx.membership;

    await expireStaleClientIntakes();

    const [members, invitations] = await Promise.all([
      // Alphabetical, like the assign screen — nothing that nudges toward a person.
      prisma.firmMember.findMany({
        where: { firmId, status: 'ACTIVE', role: { in: ['FIRM_OWNER', 'ATTORNEY'] } },
        select: { user: { select: { profile: { select: { id: true, fullName: true } } } } },
      }),
      prisma.clientIntakeInvitation.findMany({
        where: { firmId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        // Neither the token (the credential in the link) nor the matter text.
        select: {
          id: true,
          email: true,
          practiceArea: true,
          mode: true,
          attorneyId: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          bookingId: true,
        },
      }),
    ]);

    const attorneys = members
      .map((m) => m.user.profile)
      .filter((p): p is { id: string; fullName: string } => !!p)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    const nameOf = new Map(attorneys.map((a) => [a.id, a.fullName]));

    return NextResponse.json({
      attorneys,
      invitations: invitations.map((i) => ({
        ...i,
        attorneyName: i.attorneyId ? nameOf.get(i.attorneyId) ?? null : null,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[CLIENT_REQUESTS_GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: open a request and email the client to confirm it. */
export async function POST(req: Request) {
  try {
    const ctx = await managerOrError();
    if ('error' in ctx) return ctx.error;

    const validated = CreateClientIntakeSchema.safeParse(await req.json());
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const result = await createClientIntakeInvitation({
      firmId: ctx.membership.firmId,
      invitedById: ctx.session.userId,
      input: validated.data,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }

    EmailService.sendClientIntakeInvitation({
      to: result.email,
      firmName: result.firmName,
      token: result.token,
    });

    return NextResponse.json({ success: true, id: result.id }, { status: 201 });
  } catch (error) {
    console.error('[CLIENT_REQUESTS_POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH: withdraw a request the client has not answered. */
export async function PATCH(req: Request) {
  try {
    const ctx = await managerOrError();
    if ('error' in ctx) return ctx.error;

    const validated = RevokeClientIntakeSchema.safeParse(await req.json());
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    // Scoped to this practice: another practice's id is simply "not found".
    const inv = await prisma.clientIntakeInvitation.findFirst({
      where: { id: validated.data.invitationId, firmId: ctx.membership.firmId },
      select: { id: true },
    });
    if (!inv || !(await closeClientIntake(inv.id, 'REVOKED'))) {
      return NextResponse.json({ error: 'No open request with that reference.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CLIENT_REQUESTS_PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
