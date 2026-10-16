'use client';

/**
 * "Your data" — where a person exercises their PDPA rights.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS SCREEN IS THE POINT OF PHASE 8.
 *
 * Phase 6 built the whole rights engine — export, erasure, consent, referral to
 * the firm — and gave it no interface. That is the worst position available: the
 * work is done, the cost is paid, and the compliance posture is unchanged,
 * because a right nobody can reach has not been offered. A regulator would see
 * rights that were built and never given to anyone.
 *
 * THREE THINGS THIS SCREEN MUST NOT DO, each of which would be an easy mistake:
 *
 *   1. **Offer a fourth consent toggle.** There are exactly three consent
 *      purposes and matter data is deliberately not one of them. Matter data
 *      rests on contract and the firm's professional duty; presenting it as
 *      consent would promise a withdrawal we cannot honour against a firm that
 *      is required to keep the file.
 *
 *   2. **Call erasure "delete my account" and leave it there.** It is partial
 *      and irreversible. The person is told what survives and which duty
 *      required it BEFORE they confirm — a refusal that does not name the duty
 *      is not a defensible refusal.
 *
 *   3. **Show matter content.** Counts and the firm's name only. The file
 *      belongs to the firm; we are its processor.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Shield, Download, Trash2, Loader2, AlertTriangle, X,
  FileText, Lock, Building2, Save, ExternalLink,
} from 'lucide-react';

type Holding = {
  tier: 1 | 2 | 3 | 4;
  category: string;
  whatItIs: string;
  count: number | null;
  retention: string;
  controller: 'PLATFORM' | 'FIRM';
};

type Purpose = {
  purpose: string;
  label: string;
  description: string;
  onWithdrawal: string;
  granted: boolean;
  decidedAt: string | null;
  noticeVersionAgreed: string | null;
  noticeVersionResolves: boolean | null;
};

type ErasurePreview = {
  willDelete: string[];
  willAnonymise: string[];
  willBeKept: { model: string; why: string }[];
  partial: boolean;
};

const TIER_LABEL: Record<number, string> = {
  1: 'Privileged — your legal matters',
  2: 'Sensitive',
  3: 'Identity and credentials',
  4: 'Ordinary',
};

// The person's own requests, in words. These showed the raw values ("ACCESS",
// "AWAITING_FIRM").
const REQUEST_TYPE_LABEL: Record<string, string> = {
  ACCESS: 'Copy of your data',
  PORTABILITY: 'Your data in a portable form',
  ERASURE: 'Delete your data',
  RECTIFICATION: 'Correct your data',
  OBJECTION: 'Objection',
};

const REQUEST_STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  AWAITING_FIRM: 'Waiting for a practice to answer',
  COMPLETED: 'Done',
  PARTIALLY_FULFILLED: 'Partly done',
  REFUSED: 'Refused',
};

export default function YourDataPage() {
  const { locale } = useParams();

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [firms, setFirms] = useState<{ firmId: string; firmName: string; matterCount: number }[]>([]);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [noticePublished, setNoticePublished] = useState(true);
  const [currentNoticeVersion, setCurrentNoticeVersion] = useState<string | null>(null);
  const [erasurePreview, setErasurePreview] = useState<ErasurePreview | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [responseTargetDays, setResponseTargetDays] = useState(21);

  const [savingPurpose, setSavingPurpose] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [erasureOpen, setErasureOpen] = useState(false);
  const [erasureConfirmText, setErasureConfirmText] = useState('');
  const [erasing, setErasing] = useState(false);
  const [erasureResult, setErasureResult] = useState<any>(null);

  const load = async () => {
    try {
      const [meRes, consentRes, reqRes] = await Promise.all([
        fetch('/api/privacy/me'),
        fetch('/api/privacy/consents'),
        fetch('/api/privacy/requests'),
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        setAccount(me.account);
        setFullName(me.account?.fullName ?? '');
        setHoldings(me.holdings ?? []);
        setFirms(me.firmsHoldingMatters ?? []);
        setCurrentNoticeVersion(me.currentNoticeVersion ?? null);
      }

      if (consentRes.ok) {
        const c = await consentRes.json();
        setPurposes(c.purposes ?? []);
        setNoticePublished(c.noticePublished !== false);
      }

      if (reqRes.ok) {
        const r = await reqRes.json();
        setErasurePreview(r.erasurePreview ?? null);
        setRequests(r.requests ?? []);
        setResponseTargetDays(r.responseTargetDays ?? 21);
      }
    } catch {
      toast.error('Could not load your data settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleConsent = async (purpose: string, granted: boolean) => {
    setSavingPurpose(purpose);
    try {
      const res = await fetch('/api/privacy/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, granted }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // A 409 here is the fail-closed rule: we will not record agreement to a
        // document that cannot be produced. Show the reason verbatim rather
        // than a generic failure — it explains something true about us.
        toast.error(typeof data.error === 'string' ? data.error : 'Could not save that.');
        return;
      }

      toast.success(granted ? 'Recorded. You can withdraw this at any time.' : 'Withdrawn.');
      await load();
    } catch {
      toast.error('Could not save that.');
    } finally {
      setSavingPurpose(null);
    }
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      const res = await fetch('/api/privacy/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim() || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Corrected.');
      await load();
    } catch {
      toast.error('Could not save that correction.');
    } finally {
      setSavingName(false);
    }
  };

  const downloadExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/privacy/export');
      if (!res.ok) throw new Error();

      // Streamed to a blob and revoked immediately. The export contains the
      // person's AI conversations, so it should exist in the page for as long
      // as it takes to save it and no longer.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Downloaded. It does not contain your matter files — see below for why.');
    } catch {
      toast.error('Could not build your export.');
    } finally {
      setExporting(false);
    }
  };

  const requestErasure = async () => {
    setErasing(true);
    try {
      const res = await fetch('/api/privacy/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ERASURE', confirm: true }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Could not complete that.');
        return;
      }

      setErasureResult(data.result ?? null);
      setErasureOpen(false);
    } catch {
      toast.error('Could not complete that.');
    } finally {
      setErasing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  // After erasure the account is anonymised and the session is meaningless.
  // Showing the outcome rather than bouncing straight to the login page: the
  // person has just been told the deletion is partial, and the list of what
  // survived is the answer to their request.
  if (erasureResult) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="font-serif text-2xl tracking-tight text-neutral-900">
          Your account has been erased
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Your name, email address, photograph and sign-in credentials have been overwritten.
          You will not be able to sign in again with them.
        </p>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            What was kept, and why
          </h2>
          <ul className="mt-3 space-y-3">
            {(erasureResult.retained ?? []).map((r: any) => (
              <li key={r.model} className="text-sm leading-relaxed text-amber-900/90">
                <span className="font-semibold">{r.model}</span> — {r.explanation}
              </li>
            ))}
          </ul>
          {erasureResult.referredFirmIds?.length > 0 && (
            <p className="mt-4 text-sm leading-relaxed text-amber-900/90">
              Your request has been referred to {erasureResult.referredFirmIds.length} law
              firm{erasureResult.referredFirmIds.length === 1 ? '' : 's'} holding a matter for
              you. They decide what happens to your file — an attorney may be professionally
              required to keep it.
            </p>
          )}
        </div>

        <Link
          href={`/${locale}`}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Back to the site
        </Link>
      </div>
    );
  }

  const grouped = [1, 2, 3, 4]
    .map((tier) => ({ tier, items: holdings.filter((h) => h.tier === tier) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <header className="border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bfa37a]">
          <Shield className="h-3.5 w-3.5" />
          Data protection
        </div>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-neutral-900">Your data</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
          What we hold about you, what you have agreed to, and how to get a copy or ask us to
          delete your account. The full explanation is in the{' '}
          <Link href={`/${locale}/privacy`} className="font-semibold underline underline-offset-2">
            Privacy Notice
          </Link>
          {currentNoticeVersion && <> (version {currentNoticeVersion})</>}.
        </p>

        {/* The page runs to many screens on a phone; this gets a person to the
            right part — deletion especially — without scrolling past everything. */}
        <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2 text-xs">
          {[
            ['#hold', 'What we hold'],
            ['#choices', 'Your choices'],
            ['#correct', 'Correct'],
            ['#download', 'Download'],
            ['#delete', 'Delete account'],
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
      </header>

      {/* ─── What we hold ─────────────────────────────────────────────── */}
      <section id="hold" className="scroll-mt-20 mt-10">
        <h2 className="font-serif text-xl tracking-tight text-neutral-900">What we hold</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Categories and how many, not the contents. To read the contents, download your data
          below.
        </p>

        <div className="mt-6 space-y-8">
          {grouped.map((group) => (
            <div key={group.tier}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                {TIER_LABEL[group.tier]}
              </h3>
              <div className="mt-3 space-y-3">
                {group.items.map((h) => (
                  <div
                    key={h.category}
                    className={`rounded-2xl border p-5 ${
                      h.controller === 'FIRM'
                        ? 'border-[#efeae0] bg-[#fbf9f6]'
                        : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {h.controller === 'FIRM' && <Lock className="h-4 w-4 text-[#bfa37a]" />}
                        <h4 className="text-sm font-bold text-neutral-900">{h.category}</h4>
                      </div>
                      {h.count !== null && (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          {h.count}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{h.whatItIs}</p>
                    {h.retention && (
                      <p className="mt-2 text-xs text-neutral-500">
                        <span className="font-semibold">Kept:</span> {h.retention}
                      </p>
                    )}
                    {h.controller === 'FIRM' && (
                      <p className="mt-2 text-xs font-semibold text-[#bfa37a]">
                        The law firm decides on this, not us.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {firms.length > 0 && (
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
              <Building2 className="h-4 w-4 text-neutral-400" />
              Firms holding a matter for you
            </h3>
            <ul className="mt-3 space-y-2">
              {firms.map((f) => (
                <li key={f.firmId} className="text-sm text-neutral-600">
                  <span className="font-semibold text-neutral-900">{f.firmName}</span> —{' '}
                  {f.matterCount} matter{f.matterCount === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
              Ask these firms directly to see or delete a matter file. We pass your request to
              them automatically, and they decide — an attorney may be professionally required
              to keep a file.
            </p>
          </div>
        )}
      </section>

      {/* ─── Consents ─────────────────────────────────────────────────── */}
      <section id="choices" className="scroll-mt-20 mt-12">
        <h2 className="font-serif text-xl tracking-tight text-neutral-900">
          The three things we ask consent for
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          These are the only things on this platform that run on your consent, and refusing all
          three costs you nothing. Everything else — your account, and your matter with a law
          firm — rests on our contract with you and on the firm&apos;s professional duties, which
          is why they are not offered here as switches.
        </p>

        {!noticePublished && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm leading-relaxed text-amber-900">
              No privacy notice is currently published, so we cannot record what you were shown
              when you agreed. New consents are refused until one is. You can still withdraw a
              consent — that is your right, and a gap in our paperwork is not a reason to
              refuse it.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {purposes.map((p) => (
            <div key={p.purpose} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-neutral-900">{p.label}</h3>
                    {/* The state, stated. The button is the action, so on its own a
                        tick next to "Agree" read as "already agreed". */}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        p.granted ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {p.granted ? 'Agreed' : 'Not agreed'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                    {p.description}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                    <span className="font-semibold">If you withdraw:</span> {p.onWithdrawal}
                  </p>

                  {p.decidedAt && (
                    <p className="mt-2 text-xs text-neutral-400">
                      {p.granted ? 'Agreed' : 'Withdrawn'} on{' '}
                      {new Date(p.decidedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {p.noticeVersionAgreed && (
                        <>
                          {' '}
                          under notice version{' '}
                          {p.noticeVersionResolves ? (
                            <Link
                              href={`/${locale}/privacy/${p.noticeVersionAgreed}`}
                              className="font-semibold underline underline-offset-2"
                            >
                              {p.noticeVersionAgreed}
                            </Link>
                          ) : (
                            // Never a link that goes nowhere. The same rule as a
                            // dead AI citation: a reference the reader cannot open
                            // manufactures authority it does not have.
                            <span className="font-semibold">
                              {p.noticeVersionAgreed} (no longer on file)
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => toggleConsent(p.purpose, !p.granted)}
                  disabled={savingPurpose === p.purpose}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    p.granted
                      ? 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  {savingPurpose === p.purpose ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : p.granted ? (
                    <X className="h-4 w-4" />
                  ) : null}
                  {p.granted ? 'Withdraw' : 'Agree'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Correct your details ─────────────────────────────────────── */}
      <section id="correct" className="scroll-mt-20 mt-12">
        <h2 className="font-serif text-xl tracking-tight text-neutral-900">Correct your details</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          You can correct what you told us about yourself. You cannot edit a matter file — it is
          the firm&apos;s record of what happened, and a client rewriting it would corrupt the file
          rather than correct it. Send a correction to the firm and they will decide.
        </p>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Your name
          </label>
          <div className="mt-2 flex flex-wrap gap-3">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
              placeholder="Your name"
            />
            <button
              onClick={saveName}
              disabled={savingName || fullName === (account?.fullName ?? '')}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Signed in as {account?.email}. Changing your email address is done from{' '}
            <Link href={`/${locale}/dashboard/profile`} className="underline underline-offset-2">
              Profile Settings
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ─── Download ─────────────────────────────────────────────────── */}
      <section id="download" className="scroll-mt-20 mt-12">
        <h2 className="font-serif text-xl tracking-tight text-neutral-900">Download your data</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          A file containing your account, your consents, your conversations with the legal
          assistant, your community activity and any attorney application.
        </p>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 className="text-sm font-bold text-neutral-900">
            It does not contain your matter files. That is deliberate.
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-neutral-600">
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#bfa37a]" />
              Those belong to the law firm, not to us. We host them as the firm&apos;s processor,
              and a processor releasing them on its own authority is the one thing a processor
              may not do.
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#bfa37a]" />
              A conflict-of-interest record <span className="font-semibold">names other people</span>{' '}
              — other clients, opposing parties. Answering your request by handing it over would
              breach several other people&apos;s confidentiality at once.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            The file names the firms to ask instead.
          </p>

          <button
            onClick={downloadExport}
            disabled={exporting}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download my data
          </button>
        </div>
      </section>

      {/* ─── Requests already made ────────────────────────────────────── */}
      {requests.length > 0 && (
        <section id="requests" className="scroll-mt-20 mt-12">
          <h2 className="font-serif text-xl tracking-tight text-neutral-900">
            Requests you have made
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            We aim to answer within {responseTargetDays} days.
          </p>
          <ul className="mt-4 space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-neutral-900">
                    {REQUEST_TYPE_LABEL[r.type] ?? r.type}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {REQUEST_STATUS_LABEL[r.status] ?? r.status} · raised{' '}
                    {new Date(r.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/*
                  The firms' answers. Referring a request onward and never
                  showing what came back would make the referral a black hole
                  from the person's side — they would see AWAITING_FIRM and
                  never learn what the firm decided.
                */}
                {r.firmResponses?.length > 0 ? (
                  <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
                    {r.firmResponses.map((fr: any, i: number) => (
                      <div key={i}>
                        <p className="text-xs font-bold text-neutral-900">
                          {fr.firmName} answered
                        </p>
                        <p className="mt-1.5 rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700">
                          {fr.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  r.status === 'AWAITING_FIRM' && (
                    <p className="mt-3 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500">
                      Referred to the law firm holding your matter. They decide what happens to
                      the file — we host it for them and cannot release or delete it on our own
                      authority. Their answer will appear here.
                    </p>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Erasure ──────────────────────────────────────────────────── */}
      <section id="delete" className="scroll-mt-20 mt-12 mb-16">
        <h2 className="font-serif text-xl tracking-tight text-neutral-900">Delete your account</h2>

        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-red-900">
            <AlertTriangle className="h-4 w-4" />
            This is partial, and it cannot be undone
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-red-900/80">
            We do not delete the account record itself. Matters reference you for years, and
            removing the row outright would damage or orphan a law firm&apos;s file — which is not
            ours to break. Instead your identifying details are overwritten and the account is
            closed permanently.
          </p>

          {erasurePreview && (
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-700">
                  Deleted
                </h4>
                <ul className="mt-2 space-y-2">
                  {erasurePreview.willDelete.map((d, i) => (
                    <li key={i} className="text-xs leading-relaxed text-red-900/80">{d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-700">
                  Overwritten or detached
                </h4>
                <ul className="mt-2 space-y-2">
                  {erasurePreview.willAnonymise.map((d, i) => (
                    <li key={i} className="text-xs leading-relaxed text-red-900/80">{d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-700">
                  Kept — and why
                </h4>
                <ul className="mt-2 space-y-2">
                  {erasurePreview.willBeKept.map((k) => (
                    <li key={k.model} className="text-xs leading-relaxed text-red-900/80">
                      <span className="font-semibold">{k.model}:</span> {k.why}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {!erasureOpen ? (
            <button
              onClick={() => setErasureOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Ask us to delete my account
            </button>
          ) : (
            <div className="mt-6 rounded-xl border border-red-300 bg-white p-5">
              <p className="text-sm font-semibold text-neutral-900">
                Type <span className="font-mono">DELETE</span> to confirm.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                You will be signed out and will not be able to sign in again. Anything listed
                under &ldquo;Kept&rdquo; above stays, and we will tell you which duty required each one.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  value={erasureConfirmText}
                  onChange={(e) => setErasureConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="min-w-0 flex-1 rounded-xl border border-neutral-300 px-4 py-2.5 font-mono text-sm outline-none focus:border-red-500"
                />
                <button
                  onClick={requestErasure}
                  disabled={erasureConfirmText !== 'DELETE' || erasing}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {erasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Erase my account
                </button>
                <button
                  onClick={() => {
                    setErasureOpen(false);
                    setErasureConfirmText('');
                  }}
                  className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-neutral-500">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          You can also complain to Sri Lanka&apos;s Data Protection Authority, and you do not have
          to come to us first. Write to{' '}
          <a href="mailto:hello@thelawyr.lk" className="underline underline-offset-2">
            hello@thelawyr.lk
          </a>{' '}
          for anything else.
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0" />
        </p>
      </section>
    </div>
  );
}
