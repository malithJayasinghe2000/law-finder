import { getTranslations } from 'next-intl/server';
import prisma from '@/lib/db';

export default async function LawyerDirectory({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'HomePage' });

  // Example SSR Execution (Safely queries Postgres BEFORE rendering HTML to browser)
  // const verifiedLawyers = await prisma.lawyerProfile.findMany({ where: { isVerified: true } });

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6 w-full mt-10">
      <h1 className="text-4xl font-extrabold text-center mb-4 tracking-tight text-gray-900">
        {t('directory')}
      </h1>
      <p className="text-center text-gray-500 mb-10 max-w-2xl mx-auto">
        Search our verified database of Sri Lankan legal professionals by practice area, language, and district.
      </p>
      
      {/* Search & Filter Bar */}
      <div className="relative mb-12 shadow-sm rounded-xl overflow-hidden max-w-3xl mx-auto w-full">
        <input 
          type="text" 
          placeholder={t('searchPlaceholder')}
          className="w-full p-5 pl-6 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg" 
        />
        <button className="absolute right-3 top-3 bottom-3 px-8 bg-black hover:bg-gray-800 transition-colors text-white rounded-lg font-medium">
          {t('searchButton')}
        </button>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         {/* Placeholder Card */}
         <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col items-center justify-center text-gray-500 h-72">
           Loading Lawyer Profiles from PostgreSQL...
         </div>
         <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col items-center justify-center text-gray-500 h-72">
           Loading Lawyer Profiles from PostgreSQL...
         </div>
         <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col items-center justify-center text-gray-500 h-72">
           Loading Lawyer Profiles from PostgreSQL...
         </div>
      </div>
    </div>
  );
}
