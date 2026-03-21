import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function BlogListingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  
  return (
    <div className="min-h-screen bg-gray-50 py-20 px-6">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h1 className="text-5xl font-black mb-6 text-blue-950">Legal Insights</h1>
        <p className="text-xl text-gray-500">Blogs, experiences, and advice from verified Sri Lankan lawyers.</p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        <div className="p-1 border rounded-3xl bg-white shadow-sm hover:shadow-xl transition-all group overflow-hidden">
          <div className="h-48 bg-gray-100 rounded-2xl m-2 group-hover:scale-105 transition-transform"></div>
          <div className="p-6">
            <span className="text-blue-600 font-bold text-sm uppercase tracking-widest">Property Law</span>
            <h3 className="text-2xl font-bold mt-2 hover:text-blue-900 transition-colors">Buying your first land in Sri Lanka? Read this.</h3>
            <p className="text-gray-500 mt-4 line-clamp-2">Learn about the necessary documents and legal checks before you sign any agreements...</p>
            <div className="mt-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 italic flex items-center justify-center text-xs">AV</div>
              <div>
                <p className="font-bold text-sm">Lawyer Name</p>
                <p className="text-xs text-gray-400 font-medium">May 21, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
