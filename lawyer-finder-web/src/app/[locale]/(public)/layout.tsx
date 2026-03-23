import Footer from '@/components/layout/Footer';

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      <main className="flex-1">{children}</main>
      <Footer locale={locale} />
    </>
  );
}
