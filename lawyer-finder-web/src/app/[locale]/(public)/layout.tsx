import FooterWrapper from '@/components/layout/FooterWrapper';

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-[100vh] flex flex-col text-foreground selection:bg-primary/30">
      <main className="flex-1 w-full relative z-10">
        {children}
      </main>
      <FooterWrapper locale={locale} />
    </div>
  );
}
