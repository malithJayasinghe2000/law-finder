'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Building2, Users, MapPin, ShieldCheck, Info, Loader2, Plus, Lock, Landmark, Clock,
} from 'lucide-react';
import { DISTRICTS, PRACTICE_AREAS, LANGUAGES } from '@/schemas/profile.schema';

/**
 * The firm console.
 *
 * A solo practitioner has a firm whether they asked for one or not — it is
 * created when their application is approved. This page therefore opens with an
 * explanation rather than a form, because "why do I have a firm?" is the first
 * question a sole practitioner will have, and an unexplained screen is a bug in
 * the screen.
 *
 * Nothing here may carry a fee indication, a rating, or any promotional claim:
 * the firm profile is a public surface bound by the Rule 40 content limit.
 * See docs/restructure/LEGAL-GUARDRAILS.md.
 */

interface FirmMember {
  id: string;
  role: string;
  status: string;
  title: string | null;
  joinedAt: string;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    profileImageUrl: string | null;
    profile: { id: string; baslNumber: string; isVerified: boolean } | null;
  };
}

interface FirmOffice {
  id: string;
  label: string;
  address: string;
  district: string | null;
  contactPhone: string | null;
  isPrimary: boolean;
}

interface Firm {
  id: string;
  slug: string;
  name: string;
  firmType: string;
  isSoloPractice: boolean;
  registrationNumber: string | null;
  principalBaslNumber: string | null;
  establishedYear: number | null;
  description: string | null;
  practiceAreas: string[];
  languages: string[];
  courts: string[];
  district: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  officeHours: string | null;
  verificationStatus: string;
  verificationNotes: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  bankBranch: string | null;
  members: FirmMember[];
  offices: FirmOffice[];
}

const ROLE_LABELS: Record<string, string> = {
  FIRM_OWNER: 'Principal',
  FIRM_ADMIN: 'Practice manager',
  ATTORNEY: 'Attorney-at-Law',
  PARALEGAL: 'Support staff',
};

const ROLE_ACCESS_NOTE: Record<string, string> = {
  FIRM_OWNER: 'Sees every matter at the firm and can reassign them.',
  FIRM_ADMIN: 'Sees every matter at the firm and can reassign them, but does not quote or run conflict checks.',
  ATTORNEY: 'Sees the detail of matters assigned to them. Other matters appear without the client\'s description.',
  PARALEGAL: 'Sees that matters exist, never what they are about.',
};

