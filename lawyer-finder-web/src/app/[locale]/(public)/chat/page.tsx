import { getTranslations } from 'next-intl/server';
import ChatClient from './ChatClient';

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

  return <ChatClient locale={locale} initialQuery={initialQuery} />;
}
