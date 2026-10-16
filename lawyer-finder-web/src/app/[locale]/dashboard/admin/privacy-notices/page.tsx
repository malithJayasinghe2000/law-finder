'use client';

/**
 * The privacy-notice register, for administrators.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Publishing here changes the document every future consent record points at,
 * so the screen is built to make that weight visible rather than to make
 * publishing quick:
 *
 *   - A new draft starts pre-filled with the text currently in force. The
 *     realistic edit is "change two paragraphs", and making somebody retype a
 *     legal document from scratch is how clauses go missing.
 *   - The preview is the SAME component the public page renders. An admin who
 *     approves a preview built from different markup has approved something
 *     else.
 *   - Publishing shows how many people agreed under the version being
 *     superseded, because that number is the reason the old version can never
 *     be edited or deleted.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  FileText, Plus, Loader2, Eye, Send, Trash2, AlertTriangle, Lock, PenSquare, X,
} from 'lucide-react';
import NoticeDocument from '@/components/privacy/NoticeDocument';

type Notice = {
  id: string;
  version: string;
  title: string;
  body: string;
  changeSummary: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  publishedAt: string | null;
  publishedById: string | null;
  createdAt: string;
  updatedAt: string;
  consentRecordsAgreedUnderIt: number;
  editable: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  SUPERSEDED: 'bg-neutral-100 text-neutral-600',
};

/** Today as a version label, which is what an admin almost always wants. */
function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PrivacyNoticesPage() {
  const { locale } = useParams();

  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [currentBody, setCurrentBody] = useState('');
  const [dangling, setDangling] = useState<string[]>([]);

  const [editing, setEditing] = useState<Notice | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ version: '', title: 'Privacy Notice', body: '', changeSummary: '' });

  const load = async () => {
    try {
      const res = await fetch('/api/admin/privacy-notices');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotices(data.notices ?? []);
      setCurrentVersion(data.currentVersion ?? null);
      setCurrentBody(data.currentBody ?? '');
      setDangling(data.danglingVersions ?? []);
    } catch {
      toast.error('Could not load the notice register.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNewDraft = () => {
    setEditing(null);
    setCreating(true);
    setForm({
      version: todayLabel(),
      title: 'Privacy Notice',
      // Pre-filled with what is in force. See the header comment.
      body: currentBody,
      changeSummary: '',
    });
  };

  const startEdit = (n: Notice) => {
    setCreating(false);
    setEditing(n);
    setForm({
      version: n.version,
      title: n.title,
      body: n.body,
      changeSummary: n.changeSummary ?? '',
    });
  };

  const closeEditor = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = creating
        ? await fetch('/api/admin/privacy-notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              version: form.version.trim(),
              title: form.title.trim(),
              body: form.body,
              changeSummary: form.changeSummary.trim() || undefined,
            }),
          })
        : await fetch(`/api/admin/privacy-notices/${editing!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: form.title.trim(),
              body: form.body,
              changeSummary: form.changeSummary.trim() || null,
            }),
          });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(
          typeof data.error === 'string' ? data.error : 'Could not save that draft.'
        );
        return;
      }

      toast.success(creating ? 'Draft created. Nothing is public until you publish it.' : 'Draft saved.');
      closeEditor();
      await load();
    } catch {
      toast.error('Could not save that draft.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async (n: Notice) => {
    const superseded = notices.find((x) => x.status === 'PUBLISHED');
    const warning = superseded
      ? `Publish version ${n.version}?\n\nThis supersedes version ${superseded.version}, which ` +
        `${superseded.consentRecordsAgreedUnderIt} consent record(s) point at. That version stays ` +
        `readable at its own address permanently - it is evidence of what those people agreed to.`
      : `Publish version ${n.version}? It becomes the notice in force.`;

    if (!confirm(warning)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/privacy-notices/${n.id}/publish`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Could not publish.');
        return;
      }

      toast.success(`Version ${data.version} is now in force.`);
      await load();
    } catch {
      toast.error('Could not publish.');
    } finally {
      setBusy(false);
    }
  };

  const discard = async (n: Notice) => {
    if (!confirm(`Discard draft ${n.version}? It has never been in force and nobody has agreed to it.`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/privacy-notices/${n.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Could not discard it.');
        return;
      }

      toast.success('Draft discarded.');
      await load();
    } catch {
      toast.error('Could not discard it.');
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bfa37a]">
            <FileText className="h-3.5 w-3.5" />
            Data protection
          </div>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-neutral-900">
            Privacy Notice
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Every published version is kept permanently at its own address. Publishing creates a
            new version and supersedes the old one - it never edits one in place, because consent
            records point at the exact words people were shown.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/${locale}/privacy`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <Eye className="h-4 w-4" />
            View public page
          </Link>
          <button
            onClick={startNewDraft}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            New version
          </button>
        </div>
      </header>

      {dangling.length > 0 && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <h2 className="text-sm font-bold text-red-900">
              Consent records point at versions that are not in this register
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-red-900/80">
              {dangling.join(', ')} - consent recorded against a document that cannot be produced
              is not demonstrable consent. Add a version under that exact label holding the
              wording those people were shown.
            </p>
          </div>
        </div>
      )}

      {/* ─── Editor ───────────────────────────────────────────────────── */}
      {(creating || editing) && (
        <section className="mt-8 rounded-2xl border border-neutral-300 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg tracking-tight text-neutral-900">
              {creating ? 'New version' : `Editing draft ${editing?.version}`}
            </h2>
            <button onClick={closeEditor} className="rounded-lg p-1.5 hover:bg-neutral-100">
              <X className="h-4 w-4 text-neutral-500" />
            </button>
          </div>

          {creating && currentVersion && (
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              Pre-filled with the text of version {currentVersion}, which is in force today. Edit
              what changed rather than starting from an empty page.
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Version label
              </label>
              <input
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                disabled={!creating}
                placeholder="2026-09-06"
                className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-2.5 font-mono text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500"
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                {creating
                  ? 'A date. Add a suffix (2026-09-06-b) to publish twice in one day. Never reused.'
                  : 'A label cannot be changed - consent records point at it.'}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Title
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              What changed, in plain language
            </label>
            <input
              value={form.changeSummary}
              onChange={(e) => setForm({ ...form, changeSummary: e.target.value })}
              placeholder="e.g. Named the country the database is hosted in."
              className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-neutral-900"
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Shown at the top of the superseded version, so a reader can see why they are
              looking at an old one.
            </p>
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              The notice (Markdown)
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={20}
              className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-neutral-900"
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              {form.body.length} characters. It must match{' '}
              <span className="font-semibold">DATA-INVENTORY.md</span> - if they disagree, one of
              them is a lie, and the inventory is the source of truth.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={save}
              disabled={busy || form.body.trim().length < 200 || !form.version.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenSquare className="h-4 w-4" />}
              {creating ? 'Create draft' : 'Save draft'}
            </button>
            <button
              onClick={() =>
                setPreviewing({
                  id: 'preview',
                  version: form.version || 'draft',
                  title: form.title,
                  body: form.body,
                  changeSummary: form.changeSummary || null,
                  status: 'DRAFT',
                  publishedAt: null,
                  publishedById: null,
                  createdAt: '',
                  updatedAt: '',
                  consentRecordsAgreedUnderIt: 0,
                  editable: true,
                })
              }
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>
          {form.body.trim().length < 200 && (
            <p className="mt-2 text-xs text-amber-700">
              A notice this short is a placeholder. Publishing is refused below 200 characters.
            </p>
          )}
        </section>
      )}

      {/* ─── The register ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-serif text-lg tracking-tight text-neutral-900">Versions</h2>

        {notices.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
            <p className="text-sm leading-relaxed text-amber-900">
              Nothing has been published. Until a version exists, new consents are refused -
              recording agreement to a document that cannot be produced is not consent.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {notices.map((n) => (
              <div key={n.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-neutral-900">
                        {n.version}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[n.status]}`}
                      >
                        {n.status}
                      </span>
                      {!n.editable && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          <Lock className="h-3 w-3" />
                          locked
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-neutral-600">{n.title}</p>
                    {n.changeSummary && (
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                        {n.changeSummary}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-neutral-500">
                      {n.publishedAt
                        ? `In force from ${new Date(n.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                        : 'Never published'}
                      {' · '}
                      <span className="font-semibold">
                        {n.consentRecordsAgreedUnderIt} consent record
                        {n.consentRecordsAgreedUnderIt === 1 ? '' : 's'}
                      </span>{' '}
                      point at it
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPreviewing(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>

                    {n.status !== 'DRAFT' && (
                      <Link
                        href={`/${locale}/privacy/${n.version}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        Public URL
                      </Link>
                    )}

                    {n.editable && (
                      <>
                        <button
                          onClick={() => startEdit(n)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          <PenSquare className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => publish(n)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Publish
                        </button>
                        <button
                          onClick={() => discard(n)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Discard
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Preview ──────────────────────────────────────────────────── */}
      {previewing && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 p-4 sm:p-8"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="mx-auto max-w-4xl rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-neutral-200 bg-white px-5 py-3">
              <p className="text-sm font-semibold text-neutral-900">
                Preview - exactly what the public page renders
              </p>
              <button
                onClick={() => setPreviewing(null)}
                className="rounded-lg p-1.5 hover:bg-neutral-100"
              >
                <X className="h-4 w-4 text-neutral-500" />
              </button>
            </div>
            <NoticeDocument
              title={previewing.title}
              version={previewing.version}
              body={previewing.body}
              changeSummary={previewing.changeSummary}
              status={previewing.status}
              publishedAt={previewing.publishedAt}
            />
          </div>
        </div>
      )}
    </div>
  );
}