const VERIFICATION_STYLE: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  UNVERIFIED: 'bg-neutral-200 text-neutral-700',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function FirmPage() {
  const [firm, setFirm] = useState<Firm | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [officeDialogOpen, setOfficeDialogOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/firms/me')
      .then((r) => r.json())
      .then((d) => {
        setFirm(d.firm);
        setCanManage(!!d.membership?.canManageFirm);
      })
      .catch(() => toast.error('Could not load your firm.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firm) return;

    const fd = new FormData(e.currentTarget);
    setSaving(true);

    try {
      const res = await fetch('/api/firms/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          firmType: firm.firmType,
          registrationNumber: fd.get('registrationNumber') || '',
          establishedYear: fd.get('establishedYear')
            ? parseInt(String(fd.get('establishedYear')), 10)
            : null,
          description: fd.get('description') || '',
          practiceAreas: fd.getAll('practiceAreas').map(String),
          languages: fd.getAll('languages').map(String),
          courts: firm.courts,
          district: fd.get('district') || '',
          contactEmail: fd.get('contactEmail') || '',
          contactPhone: fd.get('contactPhone') || '',
          websiteUrl: fd.get('websiteUrl') || '',
          officeHours: fd.get('officeHours') || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Some details need correcting.'
        );
      }

      toast.success('Firm details saved.');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveBank = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);

    try {
      const res = await fetch('/api/firms/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'bank',
          bankName: fd.get('bankName') || '',
          accountName: fd.get('accountName') || '',
          accountNumber: fd.get('accountNumber') || '',
          bankBranch: fd.get('bankBranch') || '',
        }),
      });
      if (!res.ok) throw new Error('Could not save the account details.');
      toast.success('Client account details saved.');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-28 w-full rounded-none" />
        <Skeleton className="h-64 w-full rounded-none" />
      </div>
    );
  }

  if (!firm) {
    return (
      <Card className="rounded-none">
        <CardContent className="p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm text-neutral-600">
            Your account is not linked to a firm yet. This is set up automatically when
            an attorney application is approved — contact support if you think this is
            wrong.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl text-neutral-900">{firm.name}</h1>
          <p className="mt-1 text-xs text-neutral-500">
            {firm.isSoloPractice ? 'Sole practitioner' : 'Partnership'}
            {firm.district && ` · ${firm.district}`}
          </p>
        </div>
        <Badge
          className={`w-fit rounded-none text-[10px] uppercase tracking-widest ${
            VERIFICATION_STYLE[firm.verificationStatus] ?? ''
          }`}
        >
          {firm.verificationStatus === 'VERIFIED' ? 'Verified firm' : firm.verificationStatus}
        </Badge>
      </div>

      {/* Why does a solo practitioner have a firm? Answer it before they ask. */}
      {firm.isSoloPractice && (
        <div className="flex items-start gap-3 border border-neutral-200 bg-neutral-50 p-4 text-[12px] leading-relaxed text-neutral-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold text-neutral-800">
              You practise as a firm of one. Nothing has changed for you.
            </p>
            <p className="mt-1">
              Clients engage <strong>your practice</strong>, not this platform — so every
              engagement letter, quote and fee note names your practice as the provider
              of legal services. If you later take on another attorney or an assistant,
              you can add them here and share the workload without moving anything.
            </p>
          </div>
        </div>
      )}

      {firm.verificationStatus === 'REJECTED' && firm.verificationNotes && (
        <div className="border border-red-200 bg-red-50 p-4 text-[12px] text-red-800">
          <p className="font-semibold">Verification was not granted</p>
          <p className="mt-1">{firm.verificationNotes}</p>
        </div>
      )}

      {/* Public profile */}
      <Card className="rounded-none">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800">
              Public profile
            </h2>
          </div>

          <p className="mb-5 border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
            What may appear here is limited by the professional conduct rules: your
            practice name, qualifications, office hours, contact details and the areas
            you practise in. Fees, ratings and promotional claims are not permitted on a
            public listing, so there is nowhere to enter them.
          </p>

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Firm name
                </Label>
                <Input
                  id="name" name="name" defaultValue={firm.name}
                  disabled={!canManage} className="rounded-none" required
                />
                <p className="text-[10px] text-neutral-400">
                  A firm may only practise under the name of a member or past member.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="district" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Principal district
                </Label>
                <select
                  id="district" name="district" defaultValue={firm.district || ''}
                  disabled={!canManage}
                  className="w-full rounded-none border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-50"
                >
                  <option value="">Select</option>
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="registrationNumber" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Firm registration number
                </Label>
                <Input
                  id="registrationNumber" name="registrationNumber"
                  defaultValue={firm.registrationNumber || ''}
                  disabled={!canManage} className="rounded-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="establishedYear" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Established
                </Label>
                <Input
                  id="establishedYear" name="establishedYear" type="number"
                  defaultValue={firm.establishedYear ?? ''}
                  disabled={!canManage} className="rounded-none" placeholder="1998"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contactPhone" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Contact telephone
                </Label>
                <Input
                  id="contactPhone" name="contactPhone" defaultValue={firm.contactPhone || ''}
                  disabled={!canManage} className="rounded-none" placeholder="0112345678"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contactEmail" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Contact email
                </Label>
                <Input
                  id="contactEmail" name="contactEmail" type="email"
                  defaultValue={firm.contactEmail || ''}
                  disabled={!canManage} className="rounded-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="websiteUrl" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Website
                </Label>
                <Input
                  id="websiteUrl" name="websiteUrl" defaultValue={firm.websiteUrl || ''}
                  disabled={!canManage} className="rounded-none" placeholder="https://"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="officeHours" className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  <Clock className="h-3 w-3" /> Office hours
                </Label>
                <Input
                  id="officeHours" name="officeHours" defaultValue={firm.officeHours || ''}
                  disabled={!canManage} className="rounded-none"
                  placeholder="Mon–Fri 9.00am–5.00pm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                About the practice
              </Label>
              <Textarea
                id="description" name="description" rows={3}
                defaultValue={firm.description || ''}
                disabled={!canManage} className="rounded-none text-sm"
                placeholder="A factual description of the practice and the work it does."
              />
              <p className="text-[10px] text-neutral-400">
                Keep this factual. Claims of superiority, success rates and testimonials
                are not permitted.
              </p>
            </div>

            <fieldset className="space-y-2" disabled={!canManage}>
              <legend className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                Practice areas
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {PRACTICE_AREAS.map((a) => (
                  <label key={a} className="cursor-pointer">
                    <input
                      type="checkbox" name="practiceAreas" value={a}
                      defaultChecked={firm.practiceAreas.includes(a)}
                      className="peer sr-only"
                    />
                    <span className="inline-block border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-600 peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white">
                      {a}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2" disabled={!canManage}>
              <legend className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                Languages
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((l) => (
                  <label key={l} className="cursor-pointer">
                    <input
                      type="checkbox" name="languages" value={l}
                      defaultChecked={firm.languages.includes(l)}
                      className="peer sr-only"
                    />
                    <span className="inline-block border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-600 peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white">
                      {l}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {canManage && (
              <Button type="submit" disabled={saving} className="rounded-none">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save firm details
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="rounded-none">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800">
                Members
              </h2>
            </div>
            {canManage && (
              <Button
                size="sm" variant="outline" className="rounded-none"
                onClick={() => setMemberDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add member
              </Button>
            )}
          </div>

          <p className="mb-4 flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Everyone you add here can see something about your clients&apos; matters.
              What each role can read is fixed and shown below — a client&apos;s account of
              their problem is privileged, so it is shared as narrowly as the work allows.
            </span>
          </p>

          <div className="space-y-2">
            {firm.members.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-2 border border-neutral-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {m.user.fullName || m.user.email}
                    {m.user.profile?.isVerified && (
                      <ShieldCheck className="ml-1.5 inline h-3.5 w-3.5 text-neutral-400" />
                    )}
                  </p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {m.title || ROLE_LABELS[m.role]}
                    {m.user.profile?.baslNumber && ` · ${m.user.profile.baslNumber}`}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">
                    {ROLE_ACCESS_NOTE[m.role]}
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit shrink-0 rounded-none text-[10px] uppercase tracking-widest">
                  {ROLE_LABELS[m.role]}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Offices */}
      <Card className="rounded-none">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800">
                Offices
              </h2>
            </div>
            {canManage && (
              <Button
                size="sm" variant="outline" className="rounded-none"
                onClick={() => setOfficeDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add office
              </Button>
            )}
          </div>

          {firm.offices.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-500">
              No offices recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {firm.offices.map((o) => (
                <div key={o.id} className="border border-neutral-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">{o.label}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{o.address}</p>
                      {o.contactPhone && (
                        <p className="text-[11px] text-neutral-400">{o.contactPhone}</p>
                      )}
                    </div>
                    {o.isPrimary && (
                      <Badge variant="secondary" className="shrink-0 rounded-none text-[9px] uppercase tracking-widest">
                        Registered
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client account */}
      {canManage && (
        <Card className="rounded-none">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800">
                Client account
              </h2>
            </div>

            <p className="mb-5 flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                These details are printed on the quotes you send, so clients pay
                <strong> your firm directly</strong>. This platform never receives, holds
                or handles client money, and never takes any part of your fee.
              </span>
            </p>

            <form onSubmit={saveBank} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bankName" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Bank</Label>
                <Input id="bankName" name="bankName" defaultValue={firm.bankName || ''} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankBranch" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Branch</Label>
                <Input id="bankBranch" name="bankBranch" defaultValue={firm.bankBranch || ''} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accountName" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Account name</Label>
                <Input id="accountName" name="accountName" defaultValue={firm.accountName || ''} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accountNumber" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Account number</Label>
                <Input id="accountNumber" name="accountNumber" defaultValue={firm.accountNumber || ''} className="rounded-none" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving} className="rounded-none">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save account details
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <AddMemberDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        onAdded={load}
      />
      <AddOfficeDialog
        open={officeDialogOpen}
        onOpenChange={setOfficeDialogOpen}
        onAdded={load}
      />
    </div>
  );
}

function AddMemberDialog({
  open, onOpenChange, onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState('ATTORNEY');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);

    try {
      const res = await fetch('/api/firms/me/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fd.get('email'),
          role,
          title: fd.get('title') || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Could not add that member.'
        );
      }
      toast.success('Member added to the firm.');
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
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add someone to the firm</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            They need an account on the platform already. Adding an attorney moves their
            practice into this firm.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Their email address
            </Label>
            <Input id="email" name="email" type="email" required className="rounded-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Role in the firm
            </Label>
            <div className="space-y-1.5">
              {(['ATTORNEY', 'FIRM_ADMIN', 'PARALEGAL'] as const).map((r) => (
                <button
                  key={r} type="button" onClick={() => setRole(r)}
                  className={`w-full border p-2.5 text-left transition-colors ${
                    role === r ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
                  }`}
                >
                  <p className="text-sm font-semibold text-neutral-900">{ROLE_LABELS[r]}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                    {ROLE_ACCESS_NOTE[r]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Title <span className="font-normal normal-case tracking-normal text-neutral-400">(optional)</span>
            </Label>
            <Input id="title" name="title" className="rounded-none" placeholder="Senior Associate" />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-none">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddOfficeDialog({
  open, onOpenChange, onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);

    try {
      const res = await fetch('/api/firms/me/offices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: fd.get('label'),
          address: fd.get('address'),
          district: fd.get('district') || '',
          contactPhone: fd.get('contactPhone') || '',
          isPrimary: fd.get('isPrimary') === 'on',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Some details need correcting.'
        );
      }
      toast.success('Office added.');
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
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add an office</DialogTitle>
          <DialogDescription className="text-xs">
            Where the firm practises from. Attorneys keep their own calendars.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Name</Label>
            <Input id="label" name="label" required className="rounded-none" placeholder="Colombo (head office)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Address</Label>
            <Textarea id="address" name="address" required rows={2} className="rounded-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="office-district" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">District</Label>
            <select
              id="office-district" name="district"
              className="w-full rounded-none border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              <option value="">Select</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="office-phone" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Telephone</Label>
            <Input id="office-phone" name="contactPhone" className="rounded-none" />
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" name="isPrimary" className="h-3.5 w-3.5" />
            This is the firm&apos;s registered office
          </label>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-none">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add office
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
