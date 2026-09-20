import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isValidUUID, sanitizeString } from '@/lib/security';
import { getConversationAccess, discloseMessage } from '@/lib/firms/access';
import { encryptField } from '@/lib/privacy/encryption';
import { recordAccess } from '@/lib/privacy/audit';
import { randomUUID } from 'crypto';

/**
 * Reading and writing privileged messages.
 *
 * Who may do either is decided in `src/lib/firms/access.ts`. The participant
 * lookup that used to live here was not the same rule: it had no end, so an
 * attorney who left a firm kept reading its clients' threads, and it said
 * nothing at all about platform staff.
 *
 * Message content is encrypted at rest and only ever leaves through
 * `discloseMessage`. See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
 */

/** Load just enough of the thread to decide access. */
async function loadConversation(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      firmId: true,
      clientId: true,
      bookingId: true,
      participants: { select: { userId: true } },
    },
  });
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const conversationId = params.id;
    if (!conversationId || !isValidUUID(conversationId)) {
      return NextResponse.json({ error: 'A valid conversation ID is required.' }, { status: 400 });
    }

    const conversation = await loadConversation(conversationId);
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
      return NextResponse.json(
        {
          error:
            access.basis === 'FORMER_PARTICIPANT'
              ? 'You no longer practise in the firm this conversation belongs to.'
              : 'Forbidden',
        },
        { status: 403 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    // Someone other than the client reading a client's privileged messages is
    // worth recording. The log holds no content — see src/lib/privacy/audit.ts.
    await recordAccess({
      actorUserId: session.userId,
      actorRole: access.basis,
      resource: 'MESSAGE_THREAD',
      resourceId: conversation.id,
      action: 'READ_DETAIL',
      bookingId: conversation.bookingId,
      firmId: conversation.firmId,
      clientUserId: conversation.clientId,
    });

    return NextResponse.json(messages.map((m) => discloseMessage(m, access)));
  } catch (error) {
    console.error('Fetch messages error:', error instanceof Error ? error.message : 'Fetch failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const conversationId = params.id;
    if (!conversationId || !isValidUUID(conversationId)) {
      return NextResponse.json({ error: 'A valid conversation ID is required.' }, { status: 400 });
    }

    const { content } = await request.json();
    const sanitizedContent = content ? sanitizeString(content, 5000) : '';

    if (!sanitizedContent || sanitizedContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty and must be valid plain text.' },
        { status: 400 }
      );
    }

    const conversation = await loadConversation(conversationId);
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

    if (!access.canWrite) {
      return NextResponse.json(
        {
          error:
            access.basis === 'FORMER_PARTICIPANT'
              ? 'You no longer practise in the firm this conversation belongs to.'
              : 'Forbidden',
        },
        { status: 403 }
      );
    }

    // The id is generated here so the encrypted content can be bound to it
    // before the insert — see src/lib/privacy/encryption.ts.
    const messageId = randomUUID();

    const message = await prisma.message.create({
      data: {
        id: messageId,
        conversationId,
        senderId: session.userId,
        content: encryptField(
          { model: 'Message', recordId: messageId, field: 'content' },
          sanitizedContent
        ),
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // The sender's own message should not come back to them as unread.
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: session.userId },
      data: { lastReadAt: new Date() },
    });

    const otherParticipant = await prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: { not: session.userId } },
    });

    // Echo back what they typed, not the ciphertext of it. The socket broadcast
    // downstream uses this payload, so returning the stored form here would put
    // ciphertext on the wire to the other participant's browser.
    return NextResponse.json({
      ...message,
      content: sanitizedContent,
      receiverId: otherParticipant?.userId,
    });
  } catch (error) {
    console.error('Send message error:', error instanceof Error ? error.message : 'Send failed');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
