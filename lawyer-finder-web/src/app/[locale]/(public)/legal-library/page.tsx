'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { LegalDisclaimer } from '@/components/shared/LegalDisclaimer';
import { TypeIcon } from '@/components/legal-library/TypeIcon';
import {
  BookOpen, Search, Scale, FileText, ChevronRight, Calendar, Filter, X, ArrowRight, History, Hourglass
} from 'lucide-react';

interface LegalDocument {
  id: string;
  title: string;
  category: string;
  categoryDisplay: string;
  status: 'ACTIVE' | 'AWAITING_ORIGINAL';
  description: string | null;
  actNumber: string | null;
  year: number | null;
  consolidatedToYear: number | null;
  courtName: string | null;
  caseNumber: string | null;
  sourceName: string | null;
  amends: { id: string; title: string } | null;
  amendmentCount: number;
  lastAmendedYear: number | null;
}

interface Facet {
  value: string;
  label: string;
  count: number;
}

export default function LegalLibraryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [categories, setCategories] = useState<Facet[]>([]);
  const [subjects, setSubjects] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setFailed(false);
      const queryParams = new URLSearchParams();
      if (search) queryParams.set('search', search);
      if (selectedCategory) queryParams.set('category', selectedCategory);
      if (selectedSubject) queryParams.set('subject', selectedSubject);
      queryParams.set('page', page.toString());
      queryParams.set('limit', '12');

      const res = await fetch(`/api/legal-documents?${queryParams}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      setDocuments(data.documents || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setCategories(data.categories || []);
      setSubjects(data.subjects || []);
    } catch {
      // A failed load is not an empty library: say which it is.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedCategory, selectedSubject]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  const toggleCategory = (value: string) => {
    setSelectedCategory((prev) => (prev === value ? '' : value));
    setPage(1);
  };
  const toggleSubject = (value: string) => {
    setSelectedSubject((prev) => (prev === value ? '' : value));
    setPage(1);
  };

  const totalLaws = categories.reduce((sum, c) => sum + c.count, 0);
  // Only kinds the library holds are offered; an empty filter is a dead end.
  const shownCategories = categories.filter((c) => c.count > 0 || c.value === selectedCategory);
  const shownSubjects = subjects.filter((s) => s.count > 0 || s.value === selectedSubject);

  return (
    <div className="min-h-screen bg-white selection:bg-[#bfa37a]/30">
      {/* 1. Hero / search */}
      <section className="relative bg-white pt-12 pb-16 overflow-hidden border-b border-neutral-100">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-24 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
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
              Sri Lankan laws from official sources. Each law shows the Acts that amended it, where its
              text came from, and when it was last checked.
            </p>

            <LegalDisclaimer variant="library" className="max-w-xl" />

            <form onSubmit={handleSearch} className="pt-2 w-full max-w-[580px]">
              <div className="w-full relative shadow-sm border border-neutral-200 focus-within:border-[#bfa37a] focus-within:shadow-[0_0_15px_rgba(191,163,122,0.15)] transition-all p-1.5 flex items-center bg-white">
                <div className="pl-3 sm:pl-4 pr-1 text-neutral-400 shrink-0">
                  <Search className="w-4 h-4 text-[#bfa37a]" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or number, e.g. Penal Code"
                  aria-label="Search the library by name or Act number"
                  className="w-full bg-transparent text-neutral-800 text-sm outline-none px-3 font-light"
                />
                <button
                  type="submit"
                  className="group bg-[#bfa37a] text-white hover:bg-[#a68d67] text-xs font-bold uppercase tracking-widest px-4 sm:px-6 py-3.5 rounded-none transition-all shrink-0 flex items-center gap-1.5"
                >
                  Search
                  <ArrowRight className="hidden sm:block w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5 hidden lg:flex justify-end">
            <div className="border border-neutral-200/80 p-8 w-80 relative bg-neutral-50/50">
              <div className="absolute top-0 right-0 w-3 h-3 bg-[#bfa37a]" />
              <h3 className="font-serif text-lg text-neutral-900 mb-4">Library Stats</h3>
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Laws & Documents</span>
                  <p className="text-3xl font-serif text-neutral-800">{totalLaws}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Kinds</span>
                  <p className="text-3xl font-serif text-neutral-800">{categories.filter((c) => c.count > 0).length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Results and filters */}
      <section className="bg-neutral-50/30 py-16">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 xl:px-24 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">

          <div className="space-y-8 min-w-0">
            {/* Subjects */}
            {shownSubjects.length > 0 && (
              <div className="space-y-3">
                <span className="text-[10px] text-[#bfa37a] uppercase tracking-[0.2em] font-bold">By subject</span>
                <div className="flex flex-wrap gap-2">
                  {shownSubjects.map((s) => {
                    const active = selectedSubject === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => toggleSubject(s.value)}
                        aria-pressed={active}
                        className={`px-3 py-1.5 text-xs border transition-colors ${
                          active
                            ? 'border-[#bfa37a] bg-[#bfa37a] text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-[#bfa37a]/50'
                        }`}
                      >
                        {s.label} <span className={active ? 'text-white/80' : 'text-neutral-400'}>{s.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(selectedCategory || selectedSubject) && (
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Filtered by:</span>
                {selectedCategory && (
                  <FilterChip label={categories.find((c) => c.value === selectedCategory)?.label} onClear={() => toggleCategory(selectedCategory)} />
                )}
                {selectedSubject && (
                  <FilterChip label={subjects.find((s) => s.value === selectedSubject)?.label} onClear={() => toggleSubject(selectedSubject)} />
                )}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-56 bg-white border border-neutral-100 animate-pulse" />
                ))}
              </div>
            ) : failed ? (
              <div className="text-center py-20 bg-white border border-neutral-100 p-8 flex flex-col items-center justify-center">
                <BookOpen className="w-12 h-12 text-[#bfa37a] stroke-[1] mb-4" />
                <h3 className="font-serif text-lg text-neutral-800">The library could not be loaded</h3>
                <p className="text-xs text-neutral-400 font-light mt-1 max-w-xs">Please try again in a moment.</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-20 bg-white border border-neutral-100 p-8 flex flex-col items-center justify-center">
                <BookOpen className="w-12 h-12 text-[#bfa37a] stroke-[1] mb-4" />
                <h3 className="font-serif text-lg text-neutral-800">No documents found</h3>
                <p className="text-xs text-neutral-400 font-light mt-1 max-w-xs">
                  {search || selectedCategory || selectedSubject ? 'Try another search or remove a filter.' : 'Check back later for newly added laws.'}
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-neutral-500">{total} result{total === 1 ? '' : 's'}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {documents.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} locale={locale} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-6">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-6 py-3 border border-neutral-200 text-xs font-bold uppercase tracking-widest text-neutral-700 disabled:opacity-50 hover:bg-neutral-50 transition rounded-none"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

          {/* Kinds of document */}
          <div className="space-y-6">
            <div className="border-b border-neutral-200 pb-4">
              <span className="text-[10px] text-[#bfa37a] uppercase tracking-[0.2em] font-bold">Kinds of document</span>
              <h2 className="text-xl font-serif text-neutral-900 mt-1">Browse by Type</h2>
            </div>

            <div className="flex flex-col gap-3 lg:sticky lg:top-[5.5rem]">
              {shownCategories.map((cat) => {
                const isActive = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => toggleCategory(cat.value)}
                    aria-pressed={isActive}
                    className={`group text-left p-4 bg-white border transition-all duration-300 flex items-center justify-between ${
                      isActive ? 'border-[#bfa37a] bg-[#faf6f0]/20 shadow-md' : 'border-neutral-200/60 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 transition-colors duration-300 ${isActive ? 'bg-[#bfa37a] text-white' : 'bg-[#faf6f0] text-[#bfa37a]'}`}>
                        <TypeIcon type={cat.value} className="w-4 h-4 stroke-[1.5]" />
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

function FilterChip({ label, onClear }: { label?: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#faf6f0] text-[#bfa37a] text-xs font-bold uppercase tracking-widest border border-[#bfa37a]/20">
      {label}
      <button onClick={onClear} aria-label={`Remove filter ${label ?? ''}`} className="hover:text-[#a68d67] ml-1">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function DocumentCard({ doc, locale }: { doc: LegalDocument; locale: string }) {
  const awaiting = doc.status === 'AWAITING_ORIGINAL';
  return (
    <Link
      href={`/${locale}/legal-library/${doc.id}`}
      className="group relative bg-white border border-neutral-200/60 p-6 hover:shadow-xl hover:border-[#bfa37a]/30 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-full text-neutral-950 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#bfa37a]/20 via-[#bfa37a] to-[#bfa37a]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="space-y-5 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[#bfa37a] bg-[#faf6f0] rounded-sm">
            <TypeIcon type={doc.category} className="w-3 h-3" />
            {doc.categoryDisplay}
          </span>
          {doc.consolidatedToYear ? (
            <span className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-bold uppercase tracking-wider bg-neutral-50 px-2 py-1 rounded-sm">
              <Calendar className="w-3 h-3 text-neutral-400" />
              Consolidated to {doc.consolidatedToYear}
            </span>
          ) : doc.year ? (
            <span className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-bold uppercase tracking-wider bg-neutral-50 px-2 py-1 rounded-sm">
              <Calendar className="w-3 h-3 text-neutral-400" />
              {doc.year}
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="font-serif text-lg font-bold text-neutral-900 group-hover:text-[#bfa37a] transition-colors leading-snug line-clamp-3">
            {doc.title}
          </h3>
          {doc.amends && <p className="text-xs text-neutral-500">Amends the {doc.amends.title}</p>}
          {doc.description && (
            <p className="text-neutral-500 text-xs font-light line-clamp-2 leading-relaxed">{doc.description}</p>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col gap-3">
        {(awaiting || doc.amendmentCount > 0) && (
          <div className="flex flex-col gap-1.5 text-[11px] text-neutral-600">
            {awaiting && (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <Hourglass className="w-3.5 h-3.5" /> Original text: being added
              </span>
            )}
            {doc.amendmentCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#bfa37a]" />
                {doc.amendmentCount} amendment{doc.amendmentCount === 1 ? '' : 's'}
                {doc.lastAmendedYear ? ` · last amended ${doc.lastAmendedYear}` : ''}
              </span>
            )}
          </div>
        )}

        {(doc.actNumber || doc.courtName || doc.caseNumber) && (
          <div className="flex flex-wrap gap-2 text-[10px] text-neutral-500 font-medium uppercase tracking-wider bg-neutral-50/80 p-2.5 rounded-sm">
            {doc.actNumber && (
              <span className="inline-flex items-center gap-1">
                <span className="text-neutral-400">No.</span> {doc.actNumber.replace(/^No\.\s*/i, '')}
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

        <div className="flex items-center justify-between gap-3 mt-1">
          <span className="text-[10px] text-neutral-400 font-light flex items-center gap-1.5 min-w-0">
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate">{doc.sourceName ? `Source: ${doc.sourceName}` : 'Source not recorded'}</span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a] flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">
            Read
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
