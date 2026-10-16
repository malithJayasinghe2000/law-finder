'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Building2, Users, MapPin, Info, Loader2, Plus, Trash2, ArrowLeft, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { DISTRICTS, PRACTICE_AREAS, LANGUAGES } from '@/schemas/profile.schema';
import SelfPromotionNotice from '@/components/shared/SelfPromotionNotice';

/**
 * Registering a real law firm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS PAGE EXISTS. A multi-partner practice had no way to join. The only
 * route was: one partner registers as an individual attorney, a firm of one is
 * silently created and named after them, they find the firm console and rename
 * it, and then they add partners one at a time — each of whom had to have
 * registered separately first. Nobody would guess that.
 *
 * It says out loud that it is completing the practice the attorney already has
 * rather than making a second one, because the alternative — a user assuming
 * they now have two firms and wondering which their matters are in — is a
 * confusion the screen would have caused.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type Invitation = { email: string; role: string; title: string };

const ROLES = [
  { value: 'FIRM_OWNER', label: 'Partner / principal', note: 'Must be a verified Attorney-at-Law. Can manage the firm and its people.' },
  { value: 'ATTORNEY', label: 'Attorney', note: 'Must be a verified Attorney-at-Law. Can be given matters.' },
  { value: 'FIRM_ADMIN', label: 'Practice manager', note: 'Need not be an attorney. Runs the diary and the queue.' },
  { value: 'PARALEGAL', label: 'Paralegal / support staff', note: 'Need not be an attorney. Cannot read what a client wrote about their problem.' },
];

export default function RegisterFirmPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter();
  const [locale, setLocale] = useState('en');
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  params.then((p) => setLocale(p.locale));

  const [form, setForm] = useState({
    name: '',
    firmType: 'PARTNERSHIP',
    registrationNumber: '',
    establishedYear: '',
    description: '',
    practiceAreas: [] as string[],
    languages: [] as string[],
    courts: [] as string[],
    district: '',
    contactEmail: '',
    contactPhone: '',
    websiteUrl: '',
    officeHours: '',
    office: { label: 'Head office', address: '', district: '', contactPhone: '' },
  });

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [declaration, setDeclaration] = useState(false);

  const toggle = (key: 'practiceAreas' | 'languages', value: string) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));
  };

  const addInvitation = () =>
    setInvitations((i) => [...i, { email: '', role: 'ATTORNEY', title: '' }]);

  const updateInvitation = (idx: number, patch: Partial<Invitation>) =>
    setInvitations((i) => i.map((inv, n) => (n === idx ? { ...inv, ...patch } : inv)));

  const removeInvitation = (idx: number) =>
    setInvitations((i) => i.filter((_, n) => n !== idx));

  const submit = async () => {
    if (!declaration) {
      toast.error('Confirm the declaration before registering the practice.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/firms/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          establishedYear: form.establishedYear ? parseInt(form.establishedYear, 10) : null,
          invitations: invitations.filter((i) => i.email.trim()),
          declarationAccepted: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray(data.problems)) {
          data.problems.forEach((p: string) => toast.error(p));
        }
        throw new Error(data.error || 'Could not register the practice.');
      }

      toast.success(
        data.invitationsSent > 0
          ? `${form.name} registered. ${data.invitationsSent} invitation${data.invitationsSent === 1 ? '' : 's'} sent.`
          : `${form.name} registered.`
      );

      // Registration can succeed while the invitations do not — a firm without
      // a licence has no seat for anyone to join into. Say so loudly rather
      // than letting the principal believe their partners were emailed.
      if (data.warning) {
        toast.warning(data.warning, { duration: 12000 });
      }

      router.push(`/${locale}/dashboard/lawyer/firm`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const canContinue =
    step === 1
      ? form.name.trim().length >= 2 && form.office.address.trim().length >= 5
      : true;

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <Link
        href={`/${locale}/dashboard/lawyer/firm`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the firm console
      </Link>

      <div className="mb-8">
        <h1 className="text-4xl font-normal tracking-tight mb-2">Register your practice</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Give your firm its real name, address and partners.
        </p>
      </div>

      {/* The single most important thing on this page: what it does NOT do. */}
      <Card className="rounded-none shadow-sm mb-6 border-l-4 border-l-[#bfa37a]">
        <CardContent className="p-5 flex gap-3">
          <Info className="h-5 w-5 shrink-0 text-[#bfa37a] mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-semibold">This completes the practice you already have.</p>
            <p className="text-muted-foreground leading-relaxed">
              When your own registration was approved, a practice was created for you
              automatically so that your matters had a firm to belong to. This form gives that
              practice its real name and details and invites your partners into it - it does not
              create a second firm. <strong>Your existing matters, licence and invoices are
              unaffected.</strong>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Once you register, the practice goes back into the verification queue and will not
              appear in the public directory until an administrator has confirmed it exists as
              described. That is deliberate: until then, we have not checked the claim.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-8 w-8 items-center justify-center text-xs font-semibold ${
                step >= n ? 'bg-[#0a0a0a] text-white' : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              {n}
            </div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground hidden sm:inline">
              {n === 1 ? 'The practice' : n === 2 ? 'What it does' : 'Your people'}
            </span>
            {n < 3 && <div className="h-px flex-1 bg-neutral-200" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: identity and place of business ─────────────────────────── */}
      {step === 1 && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" /> The practice
            </h2>

            <div>
              <Label>Firm name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Perera &amp; Associates, Attorneys-at-Law"
                className="rounded-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The name clients see. This replaces the placeholder name your practice was given.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Practice form</Label>
                <select
                  value={form.firmType}
                  onChange={(e) => setForm({ ...form, firmType: e.target.value })}
                  className="w-full h-9 border px-3 text-sm rounded-none bg-background"
                >
                  <option value="SOLE_PRACTITIONER">Sole practitioner</option>
                  <option value="PARTNERSHIP">Partnership</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Legal practice cannot be incorporated in Sri Lanka, so there is no company
                  option.
                </p>
              </div>
              <div>
                <Label>Registration number (optional)</Label>
                <Input
                  value={form.registrationNumber}
                  onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  className="rounded-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Year established (optional)</Label>
                <Input
                  type="number"
                  value={form.establishedYear}
                  onChange={(e) => setForm({ ...form, establishedYear: e.target.value })}
                  className="rounded-none"
                />
              </div>
              <div>
                <Label>District</Label>
                <select
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  className="w-full h-9 border px-3 text-sm rounded-none bg-background"
                >
                  <option value="">Select a district</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 mt-3">
                <MapPin className="h-4 w-4" /> Head office
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>Office name</Label>
                  <Input
                    value={form.office.label}
                    onChange={(e) => setForm({ ...form, office: { ...form.office, label: e.target.value } })}
                    className="rounded-none"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Textarea
                    value={form.office.address}
                    onChange={(e) => setForm({ ...form, office: { ...form.office, address: e.target.value } })}
                    className="rounded-none"
                    rows={3}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Office district</Label>
                    <select
                      value={form.office.district}
                      onChange={(e) => setForm({ ...form, office: { ...form.office, district: e.target.value } })}
                      className="w-full h-9 border px-3 text-sm rounded-none bg-background"
                    >
                      <option value="">Same as the firm</option>
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Office telephone</Label>
                    <Input
                      value={form.office.contactPhone}
                      onChange={(e) => setForm({ ...form, office: { ...form.office, contactPhone: e.target.value } })}
                      placeholder="0112345678"
                      className="rounded-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: factual practice information ──────────────────────────── */}
      {step === 2 && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h2 className="text-lg font-semibold">What the practice does</h2>

            <div className="text-xs text-muted-foreground bg-neutral-50 border p-3 leading-relaxed">
              Everything on this step is <strong>factual practice information</strong> - the sort
              of thing a client needs in order to make their own choice. There is deliberately
              nowhere to put a fee range, a rating, an award or a promotional claim: what an
              attorney may display is limited by Supreme Court Rule 40, and anything beyond that
              list reads as advertising.
            </div>

            <div>
              <Label>About the practice (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="rounded-none"
                placeholder="A factual description of the practice and the work it does."
              />
              <SelfPromotionNotice text={form.description} />
            </div>

            <div>
              <Label>Practice areas</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRACTICE_AREAS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggle('practiceAreas', a)}
                    className={`px-3 py-1.5 text-xs border rounded-none transition-colors ${
                      form.practiceAreas.includes(a)
                        ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                        : 'bg-background hover:bg-neutral-50'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Languages</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggle('languages', l)}
                    className={`px-3 py-1.5 text-xs border rounded-none transition-colors ${
                      form.languages.includes(l)
                        ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                        : 'bg-background hover:bg-neutral-50'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="rounded-none"
                />
              </div>
              <div>
                <Label>Contact telephone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="rounded-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Website (optional)</Label>
                <Input
                  value={form.websiteUrl}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  placeholder="https://"
                  className="rounded-none"
                />
              </div>
              <div>
                <Label>Office hours</Label>
                <Input
                  value={form.officeHours}
                  onChange={(e) => setForm({ ...form, officeHours: e.target.value })}
                  placeholder="Mon–Fri 9.00am–5.00pm"
                  className="rounded-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: the people ─────────────────────────────────────────────── */}
      {step === 3 && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Your partners and staff
            </h2>

            <div className="text-xs text-muted-foreground bg-neutral-50 border p-3 leading-relaxed space-y-2">
              <p>
                These are <strong>invitations</strong>, not additions. Each person gets an email
                and decides for themselves - joining a practice means being able to see that its
                matters exist, so it is not something we do to someone without asking.
              </p>
              <p>
                They do not need an account yet. If they have never used the platform, the
                invitation will be waiting when they register.
              </p>
              <p>
                A partner or attorney must be a <strong>verified Attorney-at-Law</strong>, and an
                attorney who still holds open matters at another practice has to close or hand
                those over before moving - the client engaged <em>that</em> firm.
              </p>
            </div>

            {invitations.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed">
                No one invited yet. A practice of one is perfectly valid - you can invite people
                later from the firm console.
              </p>
            )}

            {invitations.map((inv, idx) => (
              <div key={idx} className="border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label>Email address</Label>
                      <Input
                        type="email"
                        value={inv.email}
                        onChange={(e) => updateInvitation(idx, { email: e.target.value })}
                        placeholder="partner@example.com"
                        className="rounded-none"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Role in the firm</Label>
                        <select
                          value={inv.role}
                          onChange={(e) => updateInvitation(idx, { role: e.target.value })}
                          className="w-full h-9 border px-3 text-sm rounded-none bg-background"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {ROLES.find((r) => r.value === inv.role)?.note}
                        </p>
                      </div>
                      <div>
                        <Label>Job title (optional)</Label>
                        <Input
                          value={inv.title}
                          onChange={(e) => updateInvitation(idx, { title: e.target.value })}
                          placeholder="Senior Partner"
                          className="rounded-none"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInvitation(idx)}
                    aria-label="Remove this invitation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addInvitation} className="rounded-none">
              <Plus className="h-4 w-4 mr-2" /> Invite someone
            </Button>

            <div className="border-t pt-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declaration}
                  onChange={(e) => setDeclaration(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm leading-relaxed">
                  I am an Attorney-at-Law admitted and enrolled by the Supreme Court of Sri Lanka,
                  I am a principal of this practice, and the details above are accurate. I
                  understand this practice will be listed publicly only after it has been
                  verified.
                </span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || saving}
          className="rounded-none"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        {step < 3 ? (
          <Button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue}
            className="rounded-none"
          >
            Continue <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={saving || !declaration} className="rounded-none">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering…</>
            ) : (
              <><ShieldCheck className="h-4 w-4 mr-2" /> Register the practice</>
            )}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        <Badge variant="outline" className="rounded-none mr-2">Note</Badge>
        Registering does not change who your existing clients are engaged with. A matter always
        belongs to the practice that received it.
      </p>
    </div>
  );
}
