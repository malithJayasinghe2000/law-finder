'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { FileText, Loader2, Info, CalendarClock } from 'lucide-react';

interface Quote {
  id: string;
  version: number;
  status: string;
  feeBasis: string;
  amount: number;
  currency: string;
  hourlyRate: number | null;
  estimatedHours: number | null;
  scopeOfWork: string;
  exclusions: string | null;
  paymentInstructions: string;
  validUntil: string;
}

const FEE_BASIS_LABELS: Record<string, string> = {
  CONSULTATION_FEE: 'Flat consultation fee',
  FIXED_FEE: 'Fixed fee for the scope below',
  HOURLY: 'Hourly rate',
};

/**
 * The client reviews the firm's fee proposal and accepts or declines it.
 *
 * Accepting is the moment terms are agreed — it generates the engagement letter.
 * The fee is paid directly to the firm; the platform is not a party to it.
 */
export function QuoteReviewDialog({
  bookingId,
  bookingNumber,
  firmName,
  open,
  onOpenChange,
  onResponded,
}: {
  bookingId: string;
  bookingNumber: string;
  firmName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResponded: () => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setDeclining(false);
    setReason('');
    fetch(`/api/consultations/bookings/${bookingId}/quotes`)
      .then((r) => r.json())
      .then((d) => {
        const outstanding = (d.quotes || []).find((q: Quote) => q.status === 'SENT');
        setQuote(outstanding || null);
      })
      .catch(() => toast.error('Could not load the fee proposal'))
      .finally(() => setLoading(false));
  }, [open, bookingId]);

  async function respond(action: 'accept' | 'decline') {
    if (action === 'decline' && !reason.trim()) {
      toast.error('Please tell the firm why you are declining');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/quotes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message || data.error || 'Could not send your response');
        return;
      }

      toast.success(
        action === 'accept'
          ? 'Terms accepted. Your engagement letter is ready.'
          : 'The firm has been notified.'
      );
      onOpenChange(false);
      onResponded();
    } catch {
      toast.error('Could not send your response');
    } finally {
      setSubmitting(false);
    }
  }

  const expired = quote ? new Date(quote.validUntil).getTime() < Date.now() : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
            <FileText className="h-5 w-5" aria-hidden="true" />
            Fee proposal
          </DialogTitle>
          <DialogDescription className="text-xs">
            {bookingNumber} · from {firmName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-20 w-full rounded-none" />
            <Skeleton className="h-16 w-full rounded-none" />
          </div>
        ) : !quote ? (
          <p className="py-6 text-center text-sm text-neutral-500">
            There is no fee proposal awaiting your response.
          </p>
        ) : (
          <div className="space-y-4 py-1">
            {/* Amount */}
            <div className="border-2 border-[#0a0a0a] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Total payable to {firmName}
              </p>
              <p className="mt-1 text-3xl font-bold text-neutral-900">
                {quote.currency} {quote.amount.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                {FEE_BASIS_LABELS[quote.feeBasis] || quote.feeBasis}
                {quote.feeBasis === 'HOURLY' && quote.hourlyRate
                  ? ` · ${quote.currency} ${quote.hourlyRate.toLocaleString()}/hr${
                      quote.estimatedHours ? ` × ~${quote.estimatedHours}h` : ''
                    }`
                  : ''}
              </p>
            </div>

            <div className="flex items-start gap-2 border border-blue-200 bg-blue-50 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed text-blue-800">
                You pay this amount <strong>directly to {firmName}</strong>. The
                platform takes no share and never handles your money. There are no
                additional fees.
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide">What this covers</p>
              <p className="whitespace-pre-wrap text-sm text-neutral-700">{quote.scopeOfWork}</p>
            </div>

            {quote.exclusions && (
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide">What it does not cover</p>
                <p className="whitespace-pre-wrap text-sm text-neutral-700">{quote.exclusions}</p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide">How to pay</p>
              <pre className="whitespace-pre-wrap border border-neutral-200 bg-neutral-50 p-3 font-sans text-xs text-neutral-700">
                {quote.paymentInstructions}
              </pre>
            </div>

            <p
              className={`flex items-center gap-1.5 text-[11px] ${
                expired ? 'font-semibold text-red-600' : 'text-neutral-500'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {expired
                ? 'This proposal has expired - ask the firm to send a new one.'
                : `Valid until ${new Date(quote.validUntil).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}`}
            </p>

            {declining && (
              <div className="space-y-1.5 border-t border-neutral-200 pt-3">
                <Label htmlFor="q-reason" className="text-xs font-bold uppercase tracking-wide">
                  Why are you declining? <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="q-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="This is shared with the firm."
                  className="rounded-none"
                />
              </div>
            )}
          </div>
        )}

        {quote && !expired && (
          <DialogFooter className="gap-2 sm:gap-2">
            {declining ? (
              <>
                <Button variant="outline" onClick={() => setDeclining(false)} className="rounded-none">
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => respond('decline')}
                  disabled={submitting}
                  className="rounded-none"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm decline
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDeclining(true)} className="rounded-none">
                  Decline
                </Button>
                <Button onClick={() => respond('accept')} disabled={submitting} className="rounded-none">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Accept terms
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default QuoteReviewDialog;
