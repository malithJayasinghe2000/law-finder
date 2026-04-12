import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ count: 0 });

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: session.userId } }
      },
      include: {
        participants: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    let count = 0;
    conversations.forEach(c => {
      const meParticipant = c.participants.find(p => p.userId === session.userId);
      const lastMessage = c.messages[0];
      if (lastMessage && lastMessage.senderId !== session.userId) {
        if (new Date(lastMessage.createdAt) > new Date(meParticipant?.lastReadAt || 0)) {
          count++;
        }
      }
    });

    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ count: 0 });
  }
}
