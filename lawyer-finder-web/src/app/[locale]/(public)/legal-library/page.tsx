'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { LegalDisclaimer } from '@/components/shared/LegalDisclaimer';
import {
  BookOpen, Search, Scale, Gavel, FileText, Scroll,
  ChevronRight, Calendar, Filter, X, ArrowRight
} from 'lucide-react';

interface LegalDocument {
  id: string;
  title: string;
  category: string;
  categoryDisplay: string;
  description: string | null;
  actNumber: string | null;
  year: number | null;
  courtName: string | null;
  caseNumber: string | null;
  gazetteNumber: string | null;
  pageCount: number | null;
  chunksCount: number;
  createdAt: string;
}

interface Category {
  value: string;
  label: string;
  count: number;
}

const CATEGORY_ICONS: Record<string, any> = {
  'SRI_LANKA_LAW_REPORTS': Scale,
  'ACTS_AND_ORDINANCES': BookOpen,
  'AMENDMENT_ACTS': FileText,
  'GAZETTE_NOTIFICATIONS': Scroll,
  'SUPREME_COURT_DECISIONS': Gavel,
  'COURT_OF_APPEAL_DECISIONS': Gavel,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; hoverBorder: string }> = {
  'SRI_LANKA_LAW_REPORTS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/10', hoverBorder: 'hover:border-[#bfa37a]/40' },
  'ACTS_AND_ORDINANCES': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/10', hoverBorder: 'hover:border-[#bfa37a]/40' },
  'AMENDMENT_ACTS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/10', hoverBorder: 'hover:border-[#bfa37a]/40' },
  'GAZETTE_NOTIFICATIONS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/10', hoverBorder: 'hover:border-[#bfa37a]/40' },
  'SUPREME_COURT_DECISIONS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/10', hoverBorder: 'hover:border-[#bfa37a]/40' },
  'COURT_OF_APPEAL_DECISIONS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/10', hoverBorder: 'hover:border-[#bfa37a]/40' },
};

