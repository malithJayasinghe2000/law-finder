'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Download, FileText, ExternalLink, Compass, History, Hourglass, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LegalDisclaimer } from '@/components/shared/LegalDisclaimer';

interface DocumentDetail {
  id: string;
  title: string;
  category: string;
  categoryDisplay: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  year: number | null;
  consolidatedToYear: number | null;
  actNumber: string | null;
  status: 'ACTIVE' | 'AWAITING_ORIGINAL';
  sourceName: string | null;
  sourceUrl: string | null;
  lastCheckedAt: string | null;
  amends: { id: string; title: string } | null;
  amendments: Amendment[];
  fileAvailable: boolean;
  outline?: OutlineItem[] | null;
}

interface Amendment {
  id: string;
  title: string;
  actNumber: string | null;
  year: number | null;
  sourceUrl: string | null;
  status: 'ACTIVE' | 'AWAITING_ORIGINAL';
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

interface OutlineItem {
  title: string;
  page: number;
  summary: string;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const locale = params.locale as string;
  const docId = params.id as string;

  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  // Fetch document details
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`/api/legal-documents/${docId}`);
        if (!res.ok) {
          setError('Document not found');
          return;
        }
        const data = await res.json();
        setDocumentDetail(data.document);
        
        // An outline is shown only when the document has a real one. There
        // used to be a made-up fallback (invented chapters and page numbers).
        if (Array.isArray(data.document?.outline) && data.document.outline.length > 0) {
          setOutline(data.document.outline);
        }
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
      <div className="min-h-screen bg-white pt-32">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="h-6 w-32 bg-neutral-100 animate-pulse" />
          <div className="h-10 w-96 bg-neutral-100 animate-pulse" />
          <div className="h-[600px] bg-neutral-50 border border-neutral-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !documentDetail) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center pt-32">
        <div className="text-center space-y-4">
          <FileText className="w-12 h-12 text-[#bfa37a] stroke-[1] mx-auto" />
          <h2 className="font-serif text-xl text-neutral-800">{error || 'Document not found'}</h2>
          <Link
            href={`/${locale}/legal-library`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#bfa37a] hover:text-[#a68d67] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const fileUrl = `/api/legal-documents/${docId}/file`;
  const fileSizeMb = (documentDetail.fileSize / (1024 * 1024)).toFixed(2);

  return (
    <div className="min-h-screen bg-[#faf9f6] selection:bg-[#bfa37a]/30 pt-12 pb-16">
      <div className="max-w-7xl mx-auto px-6">

        <LegalDisclaimer variant="library" className="mb-6" />

        {/* Navigation & Actions Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-neutral-200/50 pb-6">
          <div className="space-y-2">
            <Link
              href={`/${locale}/legal-library`}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#bfa37a] hover:text-[#a68d67] transition mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </Link>
            <h1 className="text-2xl md:text-3xl font-serif text-neutral-900 leading-tight">
              {documentDetail.title}
            </h1>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
              {documentDetail.categoryDisplay}
              {documentDetail.actNumber ? ` • ${documentDetail.actNumber}` : ''}
              {documentDetail.consolidatedToYear
                ? ` • Consolidated to ${documentDetail.consolidatedToYear}`
                : documentDetail.year ? ` • ${documentDetail.year}` : ''}
              {documentDetail.fileAvailable ? ` • ${fileSizeMb} MB` : ''}
            </p>
            {documentDetail.amends && (
              <p className="text-sm text-neutral-600">
                Amends the{' '}
                <Link href={`/${locale}/legal-library/${documentDetail.amends.id}`} className="text-[#a68d67] underline underline-offset-2 hover:text-[#8a7350]">
                  {documentDetail.amends.title}
                </Link>
              </p>
            )}
          </div>

          {documentDetail.fileAvailable && (
            <div className="flex flex-wrap items-center gap-3">
              <a href={fileUrl} download={documentDetail.fileName} className="block">
                <Button className="bg-[#1a1a1a] text-white hover:bg-neutral-800 rounded-none px-6 py-6 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              </a>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-none px-5 py-6 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </Button>
              </a>
            </div>
          )}
        </div>

        <LawRecord doc={documentDetail} locale={locale} />

        {documentDetail.status === 'AWAITING_ORIGINAL' ? (
          <div className="bg-white border border-neutral-200/80 p-8 flex flex-col items-center text-center gap-3">
            <Hourglass className="w-10 h-10 text-[#bfa37a] stroke-[1]" />
            <p className="font-serif text-lg text-neutral-800">Original text: being added</p>
            <p className="max-w-lg text-sm text-neutral-500 font-light leading-relaxed">
              The text of this law itself is being added from an official source. The Acts that amended it are
              listed above, each with its official PDF.
            </p>
          </div>
        ) : !documentDetail.fileAvailable ? (
          <div className="bg-white border border-neutral-200/80 p-8 flex flex-col items-center text-center gap-3">
            <FileText className="w-10 h-10 text-[#bfa37a] stroke-[1]" />
            <p className="font-serif text-lg text-neutral-800">The PDF is not available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Contents: only when the document has a real outline */}
            {outline.length > 0 && (
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white border border-neutral-200/80 shadow-sm p-6 relative">
                  <div className="absolute top-0 right-0 w-3 h-3 bg-[#bfa37a]" />
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-neutral-100">
                    <Compass className="w-5 h-5 text-[#bfa37a]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                      Contents
                    </h3>
                  </div>

                  <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1 scrollbar-thin">
                    {outline.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePage(item.page)}
                        className={`w-full text-left p-4 transition-all duration-300 border border-neutral-100 hover:border-[#bfa37a]/30 group block relative rounded-none ${
                          activePage === item.page
                            ? 'bg-[#faf6f0] border-l-4 border-l-[#bfa37a] border-neutral-200/80'
                            : 'bg-white hover:bg-neutral-50/50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <h4 className="text-xs font-serif font-bold text-neutral-900 group-hover:text-[#bfa37a] transition-colors line-clamp-1">
                            {item.title}
                          </h4>
                          <span className="text-[10px] bg-neutral-100 group-hover:bg-[#bfa37a]/10 text-neutral-500 group-hover:text-[#bfa37a] font-bold px-2 py-0.5 rounded-none shrink-0 transition-colors">
                            Page {item.page}
                          </span>
                        </div>
                        <p className="text-neutral-550 text-[11px] font-light leading-relaxed line-clamp-2">
                          {item.summary}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* The PDF, in the browser's own viewer */}
            <div className={outline.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'}>
              <div className="bg-white border border-neutral-200/80 shadow-md p-2 relative">
                <div className="absolute top-0 right-0 w-3 h-3 bg-[#bfa37a]" />

                <iframe
                  key={activePage}
                  src={`${fileUrl}#page=${activePage}`}
                  className="w-full h-[750px] border-0"
                  title={documentDetail.title}
                />
              </div>
            </div>

          </div>
        )}

        {documentDetail.description && (
          <div className="mt-8 bg-white border border-neutral-200/80 p-6 max-w-7xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">Description / Abstract</h3>
            <p className="text-neutral-600 text-sm font-light leading-relaxed">{documentDetail.description}</p>
          </div>
        )}

      </div>
    </div>
  );
}

/**
 * Where the text came from, when it was last checked, and every Act that
 * amended it, newest first. The amendments are separate official texts: the
 * law's own text above does not include changes made after its date.
 */
function LawRecord({ doc, locale }: { doc: DocumentDetail; locale: string }) {
  const [showAll, setShowAll] = useState(false);
  const amendments = doc.amendments ?? [];
  const shown = showAll ? amendments : amendments.slice(0, 6);
  const hasRecord = doc.sourceName || doc.lastCheckedAt || amendments.length > 0;
  if (!hasRecord) return null;

  return (
    <div className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 bg-white border border-neutral-200/80 p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
          <ShieldCheck className="w-4 h-4 text-[#bfa37a]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800">About this text</h2>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Source</dt>
            <dd className="text-neutral-800">
              {doc.sourceName ?? 'Not recorded'}
              {doc.sourceUrl && (
                <>
                  {' · '}
                  <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#a68d67] underline underline-offset-2 hover:text-[#8a7350]">
                    official copy
                  </a>
                </>
              )}
            </dd>
          </div>
          {doc.consolidatedToYear && (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Includes amendments up to</dt>
              <dd className="text-neutral-800">{doc.consolidatedToYear}</dd>
            </div>
          )}
          {doc.lastCheckedAt && (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Checked for newer Acts</dt>
              <dd className="text-neutral-800">{formatDate(doc.lastCheckedAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      {amendments.length > 0 && (
        <div className="lg:col-span-8 bg-white border border-neutral-200/80 p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
            <History className="w-4 h-4 text-[#bfa37a]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Amended by {amendments.length} Act{amendments.length === 1 ? '' : 's'}
            </h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {shown.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <Link href={`/${locale}/legal-library/${a.id}`} className="text-sm text-neutral-900 hover:text-[#a68d67] min-w-0">
                  {a.title}
                </Link>
                {a.sourceUrl && (
                  <a
                    href={a.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#a68d67] hover:text-[#8a7350]"
                  >
                    Official PDF <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
          {amendments.length > 6 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#a68d67] hover:text-[#8a7350]"
            >
              {showAll ? 'Show fewer' : `Show all ${amendments.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
