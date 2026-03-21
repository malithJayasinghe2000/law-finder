export default async function ArticlePage({ params }: { params: Promise<{ locale: string, slug: string }> }) {
  const { locale, slug } = await params;

  return (
    <div className="min-h-screen bg-white py-20 px-6">
      <article className="max-w-3xl mx-auto">
        <header className="mb-12">
          <span className="text-blue-600 font-black tracking-widest text-sm uppercase mb-4 block">Education & Awareness</span>
          <h1 className="text-5xl font-black leading-tight text-gray-900 mb-8 tracking-tight">Understanding Legal Processes: {slug.replace(/-/g, ' ')}</h1>
          
          <div className="flex items-center gap-6 border-y py-6">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center font-bold text-blue-600">LP</div>
            <div>
              <p className="font-extrabold text-lg">Author Name</p>
              <p className="text-gray-500 font-medium italic text-sm">Verified Legal Practitioner | Sri Lanka</p>
            </div>
          </div>
        </header>

        <div className="prose prose-xl prose-blue max-w-none text-gray-700 leading-relaxed font-light">
          <p className="mb-8">
             Legal processes in Sri Lanka can be intricate. This article aims to break down the complexities of <strong>{slug}</strong> for the general public.
          </p>
          <div className="p-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-center my-12 italic text-gray-400 font-medium text-lg">
             Detailed legal article content is coming soon as part of the Phase 3 Blog Module execution. 
             Stay tuned for expert legal insights!
          </div>
        </div>

        <footer className="mt-20 pt-10 border-t flex flex-col items-center">
           <h3 className="text-xl font-bold mb-6">Have more questions?</h3>
           <button className="bg-black text-white font-black px-12 py-5 rounded-2xl text-lg hover:scale-105 active:scale-95 transition-all">
             Contact the Author
           </button>
        </footer>
      </article>
    </div>
  );
}
