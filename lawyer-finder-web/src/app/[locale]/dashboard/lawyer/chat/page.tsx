import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChatInterface from '@/components/chat/ChatInterface';
import { Suspense } from 'react';

export default async function LawyerChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session || session.role !== 'LAWYER') {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Client Conversations</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage all your client communications in one place.</p>
      </div>
      <Suspense fallback={<div className="flex items-center justify-center p-8 h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div></div>}>
        <ChatInterface userId={session.userId} locale={locale} />
      </Suspense>
    </div>
  );
}
