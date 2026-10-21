'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DOCUMENT_TYPES, KNOWN_SOURCES, LEGISLATION_TYPES, SUBJECTS } from '@/lib/legalLibrary';
import { LegalDocumentUpdateSchema } from '@/schemas/legalDocument.schema';

export type EditableDocument = {
  id: string;
  title: string;
  category: string;
  subjects: string[];
  description: string | null;
  actNumber: string | null;
  year: number | null;
  consolidatedToYear: number | null;
  amendsId: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  _count?: { amendments: number };
};
type Law = { id: string; title: string; status: string };

const field = 'w-full border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#bfa37a] focus:outline-none';
const label = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500';

/** Change a document's details: its type, subjects, the law it amends, its source. */
export function EditDocumentDialog({ doc, onClose, onSaved }: { doc: EditableDocument; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: doc.title,
    category: doc.category,
    subjects: doc.subjects,
    description: doc.description ?? '',
    actNumber: doc.actNumber ?? '',
    year: doc.year?.toString() ?? '',
    consolidatedToYear: doc.consolidatedToYear?.toString() ?? '',
    amendsId: doc.amendsId ?? '',
    sourceName: doc.sourceName ?? '',
    sourceUrl: doc.sourceUrl ?? '',
  });
  const [laws, setLaws] = useState<Law[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const isLegislation = (LEGISLATION_TYPES as string[]).includes(form.category);
  const hasAmendments = (doc._count?.amendments ?? 0) > 0;

  useEffect(() => {
    fetch('/api/admin/legal-documents?view=laws')
      .then((r) => r.json())
      .then((d) => setLaws((d.laws || []).filter((l: Law) => l.id !== doc.id)))
      .catch(() => {});
  }, [doc.id]);

  const save = async (extra: { markChecked?: true } = {}) => {
    const body = {
      ...form,
      description: form.description || null,
      actNumber: form.actNumber || null,
      amendsId: isLegislation ? form.amendsId || null : null,
      sourceName: form.sourceName || null,
      ...extra,
    };
    const checked = LegalDocumentUpdateSchema.safeParse(body);
    if (!checked.success) {
      toast.error(checked.error.issues[0]?.message ?? 'Check the details.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/legal-documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(extra.markChecked ? 'Saved, and marked as checked today.' : 'Saved.');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-doc-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-neutral-200 bg-white p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="edit-doc-title" className="text-sm font-bold uppercase tracking-wide text-neutral-900">Edit details</h3>

        <div>
          <label htmlFor="ed-title" className={label}>Title</label>
          <input id="ed-title" value={form.title} onChange={set('title')} className={field} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ed-type" className={label}>Type</label>
            <select id="ed-type" value={form.category} onChange={set('category')} className={field}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value} disabled={hasAmendments && !(LEGISLATION_TYPES as string[]).includes(t.value)}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {isLegislation && (
            <div>
              <label htmlFor="ed-amends" className={label}>Amends which law?</label>
              <select id="ed-amends" value={form.amendsId} onChange={set('amendsId')} disabled={hasAmendments} className={field}>
                <option value="">None - this is the law itself</option>
                {laws.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
              {hasAmendments && <p className="mt-1 text-xs text-neutral-500">Other Acts amend this law, so it is a law itself.</p>}
            </div>
          )}
        </div>

        <fieldset>
          <legend className={label}>Subjects</legend>
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => {
              const on = form.subjects.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      subjects: on ? f.subjects.filter((x) => x !== s.value) : f.subjects.length < 4 ? [...f.subjects, s.value] : f.subjects,
                    }))
                  }
                  className={`px-2 py-1 text-[11px] border ${on ? 'border-[#bfa37a] bg-[#bfa37a] text-white' : 'border-neutral-200 text-neutral-600 hover:border-[#bfa37a]/50'}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ed-number" className={label}>Number</label>
            <input id="ed-number" value={form.actNumber} onChange={set('actNumber')} placeholder="No. 2 of 1883" className={field} />
          </div>
          <div>
            <label htmlFor="ed-year" className={label}>Year</label>
            <input id="ed-year" type="number" value={form.year} onChange={set('year')} className={field} />
          </div>
          <div>
            <label htmlFor="ed-cto" className={label}>Amendments up to</label>
            <input id="ed-cto" type="number" value={form.consolidatedToYear} onChange={set('consolidatedToYear')} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ed-source" className={label}>Source</label>
            <input id="ed-source" list="ed-sources" value={form.sourceName} onChange={set('sourceName')} className={field} />
            <datalist id="ed-sources">{KNOWN_SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label htmlFor="ed-url" className={label}>Source web address</label>
            <input id="ed-url" type="url" value={form.sourceUrl} onChange={set('sourceUrl')} className={field} />
          </div>
        </div>

        <div>
          <label htmlFor="ed-desc" className={label}>Description</label>
          <textarea id="ed-desc" rows={2} value={form.description} onChange={set('description')} className={`${field} resize-none`} />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900">Cancel</button>
          <button
            onClick={() => save({ markChecked: true })}
            disabled={saving}
            title="Save, and record that you checked today that no newer text or amendment exists"
            className="border border-neutral-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            Save and mark checked
          </button>
          <button onClick={() => save()} disabled={saving} className="bg-[#0a0a0a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-neutral-800 disabled:opacity-50">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
