import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/ai-chat/conversations — list user's AI conversations
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await prisma.aiConversation.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('[AI_CHAT_LIST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST /api/ai-chat/conversations — create a new conversation
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title || 'New Chat';

    const conversation = await prisma.aiConversation.create({
      data: {
        userId: session.userId,
        title,
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error: any) {
    console.error('[AI_CHAT_CREATE_ERROR]', error?.message, error?.code, error);
    return NextResponse.json({ error: 'Failed to create conversation', details: error?.message }, { status: 500 });
  }
}
