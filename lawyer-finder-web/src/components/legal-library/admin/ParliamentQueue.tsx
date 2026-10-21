'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, ExternalLink, Loader2, RefreshCw, RotateCcw, Search, X } from 'lucide-react';
import { amendedLawName, libraryTitle, SUBJECTS, tidyTitle } from '@/lib/legalLibrary';

/**
 * Acts found on Parliament's listing, waiting for an admin
 * (api/admin/legal-documents/parliament). Approving downloads the official PDF
 * and adds it to the library, linked to the law it amends.
 */

type QueuedAct = {
  id: string;
  ref: string;
  actNumber: string | null;
  year: number | null;
  title: string;
  endorsedOn: string | null;
  pdfUrl: string;
  detailUrl: string;
  isAmendment: boolean;
  suggestedAmendsId: string | null;
  suggestedAmends: { id: string; title: string } | null;
  legalDocumentId: string | null;
};
type Law = { id: string; title: string; status: string; consolidatedToYear: number | null };
type Tab = 'NEW' | 'IMPORTED' | 'DISMISSED';

const NEW_LAW = '__new__';
const NONE = '';

export function ParliamentQueue({ locale, onChanged }: { locale: string; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>('NEW');
  const [acts, setActs] = useState<QueuedAct[]>([]);
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({});
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [laws, setLaws] = useState<Law[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [keyword, setKeyword] = useState('');
  // After a Find, only that law's Acts are listed.
  const [shownFor, setShownFor] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [q, l] = await Promise.all([
        fetch(`/api/admin/legal-documents/parliament?status=${tab}&page=${page}&limit=10${shownFor ? `&q=${encodeURIComponent(shownFor)}` : ''}`).then((r) => r.json()),
        fetch('/api/admin/legal-documents?view=laws').then((r) => r.json()),
      ]);
      setActs(q.acts || []);
      setCounts(q.counts || {});
      setLastCheckedAt(q.lastCheckedAt);
      setTotalPages(q.totalPages || 1);
      setLaws(l.laws || []);
    } catch {
      toast.error('Could not load the Parliament list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, shownFor]);

  // With a keyword: every Act under that name. Without: the newest Acts.
  const checkNow = async (byName?: string) => {
    setChecking(true);
    try {
      const res = await fetch('/api/admin/legal-documents/parliament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(byName ? { keyword: byName } : { pages: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        byName
          ? `Parliament lists ${data.found} Act${data.found === 1 ? '' : 's'} for "${byName}"; ${data.added} new to review.`
          : `${data.added} new Act${data.added === 1 ? '' : 's'} found.` +
              (data.complete ? ' The list is up to date.' : ' There are more: check again to read further back.')
      );
      setPage(1);
      setTab('NEW');
      if (byName) setShownFor(byName);
      else if (shownFor) setShownFor('');
      else load();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Could not read Parliament's website.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-neutral-700">
          <p>New Acts from Parliament&apos;s official list. Nothing is added to the library or the AI until you approve it.</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {lastCheckedAt ? `Last checked ${new Date(lastCheckedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.` : 'Not checked yet.'}
          </p>
        </div>
        <button
          onClick={() => checkNow()}
          disabled={checking}
          className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#0a0a0a] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} /> Check Parliament now
        </button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (keyword.trim()) checkNow(keyword.trim()); }}
        className="flex flex-col gap-2 border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="parl-keyword" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Find all of a law&apos;s Acts on Parliament
          </label>
          <input
            id="parl-keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g., Penal Code"
            className="w-full border border-neutral-200 px-3 py-2 text-sm focus:border-[#bfa37a] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={checking || keyword.trim().length < 3}
          className="inline-flex items-center justify-center gap-2 border border-neutral-300 px-4 py-2 text-xs font-bold uppercase tracking-widest text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" /> Find
        </button>
      </form>

      {shownFor && (
        <div className="flex items-center justify-between gap-3 border border-[#bfa37a]/30 bg-[#faf6f0] px-4 py-2.5 text-sm text-neutral-800">
          <span>Showing only Acts named &ldquo;{shownFor}&rdquo;.</span>
          <button
            onClick={() => { setShownFor(''); setPage(1); }}
            className="shrink-0 text-xs font-bold uppercase tracking-widest text-[#a68d67] hover:text-[#8a7350]"
          >
            Show all
          </button>
        </div>
      )}

      <div className="flex gap-1 border-b border-neutral-200" role="tablist">
        {(['NEW', 'IMPORTED', 'DISMISSED'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px ${
              tab === t ? 'border-[#bfa37a] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {t === 'NEW' ? 'To review' : t === 'IMPORTED' ? 'Added' : 'Dismissed'} ({counts[t] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse bg-neutral-100" />)}</div>
      ) : acts.length === 0 ? (
        <p className="border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          {tab === 'NEW' ? 'Nothing to review. Use "Check Parliament now" to look for new Acts.' : 'Nothing here.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {acts.map((act) => (
            <QueuedActRow key={act.id} act={act} tab={tab} laws={laws} locale={locale} onDone={() => { load(); onChanged(); }} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="border border-neutral-200 px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-50">Previous</button>
          <span className="text-xs text-neutral-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="border border-neutral-200 px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}

function QueuedActRow({ act, tab, laws, locale, onDone }: { act: QueuedAct; tab: Tab; laws: Law[]; locale: string; onDone: () => void }) {
  const guess = amendedLawName(act.title);
  const isConstitution = /constitution/i.test(act.title);
  const initialChoice = act.suggestedAmendsId ?? (act.isAmendment ? NEW_LAW : NONE);
  const [choice, setChoice] = useState(initialChoice);
  // "Judicature" -> "Judicature Act"; "Penal Code" and "Constitution" stay as they are.
  const guessName = guess ? tidyTitle(guess) : '';
  const [newTitle, setNewTitle] = useState(
    !guessName || /\b(act|ordinance|law|code|constitution)$/i.test(guessName) ? guessName : `${guessName} Act`
  );
  const [newType, setNewType] = useState<'ACT' | 'ORDINANCE' | 'CONSTITUTION'>(isConstitution ? 'CONSTITUTION' : 'ACT');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const chosenLaw = laws.find((l) => l.id === choice);
  const alreadyIncluded = !!(chosenLaw?.consolidatedToYear && act.year && act.year <= chosenLaw.consolidatedToYear);

  const approve = async () => {
    setBusy(true);
    try {
      const body =
        choice === NEW_LAW
          ? { newLaw: { title: newTitle, category: newType }, subjects }
          : { amendsId: choice || null, subjects };
      const res = await fetch(`/api/admin/legal-documents/parliament/${act.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Added. The AI is reading it now.');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not add it.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: 'DISMISSED' | 'NEW') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/legal-documents/parliament/${act.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not change it.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">{libraryTitle(act)}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {act.endorsedOn ? `Endorsed ${new Date(act.endorsedOn).toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : 'Date not given'}
            {act.isAmendment ? ' · Amending Act' : ''}
          </p>
        </div>
        <a href={act.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#a68d67] hover:text-[#8a7350]">
          Official PDF <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {tab === 'NEW' && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor={`amends-${act.id}`} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Amends which law?
              </label>
              <select
                id={`amends-${act.id}`}
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="w-full border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#bfa37a] focus:outline-none"
              >
                <option value={NONE}>None - a new law in its own right</option>
                <option value={NEW_LAW}>A law not in the library yet...</option>
                {laws.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}{l.status === 'AWAITING_ORIGINAL' ? ' (original being added)' : ''}
                  </option>
                ))}
              </select>
              {act.suggestedAmends && choice === act.suggestedAmendsId && (
                <p className="mt-1 text-xs text-emerald-700">Matched by name. Check it is right.</p>
              )}
              {alreadyIncluded && (
                <p className="mt-1 text-xs text-amber-700">
                  The library&apos;s text of this law already includes amendments up to {chosenLaw?.consolidatedToYear}, so
                  this Act is already in it. Dismiss it unless you want it listed anyway.
                </p>
              )}
            </div>

            {choice === NEW_LAW && (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <label htmlFor={`newlaw-${act.id}`} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Its full name
                  </label>
                  <input
                    id={`newlaw-${act.id}`}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Penal Code"
                    className="w-full border border-neutral-200 px-3 py-2 text-sm focus:border-[#bfa37a] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={`newtype-${act.id}`} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Type</label>
                  <select
                    id={`newtype-${act.id}`}
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as typeof newType)}
                    className="border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#bfa37a] focus:outline-none"
                  >
                    <option value="ACT">Act</option>
                    <option value="ORDINANCE">Ordinance</option>
                    <option value="CONSTITUTION">Constitution</option>
                  </select>
                </div>
                <p className="col-span-2 text-xs text-neutral-500">
                  It will be listed with &ldquo;Original text: being added&rdquo; until you upload its text.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5" aria-label="Subjects">
            {SUBJECTS.map((s) => {
              const on = subjects.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSubjects((p) => (on ? p.filter((x) => x !== s.value) : p.length < 4 ? [...p, s.value] : p))}
                  className={`px-2 py-1 text-[11px] border ${on ? 'border-[#bfa37a] bg-[#bfa37a] text-white' : 'border-neutral-200 text-neutral-600 hover:border-[#bfa37a]/50'}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setStatus('DISMISSED')} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-neutral-600 hover:text-neutral-900 disabled:opacity-50">
              <X className="h-3.5 w-3.5" /> Dismiss
            </button>
            <button
              onClick={approve}
              disabled={busy || (choice === NEW_LAW && newTitle.trim().length < 3)}
              className="inline-flex items-center gap-1.5 bg-[#0a0a0a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Add to library
            </button>
          </div>
        </>
      )}

      {tab === 'DISMISSED' && (
        <div className="flex justify-end">
          <button onClick={() => setStatus('NEW')} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-neutral-600 hover:text-neutral-900 disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" /> Back to review
          </button>
        </div>
      )}

      {tab === 'IMPORTED' && act.legalDocumentId && (
        <Link href={`/${locale}/legal-library/${act.legalDocumentId}`} className="inline-block text-xs font-semibold text-[#a68d67] hover:text-[#8a7350]">
          Open in the library
        </Link>
      )}
    </li>
  );
}
