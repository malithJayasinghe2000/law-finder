'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, BookOpen, Scale, Gavel, FileText, Scroll,
  Calendar, Hash, Building2, MessageSquare, GitBranch,
  ChevronRight, ArrowRight
} from 'lucide-react';

interface DocumentDetail {
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

interface RelatedDoc {
  id: string;
  title: string;
  category: string;
  categoryDisplay: string;
  year: number | null;
  actNumber: string | null;
}

interface GraphEntity {
  id: string;
  name: string;
  type: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  'SRI_LANKA_LAW_REPORTS': Scale,
  'ACTS_AND_ORDINANCES': BookOpen,
  'AMENDMENT_ACTS': FileText,
  'GAZETTE_NOTIFICATIONS': Scroll,
  'SUPREME_COURT_DECISIONS': Gavel,
  'COURT_OF_APPEAL_DECISIONS': Gavel,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'SRI_LANKA_LAW_REPORTS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/15' },
  'ACTS_AND_ORDINANCES': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/15' },
  'AMENDMENT_ACTS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/15' },
  'GAZETTE_NOTIFICATIONS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/15' },
  'SUPREME_COURT_DECISIONS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/15' },
  'COURT_OF_APPEAL_DECISIONS': { bg: 'bg-[#faf6f0]', text: 'text-[#bfa37a]', border: 'border-[#bfa37a]/15' },
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  'ACT': 'border border-[#bfa37a]/20 bg-[#faf6f0] text-[#bfa37a]',
  'SECTION': 'border border-neutral-200 bg-neutral-50 text-neutral-800',
  'COURT': 'border border-[#bfa37a]/20 bg-[#faf6f0] text-[#bfa37a]',
  'LEGAL_CONCEPT': 'border border-neutral-200 bg-neutral-50 text-neutral-850',
  'CASE_LAW': 'border border-neutral-200 bg-neutral-50 text-neutral-850',
  'GAZETTE': 'border border-neutral-200 bg-neutral-50 text-neutral-800',
};

