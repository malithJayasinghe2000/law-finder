'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload, FileText, ArrowLeft, CheckCircle2, XCircle,
  Loader2, CloudUpload
} from 'lucide-react';

const CATEGORIES = [
  { value: 'Sri Lanka Law Reports', label: 'Sri Lanka Law Reports', hint: 'Court case reports and decisions' },
  { value: 'Acts & Ordinances', label: 'Acts & Ordinances', hint: 'Consolidated acts and ordinances' },
  { value: 'Amendment Acts', label: 'Amendment Acts', hint: 'Acts that amend existing legislation' },
  { value: 'Gazette Notifications', label: 'Gazette Notifications', hint: 'Official government gazette entries' },
  { value: 'Supreme Court Decisions', label: 'Supreme Court Decisions', hint: 'Supreme Court judgments and rulings' },
  { value: 'Court of Appeal Decisions', label: 'Court of Appeal Decisions', hint: 'Court of Appeal judgments' },
];

export default function UploadLegalDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [actNumber, setActNumber] = useState('');
  const [year, setYear] = useState('');
  const [courtName, setCourtName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [gazetteNumber, setGazetteNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);

  const isCaseLaw = ['Sri Lanka Law Reports', 'Supreme Court Decisions', 'Court of Appeal Decisions'].includes(category);
  const isGazette = category === 'Gazette Notifications';
  const isAct = ['Acts & Ordinances', 'Amendment Acts'].includes(category);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.replace('.pdf', '').replace(/_/g, ' '));
      }
    } else {
      toast.error('Only PDF files are accepted');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace('.pdf', '').replace(/_/g, ' '));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !title || !category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('category', category);
      if (description) formData.append('description', description);
      if (actNumber) formData.append('actNumber', actNumber);
      if (year) formData.append('year', year);
      if (courtName) formData.append('courtName', courtName);
      if (caseNumber) formData.append('caseNumber', caseNumber);
      if (gazetteNumber) formData.append('gazetteNumber', gazetteNumber);

      const res = await fetch('/api/admin/legal-documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUploadResult({ success: true, document: data.document });
        toast.success('Uploaded. The AI is reading it now.');
      } else {
        setUploadResult({ success: false, error: data.error });
        toast.error(data.error || 'Upload failed');
      }
    } catch (err) {
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/${locale}/dashboard/admin/legal-documents`)}
          className="p-2.5 border border-neutral-200 rounded-none hover:bg-neutral-50 transition"
        >
          <ArrowLeft className="w-4 h-4 text-neutral-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 font-serif tracking-tight">Upload Legal Document</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Upload a PDF to embed into the RAG knowledge base</p>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`rounded-none border border-neutral-200 p-5 ${uploadResult.success ? 'bg-emerald-50 border-emerald-250' : 'bg-red-50 border-red-250'}`}>
          <div className="flex items-start gap-3">
            {uploadResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div>
              <h3 className={`font-semibold text-sm ${uploadResult.success ? 'text-emerald-850' : 'text-red-850'}`}>
                {uploadResult.success ? 'Uploaded - the AI is reading it' : 'Upload Failed'}
              </h3>
              {uploadResult.success ? (
                <div className="mt-2 text-sm text-emerald-700 space-y-1">
                  <p>Title: <strong>{uploadResult.document?.title}</strong></p>
                  <p>Indexing can take several minutes for a long Act. The document list shows &ldquo;Processing&rdquo;
                    until it is done, then &ldquo;Active&rdquo; (or &ldquo;Failed&rdquo;, with the reason).</p>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/admin/legal-documents`)}
                    className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest transition rounded-none border-none cursor-pointer"
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

      {/* Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-none p-10 text-center cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-[#bfa37a] bg-[#bfa37a]/5'
              : file
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-neutral-300 bg-neutral-50 hover:border-[#bfa37a] hover:bg-[#bfa37a]/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-10 h-10 text-emerald-500" />
              <div className="text-left">
                <p className="text-sm font-semibold text-neutral-900">{file.name}</p>
                <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
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

        {/* Document Info */}
        <div className="bg-white border border-neutral-200 rounded-none p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Document Information</h3>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Document Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Civil Procedure Code Act No. 12 of 1895"
              className="w-full px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a]"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`text-left px-4 py-3 border transition-all duration-200 rounded-none ${
                    category === cat.value
                      ? 'border-[#bfa37a] bg-[#bfa37a]/10 shadow-sm'
                      : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <p className={`text-sm font-semibold ${category === cat.value ? 'text-[#bfa37a]' : 'text-neutral-800'}`}>
                    {cat.label}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{cat.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the document contents..."
              rows={3}
              className="w-full px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a] resize-none"
            />
          </div>

          {/* Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Consolidated to (year)</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g., 2024"
                min="1800"
                max="2100"
                className="w-full px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a]"
              />
            </div>
            {isAct && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Act Number</label>
                <input
                  type="text"
                  value={actNumber}
                  onChange={(e) => setActNumber(e.target.value)}
                  placeholder="e.g., Act No. 12"
                  className="w-full px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a]"
                />
              </div>
            )}
          </div>

          {/* Conditional fields for Case Law */}
          {isCaseLaw && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Court Name</label>
                <input
                  type="text"
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                  placeholder="e.g., Supreme Court"
                  className="w-full px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Case Number</label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="e.g., SC Appeal 123/2024"
                  className="w-full px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a]"
                />
              </div>
            </div>
          )}

          {/* Conditional fields for Gazette */}
          {isGazette && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Gazette Number</label>
              <input
                type="text"
                value={gazetteNumber}
                onChange={(e) => setGazetteNumber(e.target.value)}
                placeholder="e.g., 2024/45/01"
                className="w-full px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a]"
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={uploading || !file || !title || !category}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#a68d67] transition-all duration-200 rounded-none border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading & Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload & Ingest Document
            </>
          )}
        </button>

        {uploading && (
          <div className="bg-amber-50 border border-amber-200 rounded-none p-4">
            <p className="text-sm text-amber-800 font-medium">
              Processing document... This may take a moment while we:
            </p>
            <ul className="mt-2 text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>Extract text from the PDF</li>
              <li>Create intelligent legal chunks</li>
              <li>Generate vector embeddings</li>
              <li>Build knowledge graph entities</li>
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
