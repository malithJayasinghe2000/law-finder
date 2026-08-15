import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getConversationAccess } from '@/lib/firms/access';

/**
 * Mark a thread read.
 *
 * Goes through the same gate as reading the messages: marking a conversation
 * read that you may not open is a small thing, but it is the same participant
 * lookup that let a departed attorney keep acting on a former client's thread,
 * and leaving one sibling on the old rule is how a fix half-lands.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const conversationId = params.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        firmId: true,
        clientId: true,
        participants: { select: { userId: true } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const access = await getConversationAccess({
      actorUserId: session.userId,
      actorRole: session.role,
      conversation: {
        firmId: conversation.firmId,
        clientId: conversation.clientId,
        participantUserIds: conversation.participants.map((p) => p.userId),
      },
    });

    if (!access.canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: session.userId },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
