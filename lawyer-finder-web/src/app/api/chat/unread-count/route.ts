import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { countUnreadConversations } from '@/lib/chat/unread';

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

    return NextResponse.json({ count: await countUnreadConversations(session) });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