export default function DocumentDetailPage() {
  const params = useParams();
  const locale = params.locale as string;
  const docId = params.id as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDoc[]>([]);
  const [graphEntities, setGraphEntities] = useState<GraphEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`/api/legal-documents/${docId}`);
        if (!res.ok) {
          setError('Document not found');
          return;
        }
        const data = await res.json();
        setDocument(data.document);
        setRelatedDocuments(data.relatedDocuments || []);
        setGraphEntities(data.graphEntities || []);
      } catch {
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [docId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-24">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
          <div className="h-8 w-48 bg-neutral-100 animate-pulse" />
          <div className="h-64 bg-white border border-neutral-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center pt-24">
        <div className="text-center space-y-4">
          <BookOpen className="w-12 h-12 text-[#bfa37a] stroke-[1] mx-auto" />
          <h2 className="font-serif text-xl text-neutral-800">{error || 'Document not found'}</h2>
          <Link
            href={`/${locale}/legal-library`}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#bfa37a] hover:text-[#a68d67] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const colors = CATEGORY_COLORS[document.category] || CATEGORY_COLORS['ACTS_AND_ORDINANCES'];
  const Icon = CATEGORY_ICONS[document.category] || FileText;

  return (
    <div className="min-h-screen bg-white selection:bg-[#bfa37a]/30 pt-24">
      {/* Breadcrumb Navigation */}
      <div className="bg-neutral-50/50 border-b border-neutral-100">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
            <Link href={`/${locale}/legal-library`} className="hover:text-neutral-900 transition">
              Legal Library
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
            <span className="text-neutral-800 truncate max-w-[240px]">{document.title}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Document Main Block */}
        <div className="mb-12 space-y-6">
          {/* Category Tag */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-none border ${colors.bg} ${colors.text} ${colors.border}`}>
            <Icon className="w-3.5 h-3.5" />
            {document.categoryDisplay}
          </span>

          <h1 className="text-3xl md:text-4xl font-serif text-neutral-900 leading-tight uppercase tracking-tight">
            {document.title}
          </h1>

          {document.description && (
            <p className="text-neutral-500 text-sm font-light leading-relaxed">{document.description}</p>
          )}

          {/* Document Metadata grid list */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4 border-t border-neutral-100">
            {document.year && (
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Year of Origin</span>
                <p className="text-sm font-serif font-bold text-neutral-800">{document.year}</p>
              </div>
            )}
            {document.actNumber && (
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Act Number</span>
                <p className="text-sm font-serif font-bold text-neutral-800">{document.actNumber}</p>
              </div>
            )}
            {document.courtName && (
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Court System</span>
                <p className="text-sm font-serif font-bold text-neutral-800">{document.courtName}</p>
              </div>
            )}
            {document.caseNumber && (
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Case Reference</span>
                <p className="text-sm font-serif font-bold text-neutral-800">{document.caseNumber}</p>
              </div>
            )}
            {document.gazetteNumber && (
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Gazette Number</span>
                <p className="text-sm font-serif font-bold text-neutral-800">{document.gazetteNumber}</p>
              </div>
            )}
            {document.pageCount && (
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Length</span>
                <p className="text-sm font-serif font-bold text-neutral-800">{document.pageCount} Pages</p>
              </div>
            )}
          </div>
        </div>

        {/* Ask AI CTA section - styled like Charcoal/Gold homepage section */}
        <div className="bg-[#161616] text-white p-8 rounded-none border border-neutral-800 relative overflow-hidden mb-12">
          <div className="absolute top-0 right-0 w-3 h-3 bg-[#bfa37a]" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <span className="text-[10px] text-[#bfa37a] uppercase tracking-widest font-bold">RAG Retrieval Enabled</span>
              <h3 className="text-xl font-serif text-white">Perform AI Inquiries on this Document</h3>
              <p className="text-neutral-400 text-xs font-light max-w-xl leading-relaxed">
                Connect directly with our AI consultation engine to extract concepts, query section contexts, or verify conditions mentioned in this document.
              </p>
            </div>
            <Link href={`/${locale}/chat`}>
              <button className="bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap">
                Ask AI Assistant
              </button>
            </Link>
          </div>
        </div>

        {/* Knowledge Graph Entities Block */}
        {graphEntities.length > 0 && (
          <div className="border border-neutral-200/80 p-8 rounded-none mb-8 bg-neutral-50/50 relative">
            <div className="absolute top-0 right-0 w-2 h-2 bg-[#bfa37a]" />
            <h3 className="text-xs font-serif font-bold text-neutral-900 uppercase tracking-widest flex items-center gap-2 mb-6">
              <GitBranch className="w-4 h-4 text-[#bfa37a]" />
              Knowledge Graph Entities
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {graphEntities.map((entity, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center px-3.5 py-2 text-xs font-medium tracking-tight rounded-none ${ENTITY_TYPE_COLORS[entity.type] || 'border border-neutral-200 bg-neutral-50 text-neutral-800'}`}
                >
                  <span className="opacity-50 font-bold mr-1.5 text-[9px] uppercase tracking-wider">{entity.type}</span>
                  {entity.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related Documents list */}
        {relatedDocuments.length > 0 && (
          <div className="border border-neutral-200/80 p-8 rounded-none bg-neutral-50/20">
            <h3 className="text-xs font-serif font-bold text-neutral-900 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Scale className="w-4 h-4 text-[#bfa37a]" />
              Graph Related Documents
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {relatedDocuments.map((rel) => {
                const RelIcon = CATEGORY_ICONS[rel.category] || FileText;

                return (
                  <Link
                    key={rel.id}
                    href={`/${locale}/legal-library/${rel.id}`}
                    className="group p-5 bg-white border border-neutral-200/80 hover:shadow-xl hover:border-[#bfa37a]/30 transition-all duration-500 flex flex-col justify-between h-40 text-neutral-950"
                  >
                    <div className="space-y-3">
                      <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-[#bfa37a]">
                        <RelIcon className="w-3 h-3" />
                        {rel.categoryDisplay}
                      </span>
                      <h4 className="font-serif text-sm font-bold text-neutral-900 group-hover:text-[#bfa37a] transition-colors leading-snug line-clamp-2 uppercase tracking-tight">
                        {rel.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-2">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase">
                        {rel.year ? `Year: ${rel.year}` : (rel.actNumber ? `Act: ${rel.actNumber}` : 'Document')}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#bfa37a] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Read
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-12 flex justify-center">
          <Link
            href={`/${locale}/legal-library`}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Legal Library
          </Link>
        </div>
      </div>
    </div>
  );
}
