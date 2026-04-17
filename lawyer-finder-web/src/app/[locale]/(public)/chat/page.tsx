import ChatClient from './ChatClient';
import { getSession } from '@/lib/auth';

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

  return (
    <ChatClient
      locale={locale}
      initialQuery={initialQuery}
      isAuthenticated={isAuthenticated}
      conversationId={conversationId}
    />
  );
}
