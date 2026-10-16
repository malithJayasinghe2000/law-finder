import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChatInterface from '@/components/chat/ChatInterface';
import { Suspense } from 'react';

/**
 * A client's conversations with the practices they have contacted, inside the
 * client dashboard — the same threads as /messages, which stays for the header
 * link.
 */
export default async function ClientMessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Messages</h1>
        <p className="text-sm text-neutral-500 mt-1">Your conversations with the practices you have contacted.</p>
      </div>
      <Suspense fallback={<div className="flex items-center justify-center p-8 h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div></div>}>
        <ChatInterface userId={session.userId} locale={locale} />
      </Suspense>
    </div>
  );
}
