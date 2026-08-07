'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Megaphone, Plus, Search, ShieldCheck, ShieldAlert, Loader2, AlertTriangle, Info,
} from 'lucide-react';
import {
  ADVERTISER_CATEGORY_LABELS,
} from '@/schemas/advertiser.schema';

/**
 * Advertisers.
 *
 * Advertising is sold to non-legal organisations only. An attorney may not
 * advertise, so selling one visibility would make this platform the mechanism
 * of their breach — and touting reaches the intermediary as a criminal matter
 * under the Intermeddlers with Suitors Ordinance No. 11 of 1894.
 *
 * The review step below is the whole protection. It is deliberately not a
 * one-click status change: the reviewer has to positively confirm that this
 * organisation neither practises law nor sells legal services, and that
 * confirmation is stored against their name.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 3).
 */

interface Advertiser {
  id: string;
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  category: keyof typeof ADVERTISER_CATEGORY_LABELS;
  status: string;
  contactName: string | null;
  contactEmail: string;
  contactPhone: string | null;
  websiteUrl: string | null;
  nonLegalConfirmed: boolean;
  nonLegalConfirmedAt: string | null;
  reviewNotes: string | null;
  isActive: boolean;
  campaignCount: number;
  flaggedTerms: string[];
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-neutral-200 text-neutral-700',
  REJECTED: 'bg-red-100 text-red-800',
};

