import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Search, ShieldCheck } from 'lucide-react';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-2xl font-black text-blue-900 tracking-tighter">LawFinder SL</div>
          <nav className="flex items-center gap-6">
            <Link href={`/${locale}/lawyers`} className="font-medium text-gray-600 hover:text-blue-600 transition-colors">Directory</Link>
            <Link href={`/${locale}/login`} className="font-bold text-white px-5 py-2.5 bg-blue-600 shadow-md shadow-blue-500/20 rounded-lg hover:bg-blue-700 transition-colors">Login / Register</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="bg-gradient-to-br from-blue-950 to-blue-900 text-white py-28 px-6 relative overflow-hidden">
          {/* Subtle background glow effect using Tailwind */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
              {t('HomePage.title', { fallback: 'Find the Right Lawyer in Sri Lanka' })}
            </h1>
            <p className="text-xl md:text-2xl text-blue-100/80 mb-12 max-w-2xl mx-auto font-light">
              {t('HomePage.subtitle', { fallback: 'Expert legal assistance. Verified attorneys. Book consultations instantly.' })}
            </p>
            
            {/* Search Box */}
            <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl flex max-w-3xl mx-auto border border-white/20 focus-within:ring-4 ring-blue-500/50 transition-all shadow-2xl">
              <input 
                type="text" 
                placeholder={t('HomePage.searchPlaceholder', { fallback: 'Search by practice area or district...' })}
                className="flex-1 px-6 py-4 text-white placeholder:text-blue-100 bg-transparent text-lg outline-none"
              />
              <button className="bg-blue-600 hover:bg-blue-500 transition-colors px-10 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg">
                <Search className="w-5 h-5" />
                {t('HomePage.searchButton', { fallback: 'Find Lawyers' })}
              </button>
            </div>
          </div>
        </section>

        {/* Value Proposition */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center hover:shadow-xl transition-shadow cursor-default">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900 tracking-tight">Verified Professionals</h3>
              <p className="text-gray-500 text-center text-lg leading-relaxed">Every lawyer is rigorously verified against the Bar Association of Sri Lanka (BASL) registry.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
