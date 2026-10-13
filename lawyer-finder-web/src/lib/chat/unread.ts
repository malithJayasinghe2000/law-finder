import prisma from '@/lib/db';
import type { Role } from '@prisma/client';
import { getFirmMembership, resolveConversationAccess } from '@/lib/firms/access';

/**
 * How many conversations have a message this person has not read.
 *
 * Counts only threads they may actually open — a badge for a conversation you
 * may not read still tells you it happened and roughly when. Shared by the
 * unread badge (/api/chat/unread-count) and the client dashboard.
 */
export async function countUnreadConversations(session: { userId: string; role: Role }): Promise<number> {
  // Platform staff read no threads, so they have no unread messages.
  if (session.role === 'ADMIN') return 0;

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

    return count;
}
