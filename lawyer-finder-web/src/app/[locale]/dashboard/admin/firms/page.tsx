'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
  Building2, Search, ShieldCheck, ShieldX, Loader2, Lock, MapPin, Users,
} from 'lucide-react';

/**
 * Firm verification.
 *
 * Verifying a firm confirms the practice exists at the address it claims and
 * that its principal is an admitted Attorney-at-Law. It is separate from the
 * per-attorney BASL check on the verification screen next door.
 *
 * Note what is shown: registration details, offices, members, and a *count* of
 * matters. Never a matter, never a client, never a subject line — platform staff
 * cannot read privileged material and this screen is not an exception.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
 */

interface FirmMemberRow {
  role: string;
  title: string | null;
  user: {
    fullName: string | null;
    email: string;
    profile: { fullName: string; baslNumber: string; isVerified: boolean } | null;
  };
}

interface FirmRow {
  id: string;
  slug: string;
  name: string;
  firmType: string;
  isSoloPractice: boolean;
  registrationNumber: string | null;
  principalBaslNumber: string | null;
  district: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  establishedYear: number | null;
  verificationStatus: string;
  listing: Listing;
  verificationNotes: string | null;
  createdAt: string;
  attorneyCount: number;
  matterCount: number;
  offices: { label: string; address: string; district: string | null; isPrimary: boolean }[];
  members: FirmMemberRow[];
}

type Listing = 'LISTED' | 'WAITING' | 'NOT_VERIFIED' | 'NOT_REGISTERED' | 'INACTIVE';

/** Whether a client can find the practice, and if not, why. Worked out on the server. */
const LISTING: Record<Listing, { badge: string; style: string; line: string }> = {
  LISTED: { badge: 'Listed', style: 'bg-green-100 text-green-800', line: 'Registered and verified. Shown in the public directory.' },
  WAITING: { badge: 'Waiting for check', style: 'bg-amber-100 text-amber-800', line: 'Registered. Not listed until you verify it.' },
  NOT_VERIFIED: { badge: 'Not verified', style: 'bg-red-100 text-red-800', line: 'Registered, but verification was not granted. Not listed.' },
  NOT_REGISTERED: { badge: 'Not registered', style: 'bg-neutral-200 text-neutral-700', line: 'Never registered as a practice, so there is nothing to verify. Not listed.' },
  INACTIVE: { badge: 'Inactive', style: 'bg-neutral-200 text-neutral-700', line: 'Deactivated. Not listed.' },
};

const ROLE_LABELS: Record<string, string> = {
  FIRM_OWNER: 'Principal',
  FIRM_ADMIN: 'Practice manager',
  ATTORNEY: 'Attorney-at-Law',
  PARALEGAL: 'Support staff',
};

