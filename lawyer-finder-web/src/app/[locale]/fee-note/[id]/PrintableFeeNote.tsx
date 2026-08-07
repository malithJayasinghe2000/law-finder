'use client';

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Printer, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Renders a fee note as an A4 document and opens the print dialog, where the
 * browser's "Save as PDF" produces the PDF.
 *
 * The body is the snapshot taken when the note was issued — it is not
 * regenerated here. If the firm has since changed its address or VAT number,
 * this still shows what the client was actually sent, which is the whole point
 * of snapshotting a tax document.
 *
 * A cancelled note is watermarked rather than hidden: the firm and the client
 * may both need to show that a number was withdrawn, and the note keeps its
 * place in the firm's sequence either way.
 */
export default function PrintableFeeNote({
  noteNumber,
  body,
  firmName,
  status,
  issuedAt,
}: {
  noteNumber: string;
  body: string;
  firmName: string;
  status: string;
  issuedAt: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  const isCancelled = status === 'CANCELLED';
  const isSettled = status === 'SETTLED';

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm 16mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .note-sheet {
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
          }
          h1, h2 { break-after: avoid-page; }
          table { break-inside: avoid; }
          p, li { orphans: 3; widows: 3; }
        }
      `}</style>

      <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
        {/* Toolbar — screen only */}
        <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <p className="hidden text-[11px] text-neutral-500 sm:block">
              Choose <strong>Save as PDF</strong> as the destination
            </p>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-[#0a0a0a] px-5 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-neutral-800"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Save as PDF
            </button>
          </div>
        </div>

        {/* A4 sheet */}
        <article className="note-sheet relative mx-auto max-w-[210mm] border border-neutral-200 bg-white px-[16mm] py-[18mm] shadow-sm">
          {isCancelled && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="-rotate-12 select-none text-[64px] font-black uppercase tracking-widest text-red-500/15">
                Cancelled
              </span>
            </div>
          )}

          {isSettled && (
            <p className="mb-6 inline-block border border-emerald-300 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-800">
              Recorded as paid by the firm
            </p>
          )}

          <div className="prose prose-sm prose-neutral max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:mb-1 prose-h1:text-2xl prose-h2:mt-7 prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-wide prose-hr:my-6 prose-p:leading-relaxed prose-td:py-1 prose-th:py-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>

          <footer className="mt-10 border-t border-neutral-200 pt-4 text-[10px] leading-relaxed text-neutral-400">
            {noteNumber} · issued by {firmName}
            {issuedAt
              ? ` on ${new Date(issuedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}`
              : ''}
          </footer>
        </article>
      </div>
    </>
  );
}
