import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RespondToClientIntakeSchema } from '@/schemas/clientIntake.schema';
import {
  findClientIntakeByToken,
  revealClientIntake,
  acceptClientIntake,
  closeClientIntake,
} from '@/lib/firms/clientIntake';
import { EmailService } from '@/lib/email/EmailService';

/**
 * A client answering a request a practice opened for them.
 *
 * The link is NOT a bearer token. Anyone holding it sees only which practice
 * sent it; the matter itself is shown, and can be accepted, only by someone
 * signed in with the address it was sent to. A forwarded email must not show a
 * stranger someone else's legal problem. See src/lib/firms/clientIntake.ts.
 */

async function signedInEmail() {
  const session = await getSession();
  if (!session) return { session: null, email: null };
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, fullName: true },
  });
  return { session, email: user?.email.toLowerCase() ?? null, fullName: user?.fullName ?? null };
}

/** GET ?token=… — what is this, and (for the right person) what does it say? */
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'That link is not valid.' }, { status: 400 });

    const inv = await findClientIntakeByToken(token);
    if (!inv) return NextResponse.json({ error: 'That link is not valid.' }, { status: 404 });

    const { session, email } = await signedInEmail();
    const isAddressee = !!email && email === inv.email;

    let details = null;
    if (isAddressee && inv.status === 'PENDING') {
      const attorney = inv.attorneyId
        ? await prisma.lawyerProfile.findUnique({ where: { id: inv.attorneyId }, select: { fullName: true } })
        : null;
      details = {
        ...revealClientIntake(inv),
        practiceArea: inv.practiceArea,
        mode: inv.mode,
        attorneyName: attorney?.fullName ?? null,
      };
    }

    return NextResponse.json({
      request: {
        firmName: inv.firm.name,
        district: inv.firm.district,
        email: inv.email,
        status: inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        signedIn: !!session,
        isAddressee,
        details,
      },
    });
  } catch (error) {
    console.error('[CLIENT_REQUEST_GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: accept or decline. */
export async function POST(req: Request) {
  try {
    const { session, email, fullName } = await signedInEmail();
    if (!session || !email) {
      return NextResponse.json(
        { error: 'Sign in — or create an account with the address this was sent to — to answer it.' },
        { status: 401 }
      );
    }

    const validated = RespondToClientIntakeSchema.safeParse(await req.json());
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const inv = await findClientIntakeByToken(validated.data.token);
    if (!inv) return NextResponse.json({ error: 'That link is not valid.' }, { status: 404 });

    if (email !== inv.email) {
      return NextResponse.json(
        { error: `This request was sent to ${inv.email}. Sign in with that address to answer it.` },
        { status: 403 }
      );
    }

    if (inv.status !== 'PENDING') {
      return NextResponse.json(
        { error: inv.status === 'EXPIRED' ? 'This request has expired. Ask the practice to send it again.' : 'This request has already been answered or withdrawn.' },
        { status: inv.status === 'EXPIRED' ? 410 : 409 }
      );
    }

    if (validated.data.action === 'decline') {
      await closeClientIntake(inv.id, 'DECLINED');
      return NextResponse.json({ success: true, accepted: false });
    }

    // Someone who joined the practice since cannot become its client this way.
    const member = await prisma.firmMember.findUnique({
      where: { firmId_userId: { firmId: inv.firmId, userId: session.userId } },
      select: { status: true },
    });
    if (member?.status === 'ACTIVE') {
      return NextResponse.json({ error: 'You are a member of this practice.' }, { status: 400 });
    }

    const result = await acceptClientIntake({ invitationId: inv.id, clientId: session.userId });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status });
    }

    const clientName = fullName || 'Client';
    EmailService.sendBookingCreatedClient(email, clientName, result.firmName, 'To be arranged', '—', result.bookingNumber);
    if (result.firmEmail) {
      EmailService.sendBookingCreatedLawyer(result.firmEmail, result.firmName, clientName, 'To be arranged', '—');
    }

    return NextResponse.json({
      success: true,
      accepted: true,
      bookingId: result.bookingId,
      bookingNumber: result.bookingNumber,
    });
  } catch (error) {
    console.error('[CLIENT_REQUEST_RESPOND]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
