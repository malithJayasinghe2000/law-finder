import ChatClient from './ChatClient';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

export const metadata = { title: 'AI Chat' };

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { locale } = await params;
  const p = await searchParams;
  const initialQuery = p.q || '';
  const conversationId = p.id || undefined;

  // Check if user is authenticated
  const session = await getSession();
  const isAuthenticated = !!session;

  // What the assistant holds, for its greeting: the Legal Library is the list
  // of what the AI has (Sync from AI keeps them equal). It used to be typed into
  // the greeting and named an Act the AI did not hold.
  const acts = await prisma.legalDocument.findMany({
    where: { status: 'ACTIVE' },
    select: { title: true },
    orderBy: { title: 'asc' },
  });

  return (
    <ChatClient
      locale={locale}
      initialQuery={initialQuery}
      isAuthenticated={isAuthenticated}
      conversationId={conversationId}
      actTitles={acts.map((a) => a.title)}
    />
  );
}