export default function LegalLibraryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.set('search', search);
      if (selectedCategory) queryParams.set('category', selectedCategory);
      queryParams.set('page', page.toString());
      queryParams.set('limit', '12');

      const res = await fetch(`/api/legal-documents?${queryParams}`);
      const data = await res.json();

      setDocuments(data.documents || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setCategories(data.categories || []);
    } catch {
      console.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [page, selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  const handleCategoryClick = (categoryValue: string) => {
    setSelectedCategory(prev => prev === categoryValue ? '' : categoryValue);
    setPage(1);
  };

  const totalDocsCount = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="min-h-screen bg-white selection:bg-[#bfa37a]/30">
      {/* 1. Premium White Hero / Search Header */}
      <section className="relative bg-white pt-12 pb-16 px-6 lg:px-12 xl:px-24 overflow-hidden border-b border-neutral-100">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left info column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#faf6f0] border border-[#bfa37a]/20 rounded-none mb-2">
              <Scale className="w-4 h-4 text-[#bfa37a]" />
              <span className="text-[10px] text-[#bfa37a] font-bold uppercase tracking-widest">Sri Lankan Legal Knowledge Base</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-serif text-neutral-900 leading-[1.15] tracking-tight">
              Sri Lankan <br />
              <span className="text-[#bfa37a]">Legal Document</span> Library
            </h1>

            <p className="text-neutral-500 text-sm sm:text-base max-w-xl font-light leading-relaxed">
              Explore Sri Lankan Acts, Ordinances, Case Law, and Gazette Notifications — cataloged and structured by our AI knowledge graph for high-precision semantic search.
            </p>

            <LegalDisclaimer variant="library" className="max-w-xl" />

            {/* Embedded Search styled to match home page */}
            <form onSubmit={handleSearch} className="pt-2 w-full max-w-[580px]">
              <div className="w-full relative shadow-sm border border-neutral-200 focus-within:border-[#bfa37a] focus-within:shadow-[0_0_15px_rgba(191,163,122,0.15)] transition-all p-1.5 flex items-center bg-white">
                <div className="pl-4 pr-1 text-neutral-400 shrink-0">
                  <Search className="w-4 h-4 text-[#bfa37a]" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search acts, ordinances, court decisions..."
                  className="w-full bg-transparent text-neutral-800 text-sm outline-none px-3 font-light"
                />
                <button
                  type="submit"
                  className="group bg-[#bfa37a] text-white hover:bg-[#a68d67] text-xs font-bold uppercase tracking-widest px-6 py-3.5 rounded-none transition-all shrink-0 flex items-center gap-1.5"
                >
                  Search
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </form>
          </div>

          {/* Right column - Graphic layout */}
          <div className="lg:col-span-5 hidden lg:flex justify-end pr-6">
            <div className="border border-neutral-200/80 p-8 w-80 relative bg-neutral-50/50">
              <div className="absolute top-0 right-0 w-3 h-3 bg-[#bfa37a]" />
              <h3 className="font-serif text-lg text-neutral-900 mb-4">Library Stats</h3>
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Total Indexed</span>
                  <p className="text-3xl font-serif text-neutral-800">{totalDocsCount}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Categories</span>
                  <p className="text-3xl font-serif text-neutral-800">{categories.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Content Grid */}
      <section className="bg-neutral-50/30 py-16 px-6 lg:px-12 xl:px-24">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
          
          {/* Left Column: Documents Feed */}
          <div className="space-y-8">
            {/* Active Filter Badge */}
            {selectedCategory && (
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Filtered by:</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#faf6f0] text-[#bfa37a] text-xs font-bold uppercase tracking-widest border border-[#bfa37a]/20">
                  {categories.find(c => c.value === selectedCategory)?.label}
                  <button onClick={() => setSelectedCategory('')} className="hover:text-[#a68d67] ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            )}

            {/* Documents Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-56 bg-white border border-neutral-100 animate-pulse" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-20 bg-white border border-neutral-100 p-8 flex flex-col items-center justify-center">
                <BookOpen className="w-12 h-12 text-[#bfa37a] stroke-[1] mb-4" />
                <h3 className="font-serif text-lg text-neutral-800">No documents found</h3>
                <p className="text-xs text-neutral-400 font-light mt-1 max-w-xs">
                  {search ? 'Try adjusting your search query or removing filters.' : 'Check back later for newly uploaded acts or reports.'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {documents.map((doc) => {
                    const colors = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS['ACTS_AND_ORDINANCES'];
                    const Icon = CATEGORY_ICONS[doc.category] || FileText;

                    return (
                      <Link
                        key={doc.id}
                        href={`/${locale}/legal-library/${doc.id}`}
                        className="group relative bg-white border border-neutral-200/60 p-6 hover:shadow-xl hover:border-[#bfa37a]/30 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-full min-h-[16rem] text-neutral-950 overflow-hidden"
                      >
                        {/* Decorative Top Accent */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#bfa37a]/20 via-[#bfa37a] to-[#bfa37a]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        <div className="space-y-5 flex-1">
                          {/* Header: Category & Year */}
                          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[#bfa37a] bg-[#faf6f0] rounded-sm">
                              <Icon className="w-3 h-3" />
                              {doc.categoryDisplay}
                            </span>
                            {doc.year && (
                              <span className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-bold uppercase tracking-wider bg-neutral-50 px-2 py-1 rounded-sm">
                                <Calendar className="w-3 h-3 text-neutral-400" />
                                {doc.year}
                              </span>
                            )}
                          </div>

                          {/* Title Area */}
                          <div className="space-y-2">
                            <h3 className="font-serif text-lg font-bold text-neutral-900 group-hover:text-[#bfa37a] transition-colors leading-snug line-clamp-3">
                              {doc.title}
                            </h3>
                            <p className="text-neutral-500 text-xs font-light line-clamp-2 leading-relaxed">
                              {doc.description || 'Click to read the full document and view its details.'}
                            </p>
                          </div>
                        </div>

                        {/* Card Footer: Metadata & Link */}
                        <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col gap-3">
                          {/* Document specific identifiers */}
                          {(doc.actNumber || doc.courtName || doc.caseNumber) && (
                            <div className="flex flex-wrap gap-2 text-[10px] text-neutral-500 font-medium uppercase tracking-wider bg-neutral-50/80 p-2.5 rounded-sm">
                              {doc.actNumber && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-neutral-400">Act:</span> {doc.actNumber}
                                </span>
                              )}
                              {doc.courtName && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-neutral-400">Court:</span> <span className="truncate max-w-[120px]">{doc.courtName}</span>
                                </span>
                              )}
                              {doc.caseNumber && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-neutral-400">Case:</span> {doc.caseNumber}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Action row */}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-neutral-400 font-light flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500/80"></span>
                              Added {new Date(doc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a] flex items-center gap-1 group-hover:gap-2 transition-all">
                              Read
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-6">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-6 py-3 border border-neutral-200 text-xs font-bold uppercase tracking-widest text-neutral-700 disabled:opacity-50 hover:bg-neutral-50 transition rounded-none"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-6 py-3 border border-neutral-200 text-xs font-bold uppercase tracking-widest text-neutral-700 disabled:opacity-50 hover:bg-neutral-50 transition rounded-none"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column: Categories Sidebar */}
          <div className="space-y-6">
            <div className="border-b border-neutral-200 pb-4 sticky top-6">
              <span className="text-[10px] text-[#bfa37a] uppercase tracking-[0.2em] font-bold">Classifications</span>
              <h2 className="text-xl font-serif text-neutral-900 mt-1">Browse by Category</h2>
            </div>

            <div className="flex flex-col gap-3 sticky top-[5.5rem]">
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.value] || FileText;
                const isActive = selectedCategory === cat.value;

                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategoryClick(cat.value)}
                    className={`group text-left p-4 bg-white border transition-all duration-300 flex items-center justify-between ${
                      isActive 
                        ? 'border-[#bfa37a] bg-[#faf6f0]/20 shadow-md' 
                        : 'border-neutral-200/60 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 transition-colors duration-300 ${isActive ? 'bg-[#bfa37a] text-white' : 'bg-[#faf6f0] text-[#bfa37a]'}`}>
                        <Icon className="w-4 h-4 stroke-[1.5]" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-[11px] font-serif font-bold text-neutral-900 uppercase tracking-wider line-clamp-1">{cat.label}</h3>
                        <p className="text-[10px] text-neutral-400 font-light">
                          {cat.count} document{cat.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'text-[#bfa37a]' : 'text-neutral-300 group-hover:text-[#bfa37a] group-hover:translate-x-1'}`} />
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
