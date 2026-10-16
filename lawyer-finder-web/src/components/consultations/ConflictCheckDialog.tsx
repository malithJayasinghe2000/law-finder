'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ClipboardCheck, Loader2, Lock } from 'lucide-react';
import { RecordConflictCheckSchema } from '@/schemas/consultation.schema';

type Outcome = 'CLEAR' | 'CONFLICT_FOUND' | 'NEEDS_REVIEW';

/**
 * Reviewing a new request: may the practice act for this client?
 *
 * This is the conflict-of-interest check, kept deliberately simple (owner's
 * decision, 2026-10-13): Accept, Decline or Hold, and a private note. The old
 * "parties screened" list is gone — requests are often not disputes at all, and
 * the duty is the attorney's own. What stays:
 *
 *   - Accepting requires the attorney to confirm they checked the practice does
 *     not act for the other side. Enforced on the server, not only here.
 *   - Declining tells the client only that the practice cannot act, never why —
 *     the reason usually concerns another client. A short private reason is
 *     required, for the practice's own record.
 *
 * Only the assigned attorney records this. See LEGAL-GUARDRAILS.md (rule 5).
 */
export function ConflictCheckDialog({
  bookingId,
  bookingNumber,
  clientName,
  subject,
  description,
  open,
  onOpenChange,
  onCompleted,
}: {
  bookingId: string;
  bookingNumber: string;
  clientName: string;
  subject: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setOutcome(null);
    setConfirmed(false);
    setNotes('');
  }

  const needsNote = outcome === 'CONFLICT_FOUND';
  const payload = {
    outcome,
    confirmedNoConflict: outcome === 'CLEAR' ? confirmed : undefined,
    notes: notes.trim() || undefined,
  };
  // The same rules the server applies (accept needs the confirmation, decline a note).
  const ready = RecordConflictCheckSchema.safeParse(payload).success;

  async function submit() {
    if (!ready) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/conflict-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Could not save your decision');
        return;
      }

      toast.success(
        outcome === 'CLEAR'
          ? 'Accepted - you can now send a quote.'
          : outcome === 'NEEDS_REVIEW'
            ? 'On hold. Review it again when you are ready.'
            : 'Declined. The client has been told only that your practice cannot act.'
      );
      reset();
      onOpenChange(false);
      onCompleted();
    } catch {
      toast.error('Could not save your decision');
    } finally {
      setSubmitting(false);
    }
  }

  const OUTCOMES: { value: Outcome; label: string; next: string; tone: string }[] = [
    { value: 'CLEAR', label: 'Accept', next: 'You can then send a quote', tone: 'border-green-600 bg-green-50 text-green-900' },
    { value: 'CONFLICT_FOUND', label: 'Decline', next: 'The client is told you cannot act - never why', tone: 'border-red-600 bg-red-50 text-red-900' },
    { value: 'NEEDS_REVIEW', label: 'Hold', next: 'Decide later, e.g. after speaking to the client', tone: 'border-amber-500 bg-amber-50 text-amber-900' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="rounded-none sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
            Review request
          </DialogTitle>
          <DialogDescription className="text-xs">
            {bookingNumber} · {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="border border-neutral-200 bg-neutral-50 px-3 py-2.5 space-y-1">
          <p className="text-sm font-semibold text-neutral-900 wrap-break-word">{subject}</p>
          <p className="text-xs leading-relaxed text-neutral-600 whitespace-pre-line wrap-break-word max-h-40 overflow-y-auto">
            {description}
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide">Can your practice act?</legend>
          <div className="grid gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOutcome(o.value)}
                aria-pressed={outcome === o.value}
                className={`flex flex-col items-start gap-0.5 border-2 px-3 py-2.5 text-left transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  outcome === o.value ? o.tone : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <span className="text-sm font-semibold">{o.label}</span>
                <span className="text-[11px] text-neutral-500">{o.next}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {outcome === 'CLEAR' && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span>I have checked that my practice does not act, and has not acted, for the other side.</span>
          </label>
        )}

        {outcome === 'CONFLICT_FOUND' && (
          <p className="text-[11px] text-red-700">
            This cannot be undone. The client will be emailed that your practice cannot act.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="cc-notes" className="text-xs font-bold uppercase tracking-wide">
            Note {needsNote ? <span className="text-red-600">*</span> : <span className="font-normal normal-case text-neutral-400">(optional)</span>}
          </Label>
          <Textarea
            id="cc-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={needsNote ? 'Why your practice cannot act - for your own record.' : 'Anything your practice should remember.'}
            className="rounded-none"
          />
          <p className="flex items-start gap-1.5 text-[11px] text-neutral-500">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            Private to your practice. The client never sees it.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !ready}
            className={`rounded-none ${outcome === 'CONFLICT_FOUND' ? 'bg-red-700 text-white hover:bg-red-800' : ''}`}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {outcome === 'CLEAR' ? 'Accept' : outcome === 'CONFLICT_FOUND' ? 'Decline request' : outcome === 'NEEDS_REVIEW' ? 'Put on hold' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConflictCheckDialog;
