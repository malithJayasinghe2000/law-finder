'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, UserCheck, Info, ShieldCheck } from 'lucide-react';

type Attorney = {
  profileId: string;
  fullName: string;
  practiceAreas: string[];
  isVerified: boolean;
  firmRole: string;
  title: string | null;
  isCurrent: boolean;
};

/**
 * Move a matter to another attorney at the same firm.
 *
 * Only the firm decides this. The list below is alphabetical and carries no
 * workload figures, no seniority ordering, and no suggestion — if the software
 * nudged the choice it would be making a professional decision that belongs to
 * the practice. See docs/restructure/LEGAL-GUARDRAILS.md (rule 4).
 */
export function AssignMatterDialog({
  bookingId,
  bookingNumber,
  clientName,
  open,
  onOpenChange,
  onAssigned,
}: {
  bookingId: string;
  bookingNumber: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}) {
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setSelected(null);
    setNote('');

    fetch(`/api/consultations/bookings/${bookingId}/assign`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load the firm\'s attorneys.');
        setAttorneys(data.attorneys || []);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, bookingId]);

  const handleSubmit = async () => {
    if (!selected) {
      toast.error('Choose which attorney should take this matter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attorneyProfileId: selected, note: note || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reassign this matter.');

      toast.success(`${bookingNumber} is now with ${data.booking.lawyerName}.`);
      onAssigned();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-none max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" />
            Assign an attorney
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Choose which attorney at your firm will act on {clientName}&apos;s matter
            ({bookingNumber}).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-none border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              The client engaged <strong>the firm</strong>, so the firm decides who acts.
              The client is told who has been assigned, and their agreed fee and scope do
              not change. A matter can never be moved to an attorney outside this firm.
            </span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : attorneys.length === 0 ? (
          <p className="py-6 text-center text-xs text-neutral-500">
            There are no other attorneys at your firm yet. Add one under Firm &rarr; Members.
          </p>
        ) : (
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Attorneys at this firm
            </Label>
            <p className="text-[10px] text-neutral-400">Listed alphabetically.</p>

            <div className="space-y-1.5">
              {attorneys.map((a) => (
                <button
                  key={a.profileId}
                  type="button"
                  disabled={a.isCurrent}
                  onClick={() => setSelected(a.profileId)}
                  className={`w-full rounded-none border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected === a.profileId
                      ? 'border-neutral-900 bg-neutral-50'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {a.fullName}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                        {a.title || (a.firmRole === 'FIRM_OWNER' ? 'Principal' : 'Attorney-at-Law')}
                        {a.practiceAreas.length > 0 && ` · ${a.practiceAreas.slice(0, 2).join(', ')}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {a.isCurrent && (
                        <Badge variant="secondary" className="rounded-none text-[9px]">
                          Currently assigned
                        </Badge>
                      )}
                      {a.isVerified && (
                        <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-neutral-400">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="assign-note" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                Internal note <span className="font-normal normal-case tracking-normal text-neutral-400">(optional)</span>
              </Label>
              <Textarea
                id="assign-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Why this attorney is taking it - kept inside the firm."
                className="rounded-none text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="rounded-none"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="rounded-none"
            onClick={handleSubmit}
            disabled={submitting || loading || !selected}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign matter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
