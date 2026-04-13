import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST /api/ai-chat/conversations/[id]/messages — save a message pair (user + assistant)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify conversation belongs to user
    const conversation = await prisma.aiConversation.findFirst({
      where: { id, userId: session.userId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const body = await req.json();
    const { userMessage, assistantMessage, sources, lawyerSuggestions } = body;

    if (!userMessage || !assistantMessage) {
      return NextResponse.json({ error: 'Both userMessage and assistantMessage are required' }, { status: 400 });
    }

    // Save both messages in a transaction
    const messages = await prisma.$transaction([
      prisma.aiMessage.create({
        data: {
          conversationId: id,
          role: 'user',
          content: userMessage,
        },
      }),
      prisma.aiMessage.create({
        data: {
          conversationId: id,
          role: 'assistant',
          content: assistantMessage,
          sources: sources || undefined,
          lawyerSuggestions: lawyerSuggestions || undefined,
        },
      }),
    ]);

    // Auto-generate title from first user message if still default
    if (conversation.title === 'New Chat') {
      const title = userMessage.slice(0, 80) + (userMessage.length > 80 ? '...' : '');
      await prisma.aiConversation.update({
        where: { id },
        data: { title },
      });
    }

    // Update conversation timestamp
    await prisma.aiConversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ messages }, { status: 201 });
  } catch (error) {
    console.error('[AI_CHAT_SAVE_MSG_ERROR]', error);
    return NextResponse.json({ error: 'Failed to save messages' }, { status: 500 });
  }
}
