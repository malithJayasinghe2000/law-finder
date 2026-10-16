'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Banknote, Clock, CheckCircle, RefreshCcw, Info, Loader2, User, CalendarDays } from 'lucide-react';
import { formatDateOnlyString } from '@/lib/utils';

interface RefundItem {
  id: string;
  bookingNumber: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  refundAmount: number;
  retainedLawyerFee: number;
  refundStatus: string;
  refundProcessedAt: string | null;
  refundNotes: string | null;
  refundDisputeReason: string | null;
  status: string;
  cancelReason: string | null;
}

interface Stats {
  pendingCount: number;
  processedCount: number;
  totalPendingAmount: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSED: 'bg-sky-100 text-sky-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  DISPUTED: 'bg-red-100 text-red-800',
  DECLINED: 'bg-neutral-200 text-neutral-700',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'To refund',
  PROCESSED: 'Awaiting client confirmation',
  CONFIRMED: 'Confirmed by client',
  DISPUTED: 'Client says not received',
  DECLINED: 'Declined',
};

/**
 * Refunds this firm owes its own clients.
 *
 * The firm received the fee, so the firm returns it. This page records that it was
 * returned — it does not move money.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
 */
export default function LawyerRefundsPage() {
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [stats, setStats] = useState<Stats>({ pendingCount: 0, processedCount: 0, totalPendingAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [target, setTarget] = useState<RefundItem | null>(null);
  const [action, setAction] = useState<'process' | 'decline'>('process');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState('Bank transfer');
  const [reference, setReference] = useState('');
  const [sentOn, setSentOn] = useState(() => new Date().toISOString().split('T')[0]);
  const [proofUrl, setProofUrl] = useState('');
  // What the practice actually returned. Starts at what the client paid; less
  // needs a reason the client is shown (the practice's own terms, not ours).
  const [amount, setAmount] = useState('');
  const [refused, setRefused] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function uploadProof() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,application/pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File must be under 5MB');
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'refunds');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setProofUrl(data.url);
        toast.success('Proof attached');
      } catch (err: any) {
        toast.error(err?.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/consultations/refunds?status=${statusFilter}`);
      const data = await res.json();
      if (res.status === 403) { setRefused(data.error || 'You cannot see refunds.'); return; }
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRefunds(data.refunds || []);
      setStats(data.stats || { pendingCount: 0, processedCount: 0, totalPendingAmount: 0 });
    } catch {
      toast.error('Could not load your refunds');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!target) return;
    if (action === 'decline' && notes.trim().length < 5) {
      toast.error('Give the client a reason for declining');
      return;
    }
    if (action === 'process') {
      if (method.trim().length < 2) { toast.error('Record how you sent the refund'); return; }
      if (reference.trim().length < 3) { toast.error('Record the transaction reference so the client can match it'); return; }
      if (!sentOn) { toast.error('Record the date you sent it'); return; }
      const n = Number(amount);
      if (!Number.isInteger(n) || n < 1 || n > target.totalAmount) {
        toast.error(`Enter the amount you refunded, up to Rs. ${target.totalAmount.toLocaleString()}`); return;
      }
      if (n < target.totalAmount && notes.trim().length < 10) {
        toast.error('You refunded less than the client paid - say why in the note'); return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/consultations/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: target.id,
          action,
          notes: notes.trim() || undefined,
          ...(action === 'process'
            ? { method: method.trim(), reference: reference.trim(), sentOn, proofUrl: proofUrl || undefined, amount: Number(amount) }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action failed');
        return;
      }
      toast.success(action === 'process' ? 'Recorded - the client will be asked to confirm receipt' : 'Refund declined');
      setTarget(null);
      setNotes('');
      setReference('');
      setProofUrl('');
      load();
    } catch {
      toast.error('Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  const tabs = [
    { value: 'PENDING', label: 'To refund', icon: Clock },
    { value: 'PROCESSED', label: 'Awaiting confirmation', icon: Clock },
    { value: 'DISPUTED', label: 'Disputed', icon: Info },
    { value: 'ALL', label: 'All', icon: RefreshCcw },
  ];

  if (refused) {
    return <div className="max-w-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">{refused}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <Banknote className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-neutral-900 sm:text-4xl">Refunds</h1>
          <p className="text-sm font-medium text-neutral-500">
            Fees your practice owes back after a paid request is cancelled
          </p>
        </div>
      </div>

      <div role="note" className="flex items-start gap-3 border border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-blue-900">Your practice holds the fee, so it makes the refund</p>
          <p className="text-blue-800">
            Clients paid your practice directly, so return the money from the practice&apos;s
            account and then record it here. What the client paid is shown as owed in full;
            if your terms with the client mean you return less, record what you returned and
            why - the client sees your reason and can dispute it. Recording it does not
            transfer anything.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-none border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Awaiting refund</p>
            <p className="mt-1 text-3xl font-bold text-neutral-900">{loading ? ' - ' : stats.pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Total you owe</p>
            <p className="mt-1 text-3xl font-bold text-red-600">
              {loading ? ' - ' : `Rs. ${stats.totalPendingAmount.toLocaleString()}`}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Refunded</p>
            <p className="mt-1 text-3xl font-bold text-green-600">{loading ? ' - ' : stats.processedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              statusFilter === t.value
                ? 'border-[#0a0a0a] text-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-none" />)}
        </div>
      ) : refunds.length === 0 ? (
        <div className="border border-dashed border-neutral-200 bg-neutral-50/50 py-16 text-center">
          <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-neutral-900">Nothing to refund</p>
          <p className="mt-1 text-xs text-neutral-500">Cancelled consultations that were paid for will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {refunds.map((r) => (
            <Card key={r.id} className="rounded-none border border-neutral-200 shadow-sm">
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-[200px] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {r.bookingNumber}
                    </p>
                    <Badge className={`rounded-sm px-2 py-0.5 text-[10px] uppercase ${STATUS_COLORS[r.refundStatus] || ''}`}>
                      {STATUS_LABELS[r.refundStatus] || r.refundStatus}
                    </Badge>
                  </div>
                  <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
                    <User className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                    {r.clientName}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDateOnlyString(r.date)} · {r.startTime}–{r.endTime}
                  </p>
                  {r.cancelReason && (
                    <p className="text-xs text-neutral-500">Reason: {r.cancelReason}</p>
                  )}
                  {r.refundNotes && (
                    <p className="text-xs italic text-neutral-400">{r.refundNotes}</p>
                  )}
                  {r.refundStatus === 'DISPUTED' && r.refundDisputeReason && (
                    <p className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      <strong>Client says this did not arrive:</strong> {r.refundDisputeReason}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    {r.refundStatus === 'PENDING' || r.refundStatus === 'DISPUTED' ? 'Client paid' : 'Refunded'}
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    Rs. {(r.refundStatus === 'PENDING' || r.refundStatus === 'DISPUTED' ? r.totalAmount : r.refundAmount).toLocaleString()}
                  </p>
                  {r.retainedLawyerFee > 0 && r.refundStatus !== 'PENDING' && (
                    <p className="text-[10px] text-neutral-500">
                      Kept by the practice: Rs. {r.retainedLawyerFee.toLocaleString()}
                    </p>
                  )}

                  {(r.refundStatus === 'PENDING' || r.refundStatus === 'DISPUTED') && (
                    <div className="mt-3 flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setTarget(r); setAction('decline'); setNotes(''); }}
                        className="h-7 rounded-none px-2.5 text-[10px] font-bold text-red-600"
                      >
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => { setTarget(r); setAction('process'); setAmount(String(r.totalAmount)); setNotes(''); }}
                        className="h-7 rounded-none bg-green-600 px-2.5 text-[10px] font-bold text-white hover:bg-green-700"
                      >
                        {r.refundStatus === 'DISPUTED' ? 'Re-record refund' : 'Mark as refunded'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={Boolean(target)} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold uppercase tracking-wider">
              {action === 'process' ? 'Confirm refund sent' : 'Decline refund'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {target?.bookingNumber} · Rs. {target?.refundAmount.toLocaleString()} to {target?.clientName}
            </DialogDescription>
          </DialogHeader>

          {action === 'process' && (
            <>
              <p className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Only record this once the money has actually been sent from your
                practice&apos;s account. The client is notified and asked to confirm they received
                it - so the record does not rest on your word alone.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="rf-amount" className="text-xs font-bold uppercase tracking-wide">
                  Amount refunded (Rs.) <span className="text-red-600">*</span>
                </Label>
                <input
                  id="rf-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={target?.totalAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-9 w-full border border-neutral-200 bg-white px-2 text-sm"
                />
                {target && Number(amount) > 0 && Number(amount) < target.totalAmount && (
                  <p className="text-xs text-amber-800">
                    Less than the Rs. {target.totalAmount.toLocaleString()} the client paid - say why in the note below.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rf-method" className="text-xs font-bold uppercase tracking-wide">
                    How you sent it <span className="text-red-600">*</span>
                  </Label>
                  <select
                    id="rf-method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="h-9 w-full border border-neutral-200 bg-white px-2 text-sm"
                  >
                    {['Bank transfer', 'Cash', 'Cheque', 'Other'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rf-date" className="text-xs font-bold uppercase tracking-wide">
                    Date sent <span className="text-red-600">*</span>
                  </Label>
                  <input
                    id="rf-date"
                    type="date"
                    value={sentOn}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setSentOn(e.target.value)}
                    className="h-9 w-full border border-neutral-200 bg-white px-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rf-ref" className="text-xs font-bold uppercase tracking-wide">
                  Transaction reference <span className="text-red-600">*</span>
                </Label>
                <input
                  id="rf-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="The reference from your bank, so the client can match it"
                  className="h-9 w-full border border-neutral-200 bg-white px-2 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide">Proof (optional)</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={uploadProof} disabled={uploading} className="rounded-none">
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {proofUrl ? 'Replace file' : 'Attach receipt'}
                  </Button>
                  {proofUrl && (
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                      View attached
                    </a>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rf-notes" className="text-xs font-bold uppercase tracking-wide">
              {action === 'process' ? 'Note (optional)' : 'Reason'}{' '}
              {action === 'decline' && <span className="text-red-600">*</span>}
            </Label>
            <Textarea
              id="rf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              className="rounded-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setTarget(null)} className="rounded-none">Cancel</Button>
            <Button
              onClick={submit}
              disabled={submitting}
              className={`rounded-none ${action === 'process' ? 'bg-green-600 text-white hover:bg-green-700' : ''}`}
              variant={action === 'decline' ? 'destructive' : 'default'}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
