'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Banknote, Loader2, Info, AlertTriangle } from 'lucide-react';

interface PaymentDetails {
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  transactionDate: string | null;
  transactionRef: string | null;
  receiptImageUrl: string | null;
  notes: string | null;
  status: string;
}

/**
 * The firm reviews what the client recorded before confirming the money arrived.
 *
 * The platform cannot see a transfer into the firm's own account, so only the firm
 * can verify it. Confirming schedules the consultation; rejecting sends it back to
 * the client to correct. See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
 */
export function PaymentReviewDialog({
  bookingId,
  bookingNumber,
  clientName,
  amount,
  payment,
  open,
  onOpenChange,
  onCompleted,
}: {
  bookingId: string;
  bookingNumber: string;
  clientName: string;
  amount: number;
  payment: PaymentDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function act(action: 'confirm_payment_received' | 'reject_payment') {
    if (action === 'reject_payment' && reason.trim().length < 5) {
      toast.error('Tell the client what was wrong so they can correct it');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Action failed');
        return;
      }

      toast.success(
        action === 'confirm_payment_received'
          ? 'Payment confirmed — the consultation is now scheduled'
          : 'Sent back to the client to correct'
      );
      setRejecting(false);
      setReason('');
      onOpenChange(false);
      onCompleted();
    } catch {
      toast.error('Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  const rows: [string, string | null | undefined][] = [
    ['Paid from bank', payment?.bankName],
    ['Account holder', payment?.accountHolder],
    ['Account number', payment?.accountNumber],
    ['Transaction date', payment?.transactionDate],
    ['Reference', payment?.transactionRef],
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setRejecting(false); setReason(''); } onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
            <Banknote className="h-5 w-5" aria-hidden="true" />
            Review payment
          </DialogTitle>
          <DialogDescription className="text-xs">
            {bookingNumber} · {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 border border-blue-200 bg-blue-50 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-blue-800">
            Check your own bank account before confirming. The platform cannot see
            transfers into your account, so only you can verify this arrived.
          </p>
        </div>

        <div className="space-y-4 py-1">
          <div className="border-2 border-[#0a0a0a] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              Amount expected
            </p>
            <p className="mt-1 text-3xl font-bold text-neutral-900">
              Rs. {amount.toLocaleString()}
            </p>
          </div>

          {!payment ? (
            <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="text-xs text-amber-800">
                The client has not recorded a payment yet. There is nothing to
                confirm until they do.
              </p>
            </div>
          ) : (
            <>
              <dl className="divide-y divide-neutral-100 border border-neutral-200">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-3 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      {label}
                    </dt>
                    <dd className="text-right text-sm text-neutral-900">{value || '—'}</dd>
                  </div>
                ))}
              </dl>

              {payment.notes && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">Client note</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{payment.notes}</p>
                </div>
              )}

              {payment.receiptImageUrl && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide">Receipt</p>
                  <a href={payment.receiptImageUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={payment.receiptImageUrl}
                      alt="Payment receipt uploaded by the client"
                      className="max-h-56 w-full border border-neutral-200 bg-neutral-50 object-contain hover:opacity-90"
                    />
                  </a>
                  <p className="mt-1 text-[10px] text-neutral-400">Click to open full size</p>
                </div>
              )}
            </>
          )}

          {rejecting && (
            <div className="space-y-1.5 border-t border-neutral-200 pt-3">
              <Label htmlFor="pr-reason" className="text-xs font-bold uppercase tracking-wide">
                What was wrong? <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="pr-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. The amount received was Rs. 5,000 short, or the reference does not match."
                className="rounded-none"
              />
              <p className="text-[10px] text-neutral-500">
                Sent to the client so they can correct and resubmit.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {rejecting ? (
            <>
              <Button variant="outline" onClick={() => setRejecting(false)} className="rounded-none">
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => act('reject_payment')}
                disabled={submitting}
                className="rounded-none"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send back to client
              </Button>
            </>
          ) : (
            <>
              {payment && (
                <Button variant="outline" onClick={() => setRejecting(true)} className="rounded-none">
                  Something is wrong
                </Button>
              )}
              <Button
                onClick={() => act('confirm_payment_received')}
                disabled={submitting || !payment}
                className="rounded-none bg-green-600 text-white hover:bg-green-700"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm payment received
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentReviewDialog;
