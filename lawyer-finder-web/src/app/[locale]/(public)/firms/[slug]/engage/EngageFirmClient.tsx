'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Building2, Loader2, Lock, ArrowLeft, ShieldCheck, ScrollText, Info,
} from 'lucide-react';
import { PRACTICE_AREAS } from '@/schemas/profile.schema';

/**
 * Requesting an engagement from a firm.
 *
 * Deliberately NOT a booking form. There is no calendar here and no fee, because
 * at this point neither exists: the firm has not yet checked whether it can act,
 * and it has not quoted. Presenting a slot picker would tell the client they are
 * buying a consultation, which is the marketplace shape the restructure exists
 * to remove.
 *
 * The screen therefore has one job beyond collecting the matter: making
 * unmistakably clear what submitting does and does not do.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 4 and 7).
 */
export default function EngageFirmClient({
  firm,
  locale,
  isLoggedIn,
}: {
  firm: {
    id: string;
    slug: string;
    name: string;
    district: string | null;
    practiceAreas: string[];
    officeHours: string | null;
    attorneyCount: number;
  };
  locale: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'PHYSICAL' | 'ONLINE'>('PHYSICAL');
  const [practiceArea, setPracticeArea] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isLoggedIn) {
      router.push(`/${locale}/login?redirect=/${locale}/firms/${firm.slug}/engage`);
      return;
    }

    const fd = new FormData(e.currentTarget);
    setSubmitting(true);

    try {
      const res = await fetch('/api/consultations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // No lawyerId and no schedule: the client is engaging the firm and
          // leaving the choice of attorney, and the appointment, to it.
          firmId: firm.id,
          mode,
          subject: fd.get('subject'),
          description: fd.get('description'),
          practiceArea: practiceArea || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'Please check the details and try again.'
        );
      }

      toast.success('Your request has been sent to the firm.');
      router.push(`/${locale}/dashboard/client/consultations`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-8 sm:py-10">
      <div className="mx-auto max-w-3xl px-6">
        <Link
          href={`/${locale}/firms/${firm.slug}`}
          className="mb-6 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {firm.name}
        </Link>

        <div className="border-b border-neutral-100 pb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a]">
            Request an engagement
          </p>
          <h1 className="mt-2 flex items-center gap-2 font-serif text-3xl tracking-tight text-neutral-900">
            <Building2 className="h-6 w-6 shrink-0 text-neutral-400" />
            {firm.name}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {firm.district}
            {firm.attorneyCount > 0 &&
              ` · ${firm.attorneyCount} ${firm.attorneyCount === 1 ? 'attorney' : 'attorneys'}`}
            {firm.officeHours && ` · ${firm.officeHours}`}
          </p>
        </div>

        {/* What happens next — said before the form, not after it. */}
        <div className="mt-6 border border-neutral-200 bg-neutral-50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-neutral-800">
            <ScrollText className="h-4 w-4" /> What happens after you send this
          </h2>
          <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-neutral-600">
            <li>
              <strong>1.</strong> {firm.name} decides whether it can act, including
              checking for any conflict of interest with its existing clients.
            </li>
            <li>
              <strong>2.</strong> If it can, it assigns one of its attorneys to your
              matter and tells you who that is.
            </li>
            <li>
              <strong>3.</strong> That attorney sends you a fee quote, the scope of
              what it covers, and a proposed appointment time.
            </li>
            <li>
              <strong>4.</strong> Only if you accept does an engagement begin. You then
              pay the firm directly.
            </li>
          </ol>

          <div className="mt-4 flex items-start gap-2 border-t border-neutral-200 pt-4 text-[12px] leading-relaxed text-neutral-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Sending this creates no lawyer-client relationship and costs
              nothing.</strong>{' '}
              No fee is payable unless and until you accept a quote in writing.
              {firm.name} - not this platform - provides the legal services, and any
              fee you agree is paid directly to the firm.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="subject" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              What is this about?
            </Label>
            <Input
              id="subject"
              name="subject"
              required
              minLength={3}
              maxLength={200}
              className="rounded-none"
              placeholder="e.g. Boundary dispute with a neighbour"
            />
            <p className="text-[10px] text-neutral-400">A short summary, in your own words.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Area of law <span className="font-normal normal-case tracking-normal text-neutral-400">(if you know it)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {firm.practiceAreas.length > 0
                ? firm.practiceAreas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setPracticeArea(practiceArea === a ? '' : a)}
                      className={`border px-3 py-1.5 text-[11px] transition-colors ${
                        practiceArea === a
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      {a}
                    </button>
                  ))
                : PRACTICE_AREAS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setPracticeArea(practiceArea === a ? '' : a)}
                      className={`border px-3 py-1.5 text-[11px] transition-colors ${
                        practiceArea === a
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
            </div>
            <p className="text-[10px] text-neutral-400">
              Not sure? Leave it blank - the firm will work it out.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Tell the firm what has happened
            </Label>
            <Textarea
              id="description"
              name="description"
              required
              minLength={10}
              maxLength={2000}
              rows={7}
              className="rounded-none text-sm"
              placeholder="Describe the situation, who else is involved, and what you would like to achieve. Include dates if you know them."
            />
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-neutral-500">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" />
              This is read by the attorney at {firm.name} who takes your matter, and by
              the firm&apos;s principal. It is not readable by this platform&apos;s staff.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              How would you prefer to meet?
            </Label>
            <div className="flex gap-2">
              {(['PHYSICAL', 'ONLINE'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 border px-4 py-3 text-left transition-colors ${
                    mode === m ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
                  }`}
                >
                  <span className="block text-sm font-semibold text-neutral-900">
                    {m === 'PHYSICAL' ? 'At the office' : 'Online'}
                  </span>
                  <span className="block text-[10px] text-neutral-500">
                    {m === 'PHYSICAL'
                      ? 'In person, at one of the firm’s offices'
                      : 'By video call'}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-neutral-400">
              A preference, not a booking. The firm proposes the actual time with its quote.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-neutral-100 pt-6 sm:flex-row sm:items-center">
            <Button type="submit" disabled={submitting} className="rounded-none px-8 py-6 text-xs font-bold uppercase tracking-widest">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoggedIn ? 'Send request to the firm' : 'Sign in to send this request'}
            </Button>
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-neutral-400">
              <ShieldCheck className="h-3.5 w-3.5" /> No fee · No obligation
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
