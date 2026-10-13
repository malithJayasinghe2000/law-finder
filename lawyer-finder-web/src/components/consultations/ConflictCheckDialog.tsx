'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShieldCheck, X, Plus, Loader2, Lock } from 'lucide-react';

type Outcome = 'CLEAR' | 'CONFLICT_FOUND' | 'NEEDS_REVIEW';

/**
 * Conflict-of-interest screening, run by the firm before it accepts a client.
 *
 * A firm must not act where it holds a conflicting interest. Everything captured
 * here is firm-internal and privileged — the client never sees the parties
 * screened or the notes, and a conflict outcome tells them only that the firm
 * cannot act. See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
 */
export function ConflictCheckDialog({
  bookingId,
  bookingNumber,
  clientName,
  open,
  onOpenChange,
  onCompleted,
}: {
  bookingId: string;
  bookingNumber: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [partyInput, setPartyInput] = useState('');
  const [screenedParties, setScreenedParties] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function addParty() {
    const v = partyInput.trim();
    if (!v) return;
    if (screenedParties.includes(v)) {
      toast.error('That party is already on the list');
      return;
    }
    setScreenedParties((p) => [...p, v]);
    setPartyInput('');
  }

  function reset() {
    setOutcome(null);
    setPartyInput('');
    setScreenedParties([]);
    setNotes('');
  }

  async function submit() {
    if (!outcome) {
      toast.error('Select an outcome for the conflict check');
      return;
    }
    if (outcome !== 'CLEAR' && !notes.trim()) {
      toast.error('Record why the firm cannot act — this is kept internal to your firm');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/conflict-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, screenedParties, notes: notes.trim() || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error?.message || data.error || 'Could not record the conflict check');
        return;
      }

      toast.success(
        outcome === 'CLEAR'
          ? 'Conflict check cleared — you can now quote a fee'
          : 'Request declined. The client has been told only that your firm cannot act.'
      );
      reset();
      onOpenChange(false);
      onCompleted();
    } catch {
      toast.error('Could not record the conflict check');
    } finally {
      setSubmitting(false);
    }
  }

  const OUTCOMES: { value: Outcome; label: string; hint: string; tone: string }[] = [
    { value: 'CLEAR', label: 'No conflict', hint: 'The firm is free to act', tone: 'border-green-500 bg-green-50 text-green-900' },
    { value: 'CONFLICT_FOUND', label: 'Conflict found', hint: 'The firm cannot act', tone: 'border-red-500 bg-red-50 text-red-900' },
    { value: 'NEEDS_REVIEW', label: 'Unresolved', hint: 'On hold — check again before quoting', tone: 'border-amber-500 bg-amber-50 text-amber-900' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-wider">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Conflict check
          </DialogTitle>
          <DialogDescription className="text-xs">
            {bookingNumber} · {clientName}
          </DialogDescription>
        </DialogHeader>

        {/* Explains the step. Without this the screen reads as unexplained
            paperwork — the first thing a real user asked about. */}
        <div className="space-y-2 border border-neutral-200 bg-neutral-50 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-neutral-600">
            <strong className="text-neutral-800">Why this step exists.</strong> You
            cannot act for a client where your firm has a competing loyalty — for
            example if you already act for the other side, or advised them in the
            past. Checking before you take the client is a professional duty.
          </p>
          <p className="text-[11px] leading-relaxed text-neutral-600">
            <strong className="text-neutral-800">What to enter below.</strong> The
            names of the people or companies on the <em>other side</em> of this
            matter, then check them against your existing and former clients.
          </p>
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-neutral-500">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            Everything here stays inside your firm. The client never sees the names
            you screened or your notes — only whether you are able to act.
          </p>
        </div>

        <div className="space-y-4 py-1">
          {/* Parties screened */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide">
              Parties screened
            </Label>
            <p className="-mt-1 text-[11px] text-neutral-500">
              Who is on the other side? Add each name, then check them against your
              client records.
            </p>
            <div className="flex gap-2">
              <Input
                value={partyInput}
                onChange={(e) => setPartyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addParty(); }
                }}
                placeholder="e.g. Perera Holdings (Pvt) Ltd"
                className="rounded-none"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addParty}
                className="shrink-0 rounded-none"
                aria-label="Add party"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {screenedParties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {screenedParties.map((p) => (
                  <Badge key={p} variant="outline" className="rounded-none gap-1 pr-1 text-[11px]">
                    {p}
                    <button
                      type="button"
                      onClick={() => setScreenedParties((s) => s.filter((x) => x !== p))}
                      className="ml-0.5 rounded-sm p-0.5 hover:bg-neutral-200"
                      aria-label={`Remove ${p}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Outcome */}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide">Outcome</legend>
            <div className="grid gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  aria-pressed={outcome === o.value}
                  className={`flex items-center justify-between border-2 px-3 py-2.5 text-left transition-colors ${
                    outcome === o.value ? o.tone : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <span className="text-sm font-semibold">{o.label}</span>
                  <span className="text-[11px] text-neutral-500">{o.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="cc-notes" className="text-xs font-bold uppercase tracking-wide">
              Internal notes {outcome && outcome !== 'CLEAR' && <span className="text-red-600">*</span>}
            </Label>
            <Textarea
              id="cc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Your reasoning. Never shown to the client."
              className="rounded-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !outcome} className="rounded-none">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConflictCheckDialog;
