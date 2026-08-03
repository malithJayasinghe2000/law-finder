import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: session.userId }
        }
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, fullName: true, profileImageUrl: true, email: true, role: true } }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Client conversations are NOT metered on what the attorney pays us.
    //
    // Until Phase 3 an attorney without an active plan saw only their five
    // oldest conversations; the rest were replaced with "Locked Conversation —
    // Please upgrade to view this conversation."
    //
    // Two things wrong with that. It is the defect Phase 2.5 removed from the
    // pricing tiers wearing different clothes — revenue rising with how many
    // clients reach an attorney is fee-sharing whatever it is called, and
    // charging for the connection is charging for the client (guardrail rule 1).
    // And it withheld a client's own message from their own lawyer over an
    // unpaid software bill, which puts us inside a relationship we are not part
    // of.
    //
    // Seats and features may be metered. Clients may not. If you are asked to
    // gate something here, ask whether the number counts software or clients.
    const formatted = conversations.map((c) => {
      const otherParticipant = c.participants.find(p => p.userId !== session.userId);
      const meParticipant = c.participants.find(p => p.userId === session.userId);
      
      const unreadCount = c.messages.filter(m => 
        m.senderId !== session.userId && 
        new Date(m.createdAt) > new Date(meParticipant?.lastReadAt || 0)
      ).length;

      return {
        id: c.id,
        otherUser: otherParticipant?.user,
        lastMessage: c.messages[0],
        unreadCount,
        updatedAt: c.updatedAt
      };
    });

    return NextResponse.json({
      conversations: formatted,
      // Retained and always false so existing clients keep parsing the payload.
      // Nothing sets it any more, by design.
      isLimited: false,
    });
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { isValidUUID } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { targetUserId } = await request.json();
    if (!targetUserId || !isValidUUID(targetUserId)) {
      return NextResponse.json({ error: 'A valid target user reference is required' }, { status: 400 });
    }

    if (targetUserId === session.userId) {
       return NextResponse.json({ error: 'Cannot chat with yourself' }, { status: 400 });
    }

    // Check if conversation already exists
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: session.userId } } },
          { participants: { some: { userId: targetUserId } } }
        ]
      }
    });

    if (existing) {
      return NextResponse.json({ id: existing.id });
    }

    // Create new conversation
    const newConv = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: session.userId },
            { userId: targetUserId }
          ]
        }
      }
    });

    return NextResponse.json({ id: newConv.id });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
