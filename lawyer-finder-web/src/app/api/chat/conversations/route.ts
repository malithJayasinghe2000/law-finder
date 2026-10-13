import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isValidUUID } from '@/lib/security';
import type { BookingStatus } from '@prisma/client';
import { firmMayMessageClient } from '@/lib/consultations/bookingStatus';
import {
  getFirmMembership,
  resolveConversationAccess,
  discloseMessage,
} from '@/lib/firms/access';

/**
 * Client↔firm message threads.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Two rules govern this file, and they came from different phases.
 *
 * PRIVILEGE (Phase 7). A thread carries privileged client↔attorney
 * communication. Who may read one is decided in `src/lib/firms/access.ts` and
 * nowhere else. Before Phase 7 it was decided here, by a single participant
 * lookup — which let an attorney who had left a firm keep reading its clients'
 * messages, and let any signed-in user open a thread with any user id they
 * could name. See DATA-INVENTORY.md §7 finding B.
 *
 * METERING (Phase 3). Conversations are NOT metered on what the attorney pays
 * us. Until Phase 3 an attorney without an active plan saw only their five
 * oldest conversations and the rest read "Locked Conversation — Please upgrade
 * to view this conversation." That is guardrail rule 1: revenue rising with how
 * many clients reach an attorney is fee-sharing whatever it is called, and it
 * withheld a client's own message from their own lawyer over an unpaid software
 * bill. Seats and features may be metered. Clients may not.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Platform staff have no thread list, because they may read no thread.
    if (session.role === 'ADMIN') {
      return NextResponse.json({ conversations: [], isLimited: false });
    }

    const membership =
      session.role === 'LAWYER' ? await getFirmMembership(session.userId) : null;

    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: session.userId } } },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profileImageUrl: true,
                email: true,
                role: true,
              },
            },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = conversations
      .map((c) => {
        const access = resolveConversationAccess({
          actorUserId: session.userId,
          actorRole: session.role,
          membership,
          conversation: {
            firmId: c.firmId,
            clientId: c.clientId,
            participantUserIds: c.participants.map((p) => p.userId),
          },
        });

        // An attorney who has left the firm keeps their participant row but
        // loses the thread. Dropping it from the list rather than showing a
        // locked entry is deliberate: a locked entry tells them a conversation
        // they may not read exists, and with whom.
        if (!access.canRead) return null;

        const otherParticipant = c.participants.find((p) => p.userId !== session.userId);
        const meParticipant = c.participants.find((p) => p.userId === session.userId);
        const lastMessage = c.messages[0] ?? null;

        return {
          id: c.id,
          otherUser: otherParticipant?.user,
          firmId: c.firmId,
          bookingId: c.bookingId,
          lastMessage: lastMessage ? discloseMessage(lastMessage, access) : null,
          unreadCount:
            lastMessage &&
            lastMessage.senderId !== session.userId &&
            new Date(lastMessage.createdAt) > new Date(meParticipant?.lastReadAt || 0)
              ? 1
              : 0,
          updatedAt: c.updatedAt,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return NextResponse.json({
      conversations: formatted,
      // Retained and always false so existing clients keep parsing the payload.
      // Nothing sets it any more, by design — see the metering note above.
      isLimited: false,
    });
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: open a thread.
 *
 * A conversation is between a CLIENT and someone acting for a FIRM. It is not a
 * general-purpose direct-message system, and before Phase 7 it was: the route
 * took any user id and created a thread, so a client could message another
 * client and an attorney could message anyone on the platform. Every thread
 * that exists is a place privileged material will be written, so the shape of
 * who may be in one is a privilege decision, not a product preference.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.role === 'ADMIN') {
      return NextResponse.json(
        {
          error:
            'Platform staff cannot open a message thread. Conversations between a client and their attorney are privileged, and a third party in one can be used to argue that privilege was waived.',
        },
        { status: 403 }
      );
    }

    const { targetUserId, bookingId } = await request.json();
    if (!targetUserId || !isValidUUID(targetUserId)) {
      return NextResponse.json(
        { error: 'A valid target user reference is required' },
        { status: 400 }
      );
    }

    if (targetUserId === session.userId) {
      return NextResponse.json({ error: 'Cannot chat with yourself' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        role: true,
        status: true,
        profile: { select: { firmId: true } },
      },
    });

    if (!target || target.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'That person cannot be messaged.' }, { status: 404 });
    }

    // Work out which side is which, and refuse anything that is not one client
    // and one firm-side person.
    let clientId: string;
    let firmSideUserId: string;

    if (session.role === 'CLIENT' && target.role === 'LAWYER') {
      clientId = session.userId;
      firmSideUserId = target.id;
    } else if (session.role === 'LAWYER' && target.role === 'CLIENT') {
      clientId = target.id;
      firmSideUserId = session.userId;
    } else {
      return NextResponse.json(
        {
          error:
            'A message thread runs between a client and a law firm. It is not a general messaging system.',
        },
        { status: 400 }
      );
    }

    // The firm the client is actually talking to. Resolved from the firm-side
    // person's ACTIVE membership, so a thread is always attached to a practice
    // that exists — which is what makes it possible to take access away when
    // somebody leaves.
    const firmMembership = await getFirmMembership(firmSideUserId);
    if (!firmMembership) {
      return NextResponse.json(
        {
          error:
            'That attorney does not currently practise in a firm on this platform, so there is no practice to address the message to.',
        },
        { status: 409 }
      );
    }

    // Where the client names a matter, check it is theirs and belongs to that
    // firm. A thread pointed at somebody else's matter would put the wrong
    // file's reference on privileged correspondence.
    let linkedBookingId: string | null = null;
    let linkedBooking: { id: string; clientId: string; firmId: string; lawyerId: string | null; status: BookingStatus } | null = null;
    if (bookingId && isValidUUID(bookingId)) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, clientId: true, firmId: true, lawyerId: true, status: true },
      });
      if (booking && booking.clientId === clientId && booking.firmId === firmMembership.firmId) {
        linkedBookingId = booking.id;
        linkedBooking = booking;
      }
    }

    // The firm side may only open a thread about a request the CLIENT sent to
    // this firm, as the attorney assigned to it, while it is still live.
    // Without this an attorney could message any client on the platform — a
    // stranger who never contacted them — which is soliciting (touting).
    if (session.role === 'LAWYER') {
      if (!linkedBooking) {
        return NextResponse.json(
          { error: 'You can message a client only about a request they sent to your practice.' },
          { status: 403 }
        );
      }
      if (!session.profileId || linkedBooking.lawyerId !== session.profileId) {
        return NextResponse.json(
          { error: 'Only the attorney assigned to this request can message the client about it.' },
          { status: 403 }
        );
      }
      if (!firmMayMessageClient(linkedBooking.status)) {
        return NextResponse.json(
          { error: 'This request is closed, so your practice cannot open a new conversation about it.' },
          { status: 403 }
        );
      }
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: session.userId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      // Re-point an existing thread at the current firm. An attorney who has
      // moved practice keeps talking to the same client, and the thread must
      // follow the practice they are in now — otherwise the old firm's members
      // would keep reading a conversation that has moved on.
      await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          firmId: firmMembership.firmId,
          clientId,
          ...(linkedBookingId ? { bookingId: linkedBookingId } : {}),
        },
      });
      return NextResponse.json({ id: existing.id });
    }

    const newConv = await prisma.conversation.create({
      data: {
        firmId: firmMembership.firmId,
        clientId,
        bookingId: linkedBookingId,
        participants: {
          create: [{ userId: session.userId }, { userId: targetUserId }],
        },
      },
    });

    return NextResponse.json({ id: newConv.id });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
