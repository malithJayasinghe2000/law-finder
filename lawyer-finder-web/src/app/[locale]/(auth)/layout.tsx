import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await getSession();
  const { locale } = await params;

  if (session) {
    redirect(`/${locale}`);
  }

  return <>{children}</>;
}
