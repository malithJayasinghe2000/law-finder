import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getFirmMembership, resolveConversationAccess } from '@/lib/firms/access';

/**
 * The unread badge.
 *
 * Counts only threads this person may actually open. Before Phase 7 it counted
 * every thread they had a participant row in — so an attorney who had left a
 * firm saw a badge for a former client's message and could not open it, and a
 * badge for a conversation you may not read still tells you it happened and
 * roughly when.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ count: 0 });

    // Platform staff read no threads, so they have no unread messages.
    if (session.role === 'ADMIN') return NextResponse.json({ count: 0 });

    const membership =
      session.role === 'LAWYER' ? await getFirmMembership(session.userId) : null;

    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId: session.userId } } },
      select: {
        firmId: true,
        clientId: true,
        participants: { select: { userId: true, lastReadAt: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          // Deliberately not selecting `content`: a count needs to know that a
          // message exists and who sent it, never what it says.
          select: { senderId: true, createdAt: true },
        },
      },
    });

    let count = 0;

    for (const c of conversations) {
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

      if (!access.canRead) continue;

      const me = c.participants.find((p) => p.userId === session.userId);
      const lastMessage = c.messages[0];

      if (
        lastMessage &&
        lastMessage.senderId !== session.userId &&
        new Date(lastMessage.createdAt) > new Date(me?.lastReadAt || 0)
      ) {
        count++;
      }
    }

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
