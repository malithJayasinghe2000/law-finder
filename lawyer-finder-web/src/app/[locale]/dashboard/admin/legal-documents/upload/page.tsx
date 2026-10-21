'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Upload, FileText, ArrowLeft, CheckCircle2, XCircle, Loader2, CloudUpload, Hourglass
} from 'lucide-react';
import { CASE_LAW_TYPES, DOCUMENT_TYPES, KNOWN_SOURCES, LEGISLATION_TYPES, SUBJECTS } from '@/lib/legalLibrary';
import { LegalDocumentUploadSchema } from '@/schemas/legalDocument.schema';

type Law = { id: string; title: string; status: string };

const inputClass =
  'w-full px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a]';
const OTHER_SOURCE = '__other__';

export default function UploadLegalDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Filling in the original text of a law listed without it (AWAITING_ORIGINAL).
  const originalForId = searchParams.get('originalFor') || '';

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [actNumber, setActNumber] = useState('');
  const [year, setYear] = useState('');
  const [consolidatedToYear, setConsolidatedToYear] = useState('');
  const [courtName, setCourtName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [gazetteNumber, setGazetteNumber] = useState('');
  const [amendsId, setAmendsId] = useState('');
  const [sourceChoice, setSourceChoice] = useState('');
  const [sourceOther, setSourceOther] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [laws, setLaws] = useState<Law[]>([]);
  const [waitingFor, setWaitingFor] = useState<{ title: string; amendments: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; title?: string; error?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const isLegislation = (LEGISLATION_TYPES as string[]).includes(category);
  const isCaseLaw = (CASE_LAW_TYPES as string[]).includes(category);
  const isGazette = category === 'GAZETTE_NOTIFICATIONS';

  useEffect(() => {
    fetch('/api/admin/legal-documents?view=laws')
      .then((r) => r.json())
      .then((d) => setLaws(d.laws || []))
      .catch(() => toast.error('Could not load the list of laws.'));
  }, []);

  useEffect(() => {
    if (!originalForId) return;
    fetch(`/api/admin/legal-documents/${originalForId}`)
      .then((r) => r.json())
      .then((d) => {
        const doc = d.document;
        if (!doc || doc.status !== 'AWAITING_ORIGINAL') {
          toast.error('That law already has its text.');
          return;
        }
        setTitle(doc.title);
        setCategory(doc.category);
        setSubjects(doc.subjects || []);
        setWaitingFor({ title: doc.title, amendments: d.amendmentCount ?? 0 });
      })
      .catch(() => toast.error('Could not load that law.'));
  }, [originalForId]);

  const takeFile = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.type !== 'application/pdf' && !picked.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted');
      return;
    }
    setFile(picked);
    if (!title) setTitle(picked.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '));
  };

  const toggleSubject = (value: string) =>
    setSubjects((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : prev.length < 4 ? [...prev, value] : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Choose a PDF to upload.');
      return;
    }

    const fields = {
      title,
      category,
      subjects: subjects.join(','),
      description,
      actNumber: isLegislation ? actNumber : '',
      year,
      consolidatedToYear: isLegislation ? consolidatedToYear : '',
      courtName: isCaseLaw ? courtName : '',
      caseNumber: isCaseLaw ? caseNumber : '',
      gazetteNumber: isGazette ? gazetteNumber : '',
      amendsId: isLegislation && !originalForId ? amendsId : '',
      sourceName: sourceChoice === OTHER_SOURCE ? sourceOther : sourceChoice,
      sourceUrl,
      originalForId,
    };
    // The same rules the server applies, so a mistake is shown before the upload.
    const checked = LegalDocumentUploadSchema.safeParse(fields);
    if (!checked.success) {
      toast.error(checked.error.issues[0]?.message ?? 'Check the form.');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      for (const [k, v] of Object.entries(fields)) if (v) formData.append(k, v);

      const res = await fetch('/api/admin/legal-documents', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadResult({ success: true, title: data.document?.title });
        toast.success('Uploaded. The AI is reading it now.');
      } else {
        setUploadResult({ success: false, error: data.error });
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      setUploadResult({ success: false, error: 'Network error' });
      toast.error('Network error during upload');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/${locale}/dashboard/admin/legal-documents`)}
          aria-label="Back to Legal Documents"
          className="p-2.5 border border-neutral-200 rounded-none hover:bg-neutral-50 transition"
        >
          <ArrowLeft className="w-4 h-4 text-neutral-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 font-serif tracking-tight">
            {originalForId ? 'Add the Original Text' : 'Upload Legal Document'}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">The PDF is shown in the library and read by the AI.</p>
        </div>
      </div>

      {waitingFor && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Adding the text of <strong>{waitingFor.title}</strong>. The Acts already linked as its amendments stay linked.
          </p>
        </div>
      )}

      {uploadResult && (
        <div className={`rounded-none border p-5 ${uploadResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            {uploadResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
            <div>
              <h3 className={`font-semibold text-sm ${uploadResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                {uploadResult.success ? 'Uploaded - the AI is reading it' : 'Upload Failed'}
              </h3>
              {uploadResult.success ? (
                <div className="mt-2 text-sm text-emerald-700 space-y-1">
                  <p>Title: <strong>{uploadResult.title}</strong></p>
                  <p>Indexing can take several minutes for a long Act. The document list shows &ldquo;Processing&rdquo;
                    until it is done, then &ldquo;Active&rdquo; (or &ldquo;Failed&rdquo;, with the reason).</p>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/admin/legal-documents`)}
                    className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest transition rounded-none"
                  >
                    View All Documents
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-sm text-red-700">{uploadResult.error}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose a PDF file"
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-none p-10 text-center cursor-pointer transition-all duration-200 ${
            dragOver ? 'border-[#bfa37a] bg-[#bfa37a]/5'
              : file ? 'border-emerald-300 bg-emerald-50'
                : 'border-neutral-300 bg-neutral-50 hover:border-[#bfa37a] hover:bg-[#bfa37a]/5'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => takeFile(e.target.files?.[0])} className="hidden" />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-10 h-10 text-emerald-500" />
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-neutral-900 truncate">{file.name}</p>
                <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                aria-label="Remove file"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="ml-4 p-1.5 text-neutral-400 hover:text-red-500 rounded-none hover:bg-red-50 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div>
              <CloudUpload className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-700">Drop a PDF file here or click to browse</p>
              <p className="text-xs text-neutral-500 mt-1">Only PDF files are supported</p>
            </div>
          )}
        </div>

        {/* What it is */}
        <div className="bg-white border border-neutral-200 rounded-none p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">What it is</h3>

          <div>
            <label htmlFor="doc-title" className="block text-sm font-medium text-neutral-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Penal Code"
              className={inputClass}
              required
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-neutral-700 mb-1.5">
              Type <span className="text-red-500">*</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DOCUMENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={category === t.value}
                  disabled={!!waitingFor && !(LEGISLATION_TYPES as string[]).includes(t.value)}
                  onClick={() => setCategory(t.value)}
                  className={`text-left px-4 py-3 border transition-all duration-200 rounded-none disabled:opacity-40 ${
                    category === t.value ? 'border-[#bfa37a] bg-[#bfa37a]/10 shadow-sm' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <p className={`text-sm font-semibold ${category === t.value ? 'text-[#a68d67]' : 'text-neutral-800'}`}>{t.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{t.hint}</p>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="block text-sm font-medium text-neutral-700 mb-1.5">Subjects (up to four)</legend>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => {
                const on = subjects.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSubject(s.value)}
                    className={`px-3 py-1.5 text-xs border transition-colors ${on ? 'border-[#bfa37a] bg-[#bfa37a] text-white' : 'border-neutral-200 text-neutral-700 hover:border-[#bfa37a]/50'}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {isLegislation && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="doc-number" className="block text-sm font-medium text-neutral-700 mb-1.5">Number</label>
                  <input id="doc-number" type="text" value={actNumber} onChange={(e) => setActNumber(e.target.value)} placeholder="e.g., No. 2 of 1883" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="doc-year" className="block text-sm font-medium text-neutral-700 mb-1.5">Year enacted</label>
                  <input id="doc-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g., 1883" min="1800" max="2100" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="doc-cto" className="block text-sm font-medium text-neutral-700 mb-1.5">Includes amendments up to</label>
                  <input id="doc-cto" type="number" value={consolidatedToYear} onChange={(e) => setConsolidatedToYear(e.target.value)} placeholder="e.g., 1980" min="1800" max="2100" className={inputClass} />
                </div>
              </div>
              <p className="-mt-2 text-xs text-neutral-500">
                &ldquo;Includes amendments up to&rdquo; is for a revised or consolidated text, e.g. 1980 for the 1980 Revised Edition. Leave it empty for a text as enacted.
              </p>

              {!originalForId && (
                <div>
                  <label htmlFor="doc-amends" className="block text-sm font-medium text-neutral-700 mb-1.5">Amends which law?</label>
                  <select id="doc-amends" value={amendsId} onChange={(e) => setAmendsId(e.target.value)} className={inputClass}>
                    <option value="">None - this is the law itself</option>
                    {laws.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}{l.status === 'AWAITING_ORIGINAL' ? ' (original being added)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-500">An amending Act is listed on its law&apos;s page, not on its own in the library.</p>
                </div>
              )}
            </>
          )}

          {isCaseLaw && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="doc-court" className="block text-sm font-medium text-neutral-700 mb-1.5">Court</label>
                <input id="doc-court" type="text" value={courtName} onChange={(e) => setCourtName(e.target.value)} placeholder="e.g., Supreme Court" className={inputClass} />
              </div>
              <div>
                <label htmlFor="doc-case" className="block text-sm font-medium text-neutral-700 mb-1.5">Case number</label>
                <input id="doc-case" type="text" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="e.g., SC Appeal 123/2024" className={inputClass} />
              </div>
              <div>
                <label htmlFor="doc-year-case" className="block text-sm font-medium text-neutral-700 mb-1.5">Year decided</label>
                <input id="doc-year-case" type="number" value={year} onChange={(e) => setYear(e.target.value)} min="1800" max="2100" className={inputClass} />
              </div>
            </div>
          )}

          {isGazette && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="doc-gazette" className="block text-sm font-medium text-neutral-700 mb-1.5">Gazette number</label>
                <input id="doc-gazette" type="text" value={gazetteNumber} onChange={(e) => setGazetteNumber(e.target.value)} placeholder="e.g., 2024/45/01" className={inputClass} />
              </div>
              <div>
                <label htmlFor="doc-year-gazette" className="block text-sm font-medium text-neutral-700 mb-1.5">Year</label>
                <input id="doc-year-gazette" type="number" value={year} onChange={(e) => setYear(e.target.value)} min="1800" max="2100" className={inputClass} />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="doc-description" className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
            <textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line on what this law covers, e.g. crimes and their punishments."
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Where it came from */}
        <div className="bg-white border border-neutral-200 rounded-none p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Where it came from</h3>
            <p className="mt-1 text-xs text-neutral-500">Shown to readers so they can check the text. Use official sources only, never another platform&apos;s copy.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="doc-source" className="block text-sm font-medium text-neutral-700 mb-1.5">Source</label>
              <select id="doc-source" value={sourceChoice} onChange={(e) => setSourceChoice(e.target.value)} className={inputClass}>
                <option value="">Choose a source</option>
                {KNOWN_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value={OTHER_SOURCE}>Other</option>
              </select>
            </div>
            {sourceChoice === OTHER_SOURCE && (
              <div>
                <label htmlFor="doc-source-other" className="block text-sm font-medium text-neutral-700 mb-1.5">Source name</label>
                <input id="doc-source-other" type="text" value={sourceOther} onChange={(e) => setSourceOther(e.target.value)} className={inputClass} />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="doc-source-url" className="block text-sm font-medium text-neutral-700 mb-1.5">Web address of the official copy</label>
            <input
              id="doc-source-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="e.g., http://www.commonlii.org/lk/legis/consol_act/pc25130"
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={uploading || !file || !title || !category}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#a68d67] transition-all duration-200 rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>) : (<><Upload className="w-4 h-4" /> Upload & Ingest Document</>)}
        </button>
      </form>
    </div>
  );
}
