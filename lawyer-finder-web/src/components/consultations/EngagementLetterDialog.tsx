'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollText, Download, Loader2 } from 'lucide-react';

interface Letter {
  reference: string;
  body: string;
  issuedAt: string;
  firmName: string;
}

/**
 * Displays the engagement letter issued when the client accepted the quote.
 *
 * The body is rendered from the snapshot stored at issue time, so it always shows
 * the terms as they were agreed. See docs/restructure/LEGAL-GUARDRAILS.md (rule 7).
 */
export function EngagementLetterDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/consultations/bookings/${bookingId}/engagement-letter`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Not available');
        setLetter(d.letter);
      })
      .catch((e) => toast.error(e.message || 'Could not load the engagement letter'))
      .finally(() => setLoading(false));
  }, [open, bookingId]);

  function download() {
    if (!letter) return;
    const blob = new Blob([letter.body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${letter.reference}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
            <ScrollText className="h-5 w-5" aria-hidden="true" />
            Letter of engagement
          </DialogTitle>
          <DialogDescription className="text-xs">
            {letter ? `${letter.reference} · issued by ${letter.firmName}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-1/2 rounded-none" />
            <Skeleton className="h-32 w-full rounded-none" />
            <Skeleton className="h-24 w-full rounded-none" />
          </div>
        ) : !letter ? (
          <p className="py-6 text-center text-sm text-neutral-500">
            No engagement letter has been issued for this request yet.
          </p>
        ) : (
          <article className="prose prose-sm prose-neutral max-w-none border border-neutral-200 bg-white p-5 prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-xl prose-h2:mt-6 prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-wide">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{letter.body}</ReactMarkdown>
          </article>
        )}

        {letter && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={download} className="rounded-none">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Download
            </Button>
            <Button onClick={() => onOpenChange(false)} className="rounded-none">
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EngagementLetterDialog;
