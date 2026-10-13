'use client';

/**
 * The public directory switch, for administrators.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Turns `/lawyers`, `/firms`, their APIs and every link to them on or off.
 * Firms' and attorneys' own pages stay reachable by direct link either way.
 * A reason is required and every change is kept, because "when was it taken
 * down, by whom, and why" is a question a regulator can ask.
 * See src/lib/directory.ts and counsel questions 16–18.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Building2, Eye, Loader2, Power, AlertTriangle } from 'lucide-react';
import { DirectorySwitchSchema } from '@/schemas/directory.schema';

type Change = {
  id: string;
  enabled: boolean;
  reason: string;
  changedBy: string;
  createdAt: string;
};

export default function DirectorySwitchPage() {
  const { locale } = useParams();

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [history, setHistory] = useState<Change[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/directory');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEnabled(data.enabled);
      setHistory(data.history ?? []);
    } catch {
      toast.error('Could not load the directory switch.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flip = async () => {
    const payload = { enabled: !enabled, reason };
    const parsed = DirectorySwitchSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Invalid reason.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/admin/directory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setReason('');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change the switch.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
            <Building2 className="h-3.5 w-3.5" />
            Legal
          </div>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-neutral-900">
            Public Directory
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Shows or hides the public list of attorneys and firms. Each firm&apos;s and
            attorney&apos;s own page still works by direct link when the directory is off.
          </p>
        </div>

        <Link
          href={`/${locale}/firms`}
          target="_blank"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 sm:self-auto"
        >
          <Eye className="h-4 w-4" />
          View public page
        </Link>
      </header>

      <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <p className="text-sm leading-relaxed text-amber-900/90">
          Whether a public directory of attorneys is lawful in Sri Lanka is not yet confirmed
          (counsel questions 16–18). If counsel advises against it, turn it off here.
        </p>
      </div>

      {/* ─── The switch ─────────────────────────────────────────────── */}
      <section className="mt-8 rounded-2xl border border-neutral-300 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg tracking-tight text-neutral-900">Status</h2>
            <p className="mt-1 text-sm text-neutral-600">
              The public directory is{' '}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {enabled ? 'On' : 'Off'}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label
            htmlFor="directory-reason"
            className="text-xs font-bold uppercase tracking-wider text-neutral-500"
          >
            Reason for turning it {enabled ? 'off' : 'on'}
          </label>
          <textarea
            id="directory-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={
              enabled
                ? 'e.g. Counsel advised on 2026-10-20 that the directory may breach Rule 40.'
                : 'e.g. Counsel confirmed on 2026-10-20 that a neutral directory is permissible.'
            }
            className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
          />
          <p className="mt-1.5 text-xs text-neutral-500">Required. Kept permanently with the change.</p>
        </div>

        <button
          onClick={flip}
          disabled={busy}
          className={`mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
            enabled ? 'bg-red-700 hover:bg-red-800' : 'bg-neutral-900 hover:bg-neutral-800'
          }`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
          {enabled ? 'Turn directory off' : 'Turn directory on'}
        </button>
      </section>

      {/* ─── History ────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-serif text-lg tracking-tight text-neutral-900">History</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Never changed. The directory has been on since launch.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
            {history.map((h) => (
              <li key={h.id} className="p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      h.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    Turned {h.enabled ? 'on' : 'off'}
                  </span>
                  <span className="text-neutral-700">{h.changedBy}</span>
                  <span className="text-neutral-400">{new Date(h.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{h.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
