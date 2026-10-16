'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Receipt, FileDown, Plus, Trash2, Send, CheckCircle2, Ban } from 'lucide-react';
import { useParams } from 'next/navigation';

/**
 * Fee notes on a matter — the firm billing its own client.
 *
 * Two things this screen has to make unmistakable, because a user who is
 * confused by a screen has been failed by the screen:
 *
 *  1. **The firm is charging, not us.** The money goes to the firm's own
 *     account and no part of it reaches this platform. The note itself says so
 *     in full; this dialog says the short version.
 *  2. **"Mark settled" records, it does not verify.** We never saw the payment.
 *     The firm is asserting it arrived, exactly as with booking payments since
 *     Phase 1 — there is no admin approval anywhere in this flow.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 1, 2 and 7).
 */

interface FeeNoteLine {
  description: string;
  amount: number;
}

interface FeeNote {
  id: string;
  noteNumber: string;
  status: 'DRAFT' | 'ISSUED' | 'SETTLED' | 'CANCELLED';
  lineItems: FeeNoteLine[];
  subtotal: number;
  vatRatePercent: number | null;
  vatAmount: number;
  total: number;
  currency: string;
  issuedAt: string | null;
  settledAt: string | null;
  clientName: string;
}

const STATUS_LABEL: Record<FeeNote['status'], { text: string; className: string }> = {
  DRAFT: { text: 'Draft', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
  ISSUED: { text: 'Issued', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  SETTLED: { text: 'Paid', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  CANCELLED: { text: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
};

export function FeeNoteDialog({
  bookingId,
  open,
  onOpenChange,
  canManage,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True for the attorney acting or a firm principal; false for the client. */
  canManage: boolean;
}) {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';

  const [feeNotes, setFeeNotes] = useState<FeeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [lines, setLines] = useState<FeeNoteLine[]>([{ description: '', amount: 0 }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/fee-notes`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load fee notes');
      setFeeNotes(data.feeNotes || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load fee notes');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const draftSubtotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  async function createDraft() {
    const cleaned = lines
      .map((l) => ({ description: l.description.trim(), amount: Math.round(Number(l.amount) || 0) }))
      .filter((l) => l.description.length >= 3);

    if (!cleaned.length) {
      toast.error('Add at least one line describing what is being charged for.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/fee-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.toString() || 'Could not create the fee note');
      toast.success('Draft fee note created. Review it, then issue it to the client.');
      setComposing(false);
      setLines([{ description: '', amount: 0 }]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the fee note');
    } finally {
      setBusy(false);
    }
  }

  async function act(feeNoteId: string, action: 'issue' | 'settle' | 'cancel') {
    setBusy(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/fee-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeNoteId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.toString() || 'Could not update the fee note');

      toast.success(
        action === 'issue'
          ? 'Fee note issued. The client can now open it.'
          : action === 'settle'
            ? 'Recorded as paid.'
            : 'Fee note cancelled.'
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the fee note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" aria-hidden="true" />
            Fee notes
          </DialogTitle>
          <DialogDescription>
            {canManage
              ? 'Your firm bills the client directly, under your own TIN and VAT number, into your own account. This platform is not part of the transaction and takes no share of the fee.'
              : 'Fee notes issued to you by the firm. Payment goes to the firm directly - this platform does not handle it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto py-1">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : feeNotes.length === 0 && !composing ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              No fee notes on this matter yet.
            </p>
          ) : (
            feeNotes.map((note) => {
              const label = STATUS_LABEL[note.status];
              return (
                <div key={note.id} className="border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-neutral-900">
                        {note.noteNumber}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-neutral-900">
                        {note.currency} {note.total.toLocaleString('en-LK')}
                      </p>
                      {note.vatAmount > 0 && (
                        <p className="text-[11px] text-neutral-500">
                          includes {note.currency} {note.vatAmount.toLocaleString('en-LK')} VAT
                          {note.vatRatePercent ? ` at ${note.vatRatePercent}%` : ''}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${label.className}`}
                    >
                      {label.text}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-[12px] text-neutral-600">
                    {note.lineItems?.map((line, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span className="truncate">{line.description}</span>
                        <span className="shrink-0 tabular-nums">
                          {note.currency} {Number(line.amount).toLocaleString('en-LK')}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {note.status !== 'DRAFT' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/${locale}/fee-note/${note.id}`, '_blank')}
                      >
                        <FileDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        Open / save as PDF
                      </Button>
                    )}

                    {canManage && note.status === 'DRAFT' && (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => act(note.id, 'issue')}>
                          <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Issue to client
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => act(note.id, 'cancel')}
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Cancel
                        </Button>
                      </>
                    )}

                    {canManage && note.status === 'ISSUED' && (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => act(note.id, 'settle')}>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Record as paid
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => act(note.id, 'cancel')}
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>

                  {canManage && note.status === 'ISSUED' && (
                    // Said plainly because it is the single most misread control
                    // in the whole billing flow.
                    <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                      &ldquo;Record as paid&rdquo; notes that <em>you</em> received the money. It
                      does not verify a payment - the client pays your account directly and we
                      never see it.
                    </p>
                  )}
                </div>
              );
            })
          )}

          {canManage && composing && (
            <div className="border border-neutral-300 bg-neutral-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-700">
                New fee note
              </p>

              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={line.description}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...next[i], description: e.target.value };
                        setLines(next);
                      }}
                      placeholder="Professional fees - advice on land dispute"
                      className="flex-1 border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={line.amount || ''}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...next[i], amount: Number(e.target.value) };
                        setLines(next);
                      }}
                      placeholder="LKR"
                      className="w-32 border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-neutral-900"
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remove line"
                        onClick={() => setLines(lines.filter((_, j) => j !== i))}
                        className="px-2 text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setLines([...lines, { description: '', amount: 0 }])}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-neutral-600 hover:text-neutral-900"
              >
                <Plus className="h-3 w-3" aria-hidden="true" /> Add line
              </button>

              <p className="mt-3 border-t border-neutral-200 pt-3 text-sm font-semibold text-neutral-900">
                Subtotal: LKR {draftSubtotal.toLocaleString('en-LK')}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                VAT is added automatically only if your firm is registered for it. Set your TIN,
                VAT number and rate in firm settings - they are printed on the note.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {canManage ? (
            composing ? (
              <>
                <Button variant="ghost" onClick={() => setComposing(false)} disabled={busy}>
                  Discard
                </Button>
                <Button onClick={createDraft} disabled={busy}>
                  Create draft
                </Button>
              </>
            ) : (
              <>
                <span />
                <Button onClick={() => setComposing(true)} disabled={busy}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  New fee note
                </Button>
              </>
            )
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FeeNoteDialog;
