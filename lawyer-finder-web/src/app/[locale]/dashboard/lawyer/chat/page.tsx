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
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-neutral-900 tracking-tight">Client Conversations</h1>
        <p className="text-xs font-bold text-[#bfa37a] uppercase tracking-widest mt-1.5">Manage all your client communications in one place</p>
      </div>
      <Suspense fallback={<div className="flex items-center justify-center p-8 h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#bfa37a]"></div></div>}>
        <ChatInterface userId={session.userId} locale={locale} />
      </Suspense>
    </div>
  );
}
