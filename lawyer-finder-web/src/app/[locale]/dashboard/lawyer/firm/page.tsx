'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
import SelfPromotionNotice from '@/components/shared/SelfPromotionNotice';

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
    profile: { id: string; fullName: string; baslNumber: string; isVerified: boolean } | null;
  };
}

interface FirmInvitation {
  id: string;
  email: string;
  role: string;
  title: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
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
  isRegisteredPractice: boolean;
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
  taxIdentificationNumber: string | null;
  vatNumber: string | null;
  isVatRegistered: boolean;
  vatRatePercent: number | null;
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

/**
 * An attorney by their profile name first. The account name can be wrong — the
 * seeded principal's account name is the literal string "None" — and the
 * profile name is the one their BASL registration was checked against.
 */
function memberName(m: FirmMember): string {
  return m.user.profile?.fullName || m.user.fullName || m.user.email;
}

const VERIFICATION_LABEL: Record<string, string> = {
  VERIFIED: 'Verified practice',
  PENDING: 'Being checked',
  UNVERIFIED: 'Not verified',
  REJECTED: 'Not granted',
};

const VERIFICATION_STYLE: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  UNVERIFIED: 'bg-neutral-200 text-neutral-700',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function FirmPage() {
  const [firm, setFirm] = useState<Firm | null>(null);
  // Live copy of the description field, for the self-praise notice. null = untouched.
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [canManage, setCanManage] = useState(false);
  // Only the principal may bring people in or change who is in the firm.
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<FirmMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<FirmMember | null>(null);
  const [invitations, setInvitations] = useState<FirmInvitation[]>([]);
  const [officeDialogOpen, setOfficeDialogOpen] = useState(false);
  const [editOffice, setEditOffice] = useState<FirmOffice | null>(null);
  const [retireTarget, setRetireTarget] = useState<FirmOffice | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/firms/me')
      .then((r) => r.json())
      .then((d) => {
        setFirm(d.firm);
        setCanManage(!!d.membership?.canManageFirm);
        setCanManageMembers(!!d.membership?.canManageMembers);
      })
      .catch(() => toast.error('Could not load your firm.'))
      .finally(() => setLoading(false));

    // Outstanding invitations. Separate call because a member who cannot manage
    // the firm has no business seeing who has been asked to join it.
    fetch('/api/firms/me/invitations')
      .then((r) => (r.ok ? r.json() : { invitations: [] }))
      .then((d) => setInvitations(d.invitations ?? []))
      .catch(() => setInvitations([]));
  }, []);

  const revokeInvitation = async (invitationId: string, email: string) => {
    try {
      const res = await fetch('/api/firms/me/invitations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not withdraw that invitation.');
      toast.success(`Invitation to ${email} withdrawn.`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  useEffect(load, [load]);

  // The sections render only after the firm has loaded, so a link such as
  // /firm#account arrives before its target exists and the browser cannot jump.
  useEffect(() => {
    if (loading || typeof window === 'undefined' || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [loading]);

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
          taxIdentificationNumber: fd.get('taxIdentificationNumber') || '',
          vatNumber: fd.get('vatNumber') || '',
          isVatRegistered: fd.get('isVatRegistered') === 'on',
          vatRatePercent: fd.get('vatRatePercent')
            ? Number(fd.get('vatRatePercent'))
            : null,
        }),
      });
      if (!res.ok) throw new Error('Could not save the account details.');
      toast.success('Bank and tax details saved.');
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
          <p className="mt-3 font-serif text-lg text-neutral-900">You don&apos;t have a practice yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
            Until you have one, you are not listed in the directory and clients cannot send you
            requests. Register your own practice - as a sole practitioner or a firm - or accept an
            invitation from a firm that has added you. A registered practice is checked by our
            team before it is listed.
          </p>
          <Button className="mt-5 rounded-none" onClick={() => router.push(`${pathname}/register`)}>
            Register your practice
          </Button>
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
        {/* An automatic practice can carry VERIFIED from its founder's own
            check, yet is not registered and not listed — the badge must not say
            "verified" right above the notice saying it is not listed. */}
        <Badge
          className={`w-fit rounded-none text-[10px] uppercase tracking-widest ${
            firm.isRegisteredPractice
              ? VERIFICATION_STYLE[firm.verificationStatus] ?? ''
              : VERIFICATION_STYLE.UNVERIFIED
          }`}
        >
          {firm.isRegisteredPractice
            ? VERIFICATION_LABEL[firm.verificationStatus] ?? firm.verificationStatus
            : 'Not registered'}
        </Badge>
      </div>

      {/* The page runs to about six phone screens; the bank details were at the bottom. */}
      <nav aria-label="On this page" className="flex flex-wrap gap-2 text-xs">
        {[
          ['#profile', 'Public profile'],
          ['#members', 'Members'],
          ['#offices', 'Offices'],
          ...(canManage ? [['#account', 'Bank and tax details']] : []),
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Why does a solo practitioner have a firm? Answer it before they ask. */}
      {firm.isSoloPractice && firm.isRegisteredPractice && (
        <div className="flex items-start gap-3 border border-neutral-200 bg-neutral-50 p-4 text-[12px] leading-relaxed text-neutral-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold text-neutral-800">
              You practise as a firm of one. Nothing has changed for you.
            </p>
            <p className="mt-1">
              Clients engage <strong>your practice</strong>, not this platform - so every
              engagement letter, quote and fee note names your practice as the provider
              of legal services. If you later take on another attorney or an assistant,
              you can add them here and share the workload without moving anything.
            </p>
          </div>
        </div>
      )}

      {/*
        The entry point to firm registration.
        Shown prominently on an UNREGISTERED practice, because the situation it
        addresses is a real firm whose partner has just signed up and has no idea
        that the "Nimal Perera" practice they are looking at is supposed to become
        "Perera & Associates". Before this existed the only route was to guess
        that renaming this firm and adding members one at a time was the
        multi-partner onboarding flow.
      */}
      {!firm.isRegisteredPractice && (
        <div className="border-l-4 border-l-[#bfa37a] border border-neutral-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#bfa37a]" />
              <div className="text-[12px] leading-relaxed text-neutral-600">
                <p className="font-semibold text-neutral-800">
                  Your practice is not registered, so it is not listed.
                </p>
                <p className="mt-1">
                  This practice was created automatically when your own registration was approved.
                  Automatic practices are no longer listed in the directory or able to receive new
                  requests. Register it - as a sole practitioner or a firm, with its real name and
                  address - and our team will check it before it is listed.{' '}
                  <strong>Your existing matters and licence are unaffected.</strong>
                </p>
              </div>
            </div>
            {canManage && (
              <Button
                className="shrink-0 rounded-none"
                onClick={() => router.push(`${pathname}/register`)}
              >
                Register the practice
              </Button>
            )}
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
      <Card id="profile" className="scroll-mt-20 rounded-none">
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
                onChange={(e) => setDescriptionDraft(e.target.value)}
                disabled={!canManage} className="rounded-none text-sm"
                placeholder="A factual description of the practice and the work it does."
              />
              <SelfPromotionNotice text={descriptionDraft ?? firm.description} />
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
      <Card id="members" className="scroll-mt-20 rounded-none">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800">
                Members
              </h2>
            </div>
            {canManageMembers && (
              <Button
                size="sm" variant="outline" className="rounded-none"
                onClick={() => setMemberDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Invite
              </Button>
            )}
          </div>

          <p className="mb-4 flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Everyone you add here can see something about your clients&apos; matters.
              What each role can read is fixed and shown below - a client&apos;s account of
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
                    {memberName(m)}
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
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="w-fit rounded-none text-[10px] uppercase tracking-widest">
                    {ROLE_LABELS[m.role]}
                  </Badge>
                  {canManageMembers && (
                    <>
                      <Button
                        size="sm" variant="outline" className="h-7 rounded-none px-2.5 text-[11px]"
                        onClick={() => setRoleTarget(m)}
                      >
                        Change role
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 rounded-none border-red-300 px-2.5 text-[11px] text-red-600"
                        onClick={() => setRemoveTarget(m)}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/*
            Outstanding invitations.
            Shown next to the member list because "I invited my partner and
            nothing happened" is the obvious confusion otherwise — an invitation
            is not a membership, and the difference has to be visible.
          */}
          {invitations.filter((i) => i.status === 'PENDING').length > 0 && (
            <div className="mt-5 border-t border-neutral-200 pt-5">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                Invited, not yet joined
              </h3>
              <div className="space-y-2">
                {invitations
                  .filter((i) => i.status === 'PENDING')
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-col gap-2 border border-dashed border-neutral-300 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-neutral-900">{inv.email}</p>
                        <p className="truncate text-[11px] text-neutral-500">
                          Invited as {ROLE_LABELS[inv.role] ?? inv.role}
                          {' · expires '}
                          {new Date(inv.expiresAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                        <p className="mt-1 text-[10px] text-neutral-400">
                          They decide for themselves. Nothing about your matters is visible to
                          them until they accept.
                        </p>
                      </div>
                      {canManageMembers && (
                        <Button
                          size="sm" variant="ghost"
                          className="w-fit shrink-0 rounded-none text-[11px]"
                          onClick={() => revokeInvitation(inv.id, inv.email)}
                        >
                          Withdraw
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offices */}
      <Card id="offices" className="scroll-mt-20 rounded-none">
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
                onClick={() => { setEditOffice(null); setOfficeDialogOpen(true); }}
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
                  {canManage && (
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        size="sm" variant="outline" className="h-7 rounded-none px-2.5 text-[11px]"
                        onClick={() => { setEditOffice(o); setOfficeDialogOpen(true); }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 rounded-none px-2.5 text-[11px]"
                        onClick={() => setRetireTarget(o)}
                      >
                        Retire
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank and tax details. Not called "client account": to a lawyer that is a
          trust account holding clients' money, and this is the firm's ordinary
          account where its fees are paid. */}
      {canManage && (
        <Card id="account" className="scroll-mt-20 rounded-none">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-800">
                Bank and tax details
              </h2>
            </div>

            <p className="mb-5 flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                New quotes start with this account and your fee notes print it, so clients
                pay <strong>your firm directly</strong>. This platform never receives, holds
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
              {/* Tax identity. Printed on the fee notes the firm issues to its
                  own clients — the firm supplies the legal service, so the firm
                  is the taxable person and we are not in that transaction. */}
              <div className="sm:col-span-2 border-t border-neutral-200 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Tax identity
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                  Printed on the fee notes you issue to your clients. Your firm bills under its
                  own registration; this platform is not a party to those invoices and takes no
                  share of your fees.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taxIdentificationNumber" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">TIN</Label>
                <Input id="taxIdentificationNumber" name="taxIdentificationNumber" defaultValue={firm.taxIdentificationNumber || ''} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vatNumber" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">VAT number</Label>
                <Input id="vatNumber" name="vatNumber" defaultValue={firm.vatNumber || ''} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="isVatRegistered" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">VAT registered</Label>
                <div className="flex h-9 items-center gap-2">
                  <input
                    id="isVatRegistered"
                    name="isVatRegistered"
                    type="checkbox"
                    defaultChecked={firm.isVatRegistered}
                    className="h-4 w-4 border-neutral-300"
                  />
                  <span className="text-xs text-neutral-600">
                    Add VAT to fee notes
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vatRatePercent" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">VAT rate (%)</Label>
                <Input id="vatRatePercent" name="vatRatePercent" type="number" min={0} max={100} step={1} defaultValue={firm.vatRatePercent ?? ''} className="rounded-none" />
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving} className="rounded-none">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save account &amp; tax details
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <InviteMemberDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        onAdded={load}
      />
      <ChangeRoleDialog member={roleTarget} onClose={() => setRoleTarget(null)} onChanged={load} />
      <RemoveMemberDialog member={removeTarget} onClose={() => setRemoveTarget(null)} onRemoved={load} />
      <OfficeDialog
        open={officeDialogOpen}
        office={editOffice}
        onOpenChange={setOfficeDialogOpen}
        onSaved={load}
      />
      <RetireOfficeDialog office={retireTarget} onClose={() => setRetireTarget(null)} onRetired={load} />
    </div>
  );
}

/**
 * Invite someone into the firm.
 *
 * This used to add an existing user directly — no email, no consent — and, for
 * an attorney, move their practice into this firm. Being a member means seeing
 * that the firm's clients' matters exist, so nobody is put inside that boundary
 * without being asked (PROGRESS.md decisions, 2026-08-16). The person gets an
 * email link and joins only if they accept, within 14 days.
 */
function InviteMemberDialog({
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
      const res = await fetch('/api/firms/me/invitations', {
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
          typeof data.error === 'string' ? data.error : 'Could not send that invitation.'
        );
      }
      toast.success(`Invitation sent to ${fd.get('email')}.`);
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
          <DialogTitle className="text-base">Invite someone to the firm</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            We email them a link. They join only if they accept, within 14 days - nothing about
            your matters is visible to them until then. They can accept with an existing account
            or create one.
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
              {(['FIRM_OWNER', 'ATTORNEY', 'FIRM_ADMIN', 'PARALEGAL'] as const).map((r) => (
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
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** PATCH a member. The server decides; its refusal is shown as it is worded. */
async function updateMember(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/firms/me/members', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not change that member.');
  }
}

/**
 * Change what a member can do. The server holds a role change to the same rules
 * as joining in that role: only a verified attorney can be a principal or an
 * attorney, and an attorney holding open matters cannot stop being one.
 */
function ChangeRoleDialog({
  member, onClose, onChanged,
}: {
  member: FirmMember | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [role, setRole] = useState('ATTORNEY');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (member) setRole(member.role);
  }, [member]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) return;
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await updateMember({ memberId: member.id, role, title: String(fd.get('title') || '') });
      toast.success('Role changed.');
      onChanged();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Change role</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {member ? memberName(member) : ''}. What they can see changes at once.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            {(['FIRM_OWNER', 'ATTORNEY', 'FIRM_ADMIN', 'PARALEGAL'] as const).map((r) => (
              <button
                key={r} type="button" onClick={() => setRole(r)}
                className={`w-full border p-2.5 text-left transition-colors ${
                  role === r ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
                }`}
              >
                <p className="text-sm font-semibold text-neutral-900">{ROLE_LABELS[r]}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">{ROLE_ACCESS_NOTE[r]}</p>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="memberTitle" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Title <span className="font-normal normal-case tracking-normal text-neutral-400">(optional)</span>
            </Label>
            <Input
              id="memberTitle" name="title" key={member?.id}
              defaultValue={member?.title ?? ''} className="rounded-none" placeholder="Senior Associate"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-none">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Remove someone from the firm. Members are never deleted — the row is marked
 * REMOVED so the record of who could have seen a matter survives — but access
 * ends at once. A firm whose staff member has left had no way to do this.
 */
function RemoveMemberDialog({
  member, onClose, onRemoved,
}: {
  member: FirmMember | null;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const remove = async () => {
    if (!member) return;
    setSubmitting(true);
    try {
      await updateMember({ memberId: member.id, status: 'REMOVED' });
      toast.success(`${memberName(member)} removed from the firm.`);
      onRemoved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Remove {member ? memberName(member) : ''}?</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            They lose access to the firm and its matters at once, including conversations with
            clients. An attorney who still has open matters must have them reassigned first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="rounded-none" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button" disabled={submitting} onClick={remove}
            className="rounded-none bg-red-600 text-white hover:bg-red-700"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Add an office, or edit one when `office` is given. */
function OfficeDialog({
  open, office, onOpenChange, onSaved,
}: {
  open: boolean;
  office: FirmOffice | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);

    try {
      const res = await fetch('/api/firms/me/offices', {
        method: office ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(office ? { officeId: office.id } : {}),
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
      toast.success(office ? 'Office saved.' : 'Office added.');
      onSaved();
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
          <DialogTitle className="text-base">{office ? 'Edit office' : 'Add an office'}</DialogTitle>
          <DialogDescription className="text-xs">
            Where the firm practises from. Attorneys keep their own calendars.
          </DialogDescription>
        </DialogHeader>

        <form key={office?.id ?? 'new'} onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Name</Label>
            <Input id="label" name="label" required defaultValue={office?.label ?? ''} className="rounded-none" placeholder="Colombo (head office)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Address</Label>
            <Textarea id="address" name="address" required rows={2} defaultValue={office?.address ?? ''} className="rounded-none text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="office-district" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">District</Label>
            <select
              id="office-district" name="district" defaultValue={office?.district ?? ''}
              className="w-full rounded-none border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              <option value="">Select</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="office-phone" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Telephone</Label>
            <Input id="office-phone" name="contactPhone" defaultValue={office?.contactPhone ?? ''} className="rounded-none" />
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" name="isPrimary" defaultChecked={office?.isPrimary ?? false} className="h-3.5 w-3.5" />
            This is the firm&apos;s registered office
          </label>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-none">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {office ? 'Save' : 'Add office'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Retire an office. It is kept, not deleted — an old address may still appear
 * on an engagement letter issued while the firm sat there — but it no longer
 * shows on the firm's profile.
 */
function RetireOfficeDialog({
  office, onClose, onRetired,
}: {
  office: FirmOffice | null;
  onClose: () => void;
  onRetired: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const retire = async () => {
    if (!office) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/firms/me/offices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officeId: office.id, isActive: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not retire that office.');
      toast.success(`${office.label} retired.`);
      onRetired();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!office} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Retire {office?.label}?</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            It stops showing on your practice&apos;s profile. The record is kept, because past
            engagement letters may name this address.
            {office?.isPrimary && ' This is your registered office - mark another office as registered afterwards.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="rounded-none" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={retire} className="rounded-none">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Retire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
