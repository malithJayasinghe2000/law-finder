import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const conversationId = params.id;

    // Verify participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: session.userId }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const conversationId = params.id;
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // Verify participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: session.userId }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: session.userId,
        content
      }
    });

    // Update conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });
    
    // Update sender's last read time so they don't see their own message as unread
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: session.userId },
      data: { lastReadAt: new Date() }
    });

    // Get the other participant to return receiverId for SocketIO broadcast
    const otherParticipant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: { not: session.userId } }
    });

    return NextResponse.json({ 
      ...message, 
      receiverId: otherParticipant?.userId 
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
