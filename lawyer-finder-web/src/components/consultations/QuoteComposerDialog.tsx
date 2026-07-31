'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { FileText, Loader2, Info } from 'lucide-react';

type FeeBasis = 'CONSULTATION_FEE' | 'FIXED_FEE' | 'HOURLY';

const FEE_BASES: { value: FeeBasis; label: string; hint: string }[] = [
  // Consultation fee is the normal case here. The other two exist for when a firm
  // wants to quote for the whole matter rather than just the meeting.
  { value: 'CONSULTATION_FEE', label: 'Consultation fee', hint: 'For this meeting only. The usual choice.' },
  { value: 'FIXED_FEE', label: 'Fixed fee', hint: 'For a defined job, e.g. drafting and filing a plaint.' },
  { value: 'HOURLY', label: 'Hourly', hint: 'Charged per hour worked.' },
];

/** Default quote validity: 7 days from now, as a yyyy-MM-dd string. */
function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

/**
 * The firm composes a fee quote for the client.
 *
 * The amount is the firm's fee in full — the platform derives nothing from it and
 * receives none of it. Payment instructions are the firm's own account details;
 * the client pays the firm directly.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 1, 2 and 7).
 */
export function QuoteComposerDialog({
  bookingId,
  bookingNumber,
  clientName,
  defaultPaymentInstructions = '',
  open,
  onOpenChange,
  onCompleted,
}: {
  bookingId: string;
  bookingNumber: string;
  clientName: string;
  defaultPaymentInstructions?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [feeBasis, setFeeBasis] = useState<FeeBasis>('CONSULTATION_FEE');
  const [amount, setAmount] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState(defaultPaymentInstructions);
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const parsedAmount = parseInt(amount, 10);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error('Enter the fee as a whole number of rupees');
      return;
    }
    if (scopeOfWork.trim().length < 10) {
      toast.error('Describe what the fee covers (at least 10 characters)');
      return;
    }
    if (paymentInstructions.trim().length < 10) {
      toast.error('Provide the account details the client should pay into');
      return;
    }
    if (feeBasis === 'HOURLY' && !hourlyRate) {
      toast.error('An hourly quote needs an hourly rate');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeBasis,
          amount: parsedAmount,
          hourlyRate: hourlyRate ? parseInt(hourlyRate, 10) : undefined,
          estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
          scopeOfWork: scopeOfWork.trim(),
          exclusions: exclusions.trim() || undefined,
          paymentInstructions: paymentInstructions.trim(),
          validUntil: new Date(`${validUntil}T23:59:59`).toISOString(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message || data.error || 'Could not send the quote');
        return;
      }

      toast.success('Quote sent to the client');
      onOpenChange(false);
      onCompleted();
    } catch {
      toast.error('Could not send the quote');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
            <FileText className="h-5 w-5" aria-hidden="true" />
            Quote a fee
          </DialogTitle>
          <DialogDescription className="text-xs">
            {bookingNumber} · {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 border border-blue-200 bg-blue-50 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-blue-800">
            The client pays this amount <strong>in full, directly to you</strong>.
            The platform takes no share of it and never handles the money. When the
            client accepts, an engagement letter is generated automatically.
          </p>
        </div>

        <div className="space-y-4 py-1">
          {/* Fee basis */}
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide">Fee basis</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {FEE_BASES.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setFeeBasis(b.value)}
                  aria-pressed={feeBasis === b.value}
                  className={`border-2 px-2.5 py-2 text-left transition-colors ${
                    feeBasis === b.value
                      ? 'border-[#0a0a0a] bg-neutral-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <span className="block text-xs font-bold">{b.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-neutral-500">{b.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-amount" className="text-xs font-bold uppercase tracking-wide">
                Fee (LKR) <span className="text-red-600">*</span>
              </Label>
              <Input
                id="q-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="15000"
                className="rounded-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-valid" className="text-xs font-bold uppercase tracking-wide">
                Valid until <span className="text-red-600">*</span>
              </Label>
              <Input
                id="q-valid"
                type="date"
                value={validUntil}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setValidUntil(e.target.value)}
                className="rounded-none"
              />
            </div>
          </div>

          {feeBasis === 'HOURLY' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="q-rate" className="text-xs font-bold uppercase tracking-wide">
                  Hourly rate (LKR) <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="q-rate"
                  inputMode="numeric"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value.replace(/[^0-9]/g, ''))}
                  className="rounded-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-hours" className="text-xs font-bold uppercase tracking-wide">
                  Estimated hours
                </Label>
                <Input
                  id="q-hours"
                  inputMode="decimal"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="rounded-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="q-scope" className="text-xs font-bold uppercase tracking-wide">
              What the fee covers <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="q-scope"
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. A one-hour consultation on your tenancy dispute, including review of the lease you provided and written advice on your options."
              className="rounded-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-excl" className="text-xs font-bold uppercase tracking-wide">
              What it does not cover
            </Label>
            <Textarea
              id="q-excl"
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="e.g. Court appearances, drafting of pleadings, or any filing fees."
              className="rounded-none"
            />
            <p className="text-[10px] text-neutral-500">
              Being explicit here prevents most fee disputes later.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-pay" className="text-xs font-bold uppercase tracking-wide">
              Your payment details <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="q-pay"
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={'Bank: \nAccount name: \nAccount number: \nBranch: '}
              className="rounded-none"
            />
            <p className="text-[10px] text-neutral-500">
              The client pays into this account directly.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="rounded-none">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuoteComposerDialog;
