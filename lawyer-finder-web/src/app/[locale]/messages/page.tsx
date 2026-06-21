import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChatInterface from '@/components/chat/ChatInterface';
import HeaderWrapper from '@/components/layout/HeaderWrapper';
import Footer from '@/components/layout/Footer';
import { Suspense } from 'react';

export default async function ClientChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="min-h-screen bg-[#faf8f6] flex flex-col">
      
      <main className="flex-1 w-full max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif text-neutral-900 tracking-tight">Your Conversations</h1>
          <p className="text-xs font-bold text-[#bfa37a] uppercase tracking-widest mt-1.5">Connect with lawyers securely</p>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center p-8 h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#bfa37a]"></div></div>}>
          <ChatInterface userId={session.userId} locale={locale} />
        </Suspense>
      </main>
      <Footer locale={locale} />
    </div>
  );
}
