'use client';

/**
 * Data-protection requests referred to this firm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The firm is the controller of its own matter files. When a client asks the
 * platform for everything held about them, or asks for it to be deleted, the
 * part touching their matter is not ours to answer — so it arrives here and the
 * practice decides.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT SHOW:
 *
 *   - The person's request note. A request written to a platform may describe
 *     circumstances the client has not chosen to put in front of their attorney.
 *   - That any OTHER firm holds a matter for the same person. That is the
 *     existence of another retainer, and it is not ours to disclose.
 *
 * The answer given here is shown to the client verbatim, which is why a reason
 * is required and not optional — particularly for a refusal, where a reason
 * that does not name the duty is not a defensible refusal.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Shield, Loader2, AlertTriangle, Clock, Check, Building2, Scale,
} from 'lucide-react';
import { outcomeOptions, outcomeLabel, ERASURE_NOT_AVAILABLE_NOTE } from '@/lib/privacy/firmOutcomes';

type Request = {
  id: string;
  type: string;
  status: string;
  dueBy: string;
  createdAt: string;
  completedAt: string | null;
  client: { id: string; fullName: string | null; email: string };
  mattersHeldByThisFirm: number;
  ourResponse: { outcome: string; reason: string; respondedAt: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  ACCESS: 'Access — wants a copy of what you hold',
  PORTABILITY: 'Portability — wants their data in a portable form',
  ERASURE: 'Erasure — wants it deleted',
  RECTIFICATION: 'Rectification — wants something corrected',
  OBJECTION: 'Objection',
};

export default function FirmSubjectRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [firmName, setFirmName] = useState('');
  const [guidance, setGuidance] = useState('');
  const [requests, setRequests] = useState<Request[]>([]);

  const [answering, setAnswering] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('REFUSED_RETAINED');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/firms/me/subject-requests');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setForbidden(typeof data.error === 'string' ? data.error : 'Could not load requests.');
        return;
      }

      setForbidden(null);
      setFirmName(data.firmName ?? '');
      setGuidance(data.guidance ?? '');
      setRequests(data.requests ?? []);
    } catch {
      toast.error('Could not load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startAnswer = (r: Request) => {
    setAnswering(r.id);
    // Start from the firm's earlier answer if it still fits this request, else
    // "we hold nothing" when no matter is held here, else the first option.
    const options = outcomeOptions(r.type).map((o) => o.value as string);
    const previous = r.ourResponse?.outcome;
    setOutcome(
      previous && options.includes(previous)
        ? previous
        : r.mattersHeldByThisFirm === 0 ? 'NO_DATA' : options[0]
    );
    setReason(r.ourResponse?.reason ?? '');
  };

  const submit = async (requestId: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/firms/me/subject-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, outcome, reason: reason.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Could not record that.');
        return;
      }

      toast.success(data.message ?? 'Recorded.');
      setAnswering(null);
      setReason('');
      await load();
    } catch {
      toast.error('Could not record that.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h1 className="font-serif text-xl tracking-tight text-neutral-900">
            Data-protection requests
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">{forbidden}</p>
        </div>
      </div>
    );
  }

  const open = requests.filter((r) => !r.ourResponse);
  const answered = requests.filter((r) => r.ourResponse);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bfa37a]">
          <Shield className="h-3.5 w-3.5" />
          {firmName}
        </div>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-neutral-900">
          Data-protection requests
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">{guidance}</p>
      </header>

      <div className="mt-6 flex gap-3 rounded-2xl border border-[#efeae0] bg-[#fbf9f6] p-5">
        <Scale className="mt-0.5 h-4 w-4 shrink-0 text-[#bfa37a]" />
        <div className="text-sm leading-relaxed text-neutral-700">
          <p className="font-semibold text-neutral-900">Your decision, not ours.</p>
          <p className="mt-1">
            We host your matter files as your processor and cannot release or delete them on our
            own authority. Your answer is shown to the person who asked, in your words — so where
            you are keeping a file, name the duty that requires it.
          </p>
        </div>
      </div>

      {open.length === 0 && answered.length === 0 && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-600">
            No data-protection requests have been referred to this firm.
          </p>
        </div>
      )}

      {open.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-lg tracking-tight text-neutral-900">
            Awaiting your decision
          </h2>
          <div className="mt-4 space-y-3">
            {open.map((r) => {
              const overdue = new Date(r.dueBy) < new Date();
              return (
                <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-neutral-900">
                        {r.client.fullName || r.client.email}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {r.mattersHeldByThisFirm} matter
                          {r.mattersHeldByThisFirm === 1 ? '' : 's'} with this firm
                        </span>
                        <span
                          className={`flex items-center gap-1 ${overdue ? 'font-bold text-red-600' : ''}`}
                        >
                          <Clock className="h-3 w-3" />
                          {overdue ? 'Overdue — due ' : 'Due '}
                          {new Date(r.dueBy).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </p>
                    </div>

                    {answering !== r.id && (
                      <button
                        onClick={() => startAnswer(r)}
                        className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
                      >
                        Record your decision
                      </button>
                    )}
                  </div>

                  {answering === r.id && (
                    <div className="mt-5 border-t border-neutral-100 pt-5">
                      <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        What did you decide?
                      </label>
                      {r.type === 'ERASURE' && (
                        <p className="mt-2 text-xs leading-relaxed text-amber-800">{ERASURE_NOT_AVAILABLE_NOTE}</p>
                      )}
                      <div className="mt-2 space-y-2">
                        {outcomeOptions(r.type).map((o) => (
                          <label
                            key={o.value}
                            className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                              outcome === o.value
                                ? 'border-neutral-900 bg-neutral-50'
                                : 'border-neutral-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`outcome-${r.id}`}
                              checked={outcome === o.value}
                              onChange={() => setOutcome(o.value)}
                              className="mt-1"
                            />
                            <span>
                              <span className="block text-sm font-semibold text-neutral-900">
                                {o.label}
                              </span>
                              <span className="block text-xs leading-relaxed text-neutral-500">
                                {o.help}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>

                      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Your reason, shown to the person verbatim
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        placeholder="e.g. We are required to retain the file for six years under our professional record-keeping obligations, so we cannot delete it. Your contact details have been removed from our marketing list."
                        className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm leading-relaxed outline-none focus:border-neutral-900"
                      />
                      <p className="mt-1.5 text-xs text-neutral-500">
                        {reason.trim().length}/20 characters minimum.{' '}
                        {(outcome === 'REFUSED_RETAINED' || outcome === 'PARTIAL') && (
                          <span className="font-semibold text-amber-700">
                            Name the duty — a refusal that does not is not a defensible refusal.
                          </span>
                        )}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() => submit(r.id)}
                          disabled={busy || reason.trim().length < 20}
                          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Record decision
                        </button>
                        <button
                          onClick={() => setAnswering(null)}
                          className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {answered.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-lg tracking-tight text-neutral-900">Answered</h2>
          <div className="mt-4 space-y-3">
            {answered.map((r) => (
              <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-neutral-900">
                      {r.client.fullName || r.client.email}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-600">{TYPE_LABEL[r.type] ?? r.type}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    {r.ourResponse && outcomeLabel(r.type, r.ourResponse.outcome)}
                  </span>
                </div>
                <p className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700">
                  {r.ourResponse?.reason}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-neutral-500">
                    Answered{' '}
                    {r.ourResponse &&
                      new Date(r.ourResponse.respondedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                  </p>
                  <button
                    onClick={() => startAnswer(r)}
                    className="text-xs font-semibold text-neutral-700 underline underline-offset-2"
                  >
                    Correct this
                  </button>
                </div>

                {answering === r.id && (
                  <div className="mt-4 border-t border-neutral-100 pt-4">
                    <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <p className="text-xs leading-relaxed text-amber-900">
                        Correcting replaces your firm&apos;s answer. The person sees the corrected
                        version.
                      </p>
                    </div>
                    {r.type === 'ERASURE' && (
                      <p className="mt-3 text-xs leading-relaxed text-amber-800">{ERASURE_NOT_AVAILABLE_NOTE}</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {outcomeOptions(r.type).map((o) => (
                        <label
                          key={o.value}
                          className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                            outcome === o.value
                              ? 'border-neutral-900 bg-neutral-50'
                              : 'border-neutral-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`outcome-edit-${r.id}`}
                            checked={outcome === o.value}
                            onChange={() => setOutcome(o.value)}
                            className="mt-1"
                          />
                          <span className="text-sm font-semibold text-neutral-900">{o.label}</span>
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
                    />
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        onClick={() => submit(r.id)}
                        disabled={busy || reason.trim().length < 20}
                        className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save correction
                      </button>
                      <button
                        onClick={() => setAnswering(null)}
                        className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
