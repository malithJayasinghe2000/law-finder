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

    let allowedCount = conversations.length;
    let isLimited = false;

    if (session.role === 'LAWYER') {
      const profile = await prisma.lawyerProfile.findUnique({
        where: { userId: session.userId },
        include: {
          Subscription: {
            where: { status: 'ACTIVE' },
            include: { plan: true }
          }
        }
      });
      // Basic check: if no active subscription or plan is too low, limit to 5
      const hasActivePlan = profile?.Subscription && profile.Subscription.length > 0;
      if (!hasActivePlan) {
        allowedCount = 5;
        isLimited = true;
      }
    }

    // Determine the allowed conversation IDs based on creation date (oldest ones get priority)
    const allowedConversationIds = [...conversations]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, allowedCount)
      .map(c => c.id);

    const formatted = conversations.map((c) => {
      // If limited and this conversation is NOT one of the oldest allowed ones, blur it
      if (isLimited && !allowedConversationIds.includes(c.id)) {
        return {
          id: c.id, // Keep ID so frontend can render securely but consistently
          isDummy: true,
          otherUser: { fullName: 'Locked Conversation', profileImageUrl: null, email: 'hidden' },
          lastMessage: { content: 'Please upgrade to view this conversation.' },
          unreadCount: 0,
          updatedAt: c.updatedAt
        };
      }

      const otherParticipant = c.participants.find(p => p.userId !== session.userId);
      const meParticipant = c.participants.find(p => p.userId === session.userId);
      
      const unreadCount = c.messages.filter(m => 
        m.senderId !== session.userId && 
        new Date(m.createdAt) > new Date(meParticipant?.lastReadAt || 0)
      ).length;

      return {
        id: c.id,
        isDummy: false,
        otherUser: otherParticipant?.user,
        lastMessage: c.messages[0],
        unreadCount,
        updatedAt: c.updatedAt
      };
    });

    return NextResponse.json({
      conversations: formatted,
      isLimited: isLimited && conversations.length > allowedCount
    });
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { targetUserId } = await request.json();
    if (!targetUserId) return NextResponse.json({ error: 'Missing target user' }, { status: 400 });

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
