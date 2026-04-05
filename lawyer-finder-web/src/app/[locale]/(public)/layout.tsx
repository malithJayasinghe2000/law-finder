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
    <div className="min-h-[100vh] flex flex-col text-foreground selection:bg-primary/30">
      <main className="flex-1 w-full pt-10 pb-20 relative z-10">
        {children}
      </main>
      <div className="border-t">
        <Footer locale={locale} />
      </div>
    </div>
  );
}