const FILTERS = ['PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;

export default function AdvertisersPage() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [reviewing, setReviewing] = useState<Advertiser | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (search) qs.set('search', search);

    fetch(`/api/admin/advertisers?${qs}`)
      .then((r) => r.json())
      .then((d) => setAdvertisers(d.advertisers || []))
      .catch(() => toast.error('Could not load advertisers.'))
      .finally(() => setLoading(false));
  }, [status, search]);

  useEffect(load, [load]);

  return (
    <div className="space-y-5 p-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl text-neutral-900">Advertisers</h1>
          <p className="mt-1 text-xs text-neutral-500">
            Organisations that buy advertising space. Non-legal only.
          </p>
        </div>
        <Button className="w-fit rounded-none" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add advertiser
        </Button>
      </div>

      <div className="flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          No attorney, law firm or seller of legal services may advertise here — that
          includes legal consultancies, claims-management companies, document-drafting
          services and legal-expenses insurers. Adverts appear only on editorial pages;
          the directory and profile pages cannot be sold at any price.
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                status === f
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="rounded-none pl-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-none" />)}
        </div>
      ) : advertisers.length === 0 ? (
        <Card className="rounded-none">
          <CardContent className="p-10 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500">No advertisers with this status.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {advertisers.map((a) => (
            <Card key={a.id} className="rounded-none">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-serif text-lg text-neutral-900">{a.name}</h2>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {ADVERTISER_CATEGORY_LABELS[a.category] ?? a.category}
                      {a.legalName && ` · ${a.legalName}`}
                      {a.registrationNumber && ` · Reg. ${a.registrationNumber}`}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {a.contactEmail}
                      {a.contactPhone && ` · ${a.contactPhone}`}
                      {a.websiteUrl && ` · ${a.websiteUrl.replace(/^https?:\/\//, '')}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge className={`rounded-none text-[10px] uppercase tracking-widest ${STATUS_STYLE[a.status] ?? ''}`}>
                      {a.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-[10px] text-neutral-400">
                      {a.campaignCount} {a.campaignCount === 1 ? 'campaign' : 'campaigns'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
                  {a.nonLegalConfirmed ? (
                    <span className="flex items-center gap-1.5 text-green-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Confirmed not a legal-services provider
                      {a.nonLegalConfirmedAt &&
                        ` · ${new Date(a.nonLegalConfirmedAt).toLocaleDateString('en-GB')}`}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Not yet confirmed — campaigns cannot run
                    </span>
                  )}
                </div>

                {a.flaggedTerms.length > 0 && (
                  <p className="mt-3 flex items-start gap-2 border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Their own details mention: <strong>{a.flaggedTerms.join(', ')}</strong>.
                      Check carefully before approving — this is what a legal-services
                      provider looks like.
                    </span>
                  </p>
                )}

                {a.reviewNotes && (
                  <p className="mt-3 border-l-2 border-neutral-200 pl-3 text-[11px] italic text-neutral-500">
                    {a.reviewNotes}
                  </p>
                )}

                <Button
                  size="sm"
                  className="mt-4 rounded-none"
                  onClick={() => setReviewing(a)}
                >
                  Record a decision
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddAdvertiserDialog open={addOpen} onOpenChange={setAddOpen} onAdded={load} />
      <ReviewDialog
        advertiser={reviewing}
        onOpenChange={(v) => !v && setReviewing(null)}
        onDecided={() => { setReviewing(null); load(); }}
      />
    </div>
  );
}

function AddAdvertiserDialog({
  open, onOpenChange, onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<string>('BANKING_FINANCE');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/advertisers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          legalName: fd.get('legalName') || '',
          registrationNumber: fd.get('registrationNumber') || '',
          category,
          contactName: fd.get('contactName') || '',
          contactEmail: fd.get('contactEmail'),
          contactPhone: fd.get('contactPhone') || '',
          websiteUrl: fd.get('websiteUrl') || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Some details need correcting.'
        );
      }
      toast.success('Advertiser added. They must be reviewed before any campaign runs.');
      onAdded();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Add an advertiser</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Capture enough to establish who they actually are. They start awaiting
            review and cannot run a campaign until someone confirms they are not a
            legal-services provider.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="adv-name" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Trading name</Label>
              <Input id="adv-name" name="name" required className="rounded-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-legal" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Registered legal name</Label>
              <Input id="adv-legal" name="legalName" className="rounded-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-reg" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Company registration no.</Label>
              <Input id="adv-reg" name="registrationNumber" className="rounded-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-cat" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Sector</Label>
              <select
                id="adv-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-none border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
              >
                {Object.entries(ADVERTISER_CATEGORY_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-cname" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Contact name</Label>
              <Input id="adv-cname" name="contactName" className="rounded-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-email" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Contact email</Label>
              <Input id="adv-email" name="contactEmail" type="email" required className="rounded-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-phone" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Contact phone</Label>
              <Input id="adv-phone" name="contactPhone" className="rounded-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-web" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Website</Label>
              <Input id="adv-web" name="websiteUrl" placeholder="https://" className="rounded-none" />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-none">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add advertiser
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  advertiser, onOpenChange, onDecided,
}: {
  advertiser: Advertiser | null;
  onOpenChange: (v: boolean) => void;
  onDecided: () => void;
}) {
  const [decision, setDecision] = useState<'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'PENDING_REVIEW'>('ACTIVE');
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (advertiser) {
      setDecision('ACTIVE');
      setConfirmed(advertiser.nonLegalConfirmed);
      setNotes('');
    }
  }, [advertiser]);

  const submit = async () => {
    if (!advertiser) return;
    if (decision === 'ACTIVE' && !confirmed) {
      toast.error('Confirm they are not a legal-services provider before approving.');
      return;
    }
    if (decision === 'REJECTED' && !notes.trim()) {
      toast.error('Give a reason when refusing an advertiser.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/advertisers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          advertiserId: advertiser.id,
          decision,
          nonLegalConfirmed: decision === 'ACTIVE' ? confirmed : false,
          reviewNotes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not record that.');
      }
      toast.success('Decision recorded.');
      onDecided();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!advertiser} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{advertiser?.name}</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Establish who this organisation is and what it sells before letting it
            advertise beside legal content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            {([
              ['ACTIVE', 'Approve', 'They may run campaigns.'],
              ['SUSPENDED', 'Suspend', 'Pause them and stop live campaigns.'],
              ['REJECTED', 'Refuse', 'Say why. They see the reason.'],
              ['PENDING_REVIEW', 'Need more information', 'Waiting on them.'],
            ] as const).map(([value, label, help]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDecision(value)}
                className={`w-full border p-3 text-left transition-colors ${
                  decision === value ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
                }`}
              >
                <span className="block text-sm font-semibold text-neutral-900">{label}</span>
                <span className="block text-[10px] text-neutral-500">{help}</span>
              </button>
            ))}
          </div>

          {decision === 'ACTIVE' && (
            <label className="flex cursor-pointer items-start gap-2.5 border border-amber-300 bg-amber-50 p-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span className="text-[11px] leading-relaxed text-amber-900">
                <strong>I have checked and confirm</strong> this organisation is not an
                attorney or law firm, and does not sell legal services, legal advice,
                claims handling, document drafting or legal-expenses insurance.
                <br />
                <span className="text-amber-700">
                  This is recorded against your account with today&apos;s date.
                </span>
              </span>
            </label>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="adv-notes" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Notes {decision === 'REJECTED' && <span className="text-red-600">(required)</span>}
            </Label>
            <Textarea
              id="adv-notes"
              value={notes}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-none text-sm"
              placeholder="What you checked — registration, website, what they actually sell."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-none" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