const VIEWS = [
  ['waiting', 'Waiting for check'],
  ['listed', 'Listed'],
  ['not-verified', 'Not verified'],
  ['not-registered', 'Not registered'],
  ['all', 'All'],
] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function AdminFirmsPage() {
  const [firms, setFirms] = useState<FirmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { locale } = useParams();
  const [view, setView] = useState<string>('waiting');
  const [directoryOn, setDirectoryOn] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [decisionFor, setDecisionFor] = useState<FirmRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('view', view);
    if (search) qs.set('search', search);
    qs.set('page', String(page));

    fetch(`/api/admin/firms?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setFirms(d.firms || []);
        setDirectoryOn(d.directoryOn !== false);
        setTotalPages(d.pagination?.totalPages || 1);
      })
      .catch(() => toast.error('Could not load firms.'))
      .finally(() => setLoading(false));
  }, [view, search, page]);

  useEffect(load, [load]);

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="font-serif text-2xl text-neutral-900">Law firms</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Confirm a practice exists as it claims. This is separate from verifying an
          individual attorney&apos;s BASL registration.
        </p>
      </div>

      <div className="flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Matter counts are shown; matters are not. Platform staff cannot read a
          client&apos;s account of their legal problem, and there is no way to do so from
          this screen.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setView(v); setPage(1); }}
              className={`border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                view === v
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by firm name"
            className="rounded-none pl-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-none" />)}
        </div>
      ) : firms.length === 0 ? (
        <Card className="rounded-none">
          <CardContent className="p-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500">No practices here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {firms.map((f) => (
            <Card key={f.id} className="rounded-none">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-serif text-lg text-neutral-900">{f.name}</h2>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {f.isSoloPractice ? 'Sole practitioner' : 'Partnership'}
                      {f.district && ` · ${f.district}`}
                      {f.establishedYear && ` · est. ${f.establishedYear}`}
                    </p>
                  </div>
                  <Badge className={`w-fit shrink-0 rounded-none text-[10px] uppercase tracking-widest ${LISTING[f.listing].style}`}>
                    {LISTING[f.listing].badge}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-neutral-700">
                  {LISTING[f.listing].line}
                  {f.listing === 'LISTED' && !directoryOn && ' The directory is switched off for everyone at the moment.'}
                </p>

                <div className="mt-4 grid gap-4 text-[11px] sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="font-bold uppercase tracking-widest text-neutral-400">Registration</p>
                    <p className="text-neutral-700">
                      Firm no. {f.registrationNumber || '—'}<br />
                      Principal BASL no. {f.principalBaslNumber || '—'}
                    </p>
                    <p className="text-neutral-500">
                      {f.contactEmail || '—'}{f.contactPhone ? ` · ${f.contactPhone}` : ''}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-neutral-400">
                      <MapPin className="h-3 w-3" /> Offices
                    </p>
                    {f.offices.length === 0 ? (
                      <p className="text-neutral-400">None recorded</p>
                    ) : (
                      f.offices.map((o, i) => (
                        <p key={i} className="text-neutral-700">
                          {o.label}: {o.address}
                          {o.isPrimary && <span className="text-neutral-400"> (registered)</span>}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-[11px]">
                  <p className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-neutral-400">
                    <Users className="h-3 w-3" /> Members ({plural(f.attorneyCount, 'attorney', 'attorneys')} · {plural(f.matterCount, 'matter', 'matters')} on record)
                  </p>
                  {f.members.map((m, i) => (
                    <p key={i} className="text-neutral-700">
                      {/* An attorney by their registered name: an account name can be anything (Kavindu's is "None"). */}
                      {m.user.profile?.fullName || m.user.fullName || m.user.email} — {ROLE_LABELS[m.role] ?? m.role}
                      {m.user.profile?.baslNumber && ` · ${m.user.profile.baslNumber}`}
                      {m.user.profile && !m.user.profile.isVerified && (
                        <span className="text-amber-700"> · attorney not yet verified</span>
                      )}
                    </p>
                  ))}
                </div>

                {f.verificationNotes && (
                  <p className="mt-3 border-l-2 border-neutral-200 pl-3 text-[11px] italic text-neutral-500">
                    {f.verificationNotes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {/* The server refuses a decision on a practice that never registered. */}
                  {f.listing !== 'NOT_REGISTERED' && (
                    <Button
                      size="sm" className="rounded-none"
                      onClick={() => setDecisionFor(f)}
                    >
                      Record a decision
                    </Button>
                  )}
                  {/* Any other firm's public page is a 404. */}
                  {f.listing === 'LISTED' && directoryOn && (
                    <a
                      href={`/${locale}/firms/${f.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center border border-neutral-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-600 hover:border-neutral-400"
                    >
                      View public page
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm" variant="outline" className="rounded-none"
            disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-neutral-500">Page {page} of {totalPages}</span>
          <Button
            size="sm" variant="outline" className="rounded-none"
            disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <VerificationDialog
        firm={decisionFor}
        onOpenChange={(v) => !v && setDecisionFor(null)}
        onDecided={() => { setDecisionFor(null); load(); }}
      />
    </div>
  );
}

function VerificationDialog({
  firm, onOpenChange, onDecided,
}: {
  firm: FirmRow | null;
  onOpenChange: (v: boolean) => void;
  onDecided: () => void;
}) {
  const [decision, setDecision] = useState<'VERIFIED' | 'REJECTED' | 'PENDING'>('VERIFIED');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (firm) { setDecision('VERIFIED'); setNotes(''); }
  }, [firm]);

  const submit = async () => {
    if (!firm) return;
    if (decision === 'REJECTED' && !notes.trim()) {
      toast.error('Give a reason — the firm is entitled to know why.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/firms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId: firm.id, decision, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not record that.');
      }
      toast.success('Decision recorded. The principal and practice manager will be emailed.');
      onDecided();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!firm} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{firm?.name}</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Verify that this practice exists at the address it gives and that its
            principal is an admitted Attorney-at-Law.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            {([
              ['VERIFIED', 'Verified', 'The practice and its principal check out.', ShieldCheck],
              ['REJECTED', 'Not verified', 'Something does not check out. Say what.', ShieldX],
              ['PENDING', 'Needs more information', 'Waiting on the firm.', Loader2],
            ] as const).map(([value, label, help, Icon]) => (
              <button
                key={value} type="button" onClick={() => setDecision(value)}
                className={`flex w-full items-start gap-2.5 border p-3 text-left transition-colors ${
                  decision === value ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
                }`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold text-neutral-900">{label}</span>
                  <span className="block text-[10px] text-neutral-500">{help}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="verify-notes" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Notes {decision === 'REJECTED' && <span className="text-red-600">(required)</span>}
            </Label>
            <Textarea
              id="verify-notes" value={notes} rows={3}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-none text-sm"
              placeholder="What you checked, or what is missing. The practice is emailed this note."
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
