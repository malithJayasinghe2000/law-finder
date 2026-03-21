import { getTranslations } from 'next-intl/server';
import { ShieldCheck, MapPin, Languages } from 'lucide-react';

export default async function LawyerProfilePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'HomePage' });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Header */}
      <div className="bg-blue-900 h-48 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-transparent"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-48 h-48 rounded-full border-8 border-white bg-gray-200 shadow-xl overflow-hidden">
           <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
             Photo
           </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-32 px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold flex items-center justify-center gap-3">
             Lawyer Full Name
             <ShieldCheck className="text-blue-500 w-8 h-8" />
          </h1>
          <p className="text-lg text-gray-500 font-medium">Senior Defense Attorney | Colombo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="flex flex-col items-center p-6 bg-white rounded-2xl border shadow-sm">
            <MapPin className="text-blue-600 mb-2" />
            <span className="font-bold">District</span>
            <span className="text-gray-500">Colombo</span>
          </div>
          <div className="flex flex-col items-center p-6 bg-white rounded-2xl border shadow-sm">
            <Languages className="text-blue-600 mb-2" />
            <span className="font-bold">Languages</span>
            <span className="text-gray-500">Sinhala, Tamil, English</span>
          </div>
          <div className="flex flex-col items-center p-6 bg-white rounded-2xl border shadow-sm">
             <span className="text-blue-600 font-black mb-1">LKR</span>
             <span className="font-bold">Fee Range</span>
             <span className="text-gray-500">$$$ Mid Range</span>
          </div>
        </div>

        <div className="bg-white p-10 rounded-3xl border shadow-sm">
          <h2 className="text-2xl font-bold mb-6">About & Experience</h2>
          <p className="text-gray-600 leading-relaxed text-lg">
             This legal professional has not yet provided their full biography. They are verified as a practicing attorney in Sri Lanka with registration #BASL-{id}.
          </p>
          
          <div className="mt-10 pt-10 border-t flex justify-center">
             <button className="bg-blue-600 text-white font-bold py-4 px-12 rounded-2xl text-xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all">
               {t('inquireNow', { fallback: 'Inquire Now' })}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
