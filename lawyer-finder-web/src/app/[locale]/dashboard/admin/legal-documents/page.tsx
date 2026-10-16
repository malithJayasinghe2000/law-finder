'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BookOpen, Upload, FileText, Search, Trash2, Eye, AlertCircle, Archive, RotateCcw,
  CheckCircle2, Clock, XCircle, Filter, RefreshCw, Database, GitBranch
} from 'lucide-react';

interface LegalDocument {
  id: string;
  title: string;
  category: string;
  categoryDisplay: string;
  description: string | null;
  actNumber: string | null;
  year: number | null;
  courtName: string | null;
  caseNumber: string | null;
  fileName: string;
  fileSize: number;
  pageCount: number | null;
  ragDocumentName: string | null;
  chunksCount: number;
  graphEntities: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface Category {
  value: string;
  label: string;
  count: number;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  ACTIVE: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100 rounded-none' },
  PROCESSING: { icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100 rounded-none' },
  FAILED: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-100 rounded-none' },
  ARCHIVED: { icon: AlertCircle, color: 'text-neutral-500', bg: 'bg-neutral-50 border-neutral-200 rounded-none' },
};

export default function AdminLegalDocumentsPage() {
  const params = useParams();
  const locale = params.locale as string;

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  // The library compared with what the AI holds (api/admin/legal-documents/sync).
  const [sync, setSync] = useState<{ aiCount: number; missing: string[] } | { error: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const fetchSync = () =>
    fetch('/api/admin/legal-documents/sync')
      .then(async (r) => setSync(await r.json()))
      .catch(() => setSync({ error: 'Could not reach the AI service.' }));
  const runSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/legal-documents/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Added ${data.added} document${data.added === 1 ? '' : 's'} from the AI to the library.`);
      fetchDocuments();
      fetchSync();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not sync.');
    } finally {
      setSyncing(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedCategory) params.set('category', selectedCategory);
      params.set('page', page.toString());
      params.set('limit', '15');

      const res = await fetch(`/api/admin/legal-documents?${params}`);
      const data = await res.json();

      setDocuments(data.documents || []);
      setTotal(data.total || 0);
      setCategories(data.categories || []);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [page, selectedCategory]);

  useEffect(() => {
    fetchSync();
  }, []);

  // Indexing runs in the background after an upload; refresh until it ends.
  const anyProcessing = documents.some((d) => d.status === 'PROCESSING');
  useEffect(() => {
    if (!anyProcessing) return;
    const t = setTimeout(fetchDocuments, 5000);
    return () => clearTimeout(t);
  }, [anyProcessing, documents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  // Archive hides a document from the library and leaves the AI alone.
  const setStatus = async (id: string, status: 'ARCHIVED' | 'ACTIVE') => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/legal-documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(status === 'ARCHIVED' ? 'Archived. Hidden from the library; the AI still has it.' : 'Restored to the library.');
      fetchDocuments();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not change that.');
    } finally {
      setDeleting(null);
    }
  };

  // Removing from the AI cannot be undone here; the title must be typed.
  const [removeFor, setRemoveFor] = useState<LegalDocument | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const handleRemoveFromAi = async () => {
    if (!removeFor) return;
    setDeleting(removeFor.id);
    try {
      const res = await fetch(`/api/admin/legal-documents/${removeFor.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || 'Removed from the AI.');
      setRemoveFor(null);
      fetchDocuments();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not remove it.');
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const totalChunks = documents.reduce((sum, d) => sum + d.chunksCount, 0);
  const totalEntities = documents.reduce((sum, d) => sum + d.graphEntities, 0);
  const activeCount = documents.filter(d => d.status === 'ACTIVE').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Legal Documents</h1>
            <p className="text-sm text-neutral-500 font-medium">Manage documents in the RAG knowledge base</p>
          </div>
        </div>
        <Link
          href={`/${locale}/dashboard/admin/legal-documents/upload`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#a68d67] transition-all rounded-none border-none cursor-pointer self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow rounded-none">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-neutral-600" />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">{total}</p>
            <p className="text-[11px] text-neutral-500 font-medium mt-0.5 uppercase tracking-wide">Total Documents</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow rounded-none">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-neutral-600" />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">{activeCount}</p>
            <p className="text-[11px] text-neutral-500 font-medium mt-0.5 uppercase tracking-wide">Active in RAG</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow rounded-none">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center">
                <Database className="h-4 w-4 text-neutral-600" />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">{totalChunks}</p>
            <p className="text-[11px] text-neutral-500 font-medium mt-0.5 uppercase tracking-wide">Vector Chunks</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow rounded-none">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center">
                <GitBranch className="h-4 w-4 text-neutral-600" />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">{totalEntities}</p>
            <p className="text-[11px] text-neutral-500 font-medium mt-0.5 uppercase tracking-wide">Graph Entities</p>
          </div>
        </div>
      </div>

      {/* What the AI holds against what the library lists */}
      {sync && (
        <div className="flex flex-col gap-3 border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-700">
            {'error' in sync
              ? sync.error
              : sync.missing.length === 0
                ? `The library lists every document the AI holds (${sync.aiCount}).`
                : `The AI holds ${sync.aiCount} document${sync.aiCount === 1 ? '' : 's'}; ${sync.missing.length} ${sync.missing.length === 1 ? 'is' : 'are'} not in the library, so people cannot see what the AI quotes.`}
          </p>
          {!('error' in sync) && sync.missing.length > 0 && (
            <button
              onClick={runSync}
              disabled={syncing}
              className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#0a0a0a] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} /> Add them to the library
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-neutral-200 p-5 rounded-none">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 bg-white text-[#0a0a0a] text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#a68d67] transition-all rounded-none border-none cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-[#bfa37a] focus:bg-[#faf8f6]/30 transition-all rounded-none bg-white text-[#0a0a0a] min-w-[200px]"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label} ({cat.count})
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchDocuments}
            className="p-2.5 border border-neutral-200 rounded-none hover:bg-neutral-50 transition"
          >
            <RefreshCw className="w-4 h-4 text-neutral-600" />
          </button>
        </div>
      </div>

      {/* Document Table */}
      <div className="bg-white border border-neutral-200 rounded-none shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-neutral-100 animate-pulse rounded-none" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-neutral-900">No documents found</h3>
            <p className="text-sm text-neutral-500 mt-1">Upload your first legal document to get started.</p>
            <Link
              href={`/${locale}/dashboard/admin/legal-documents/upload`}
              className="inline-flex items-center justify-center gap-2 mt-4 px-6 py-3 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#a68d67] transition rounded-none border-none cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-neutral-500 uppercase tracking-wider">Document</th>
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-neutral-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-neutral-500 uppercase tracking-wider">Year</th>
                  <th className="text-left px-5 py-3.5 text-xs font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3.5 text-xs font-bold text-neutral-500 uppercase tracking-wider">Chunks</th>
                  <th className="text-right px-5 py-3.5 text-xs font-bold text-neutral-500 uppercase tracking-wider">Graph</th>
                  <th className="text-right px-5 py-3.5 text-xs font-bold text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {documents.map((doc) => {
                  const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.ARCHIVED;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={doc.id} className="hover:bg-neutral-50/50 transition">
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{doc.title}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {doc.fileName} · {formatFileSize(doc.fileSize)}
                            {doc.pageCount ? ` · ${doc.pageCount} pages` : ''}
                          </p>
                          {doc.status === 'FAILED' && doc.errorMessage && (
                            <p className="mt-1 text-xs text-red-700">{doc.errorMessage}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-800 rounded-none border border-neutral-200">
                          {doc.categoryDisplay}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-neutral-700">{doc.year || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${statusConfig.bg}`}>
                          <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.color}`} />
                          <span className={statusConfig.color}>{doc.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-neutral-700 font-mono">{doc.chunksCount}</td>
                      <td className="px-5 py-4 text-right text-sm text-neutral-700 font-mono">{doc.graphEntities}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {doc.status === 'ACTIVE' && (
                            <button
                              onClick={() => setStatus(doc.id, 'ARCHIVED')}
                              disabled={deleting === doc.id}
                              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-none transition disabled:opacity-50"
                              title="Archive (hide from the library; the AI keeps it)"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          {doc.status === 'ARCHIVED' && doc.chunksCount > 0 && (
                            <button
                              onClick={() => setStatus(doc.id, 'ACTIVE')}
                              disabled={deleting === doc.id}
                              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-none transition disabled:opacity-50"
                              title="Restore to the library"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {doc.status === 'ARCHIVED' && doc.chunksCount > 0 && (
                            <button
                              onClick={() => { setRemoveFor(doc); setConfirmTitle(''); }}
                              disabled={deleting === doc.id}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-none transition disabled:opacity-50"
                              title="Remove from the AI"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-100">
            <p className="text-sm text-neutral-500">
              Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-neutral-200 rounded-none disabled:opacity-50 hover:bg-neutral-50 transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 15 >= total}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-neutral-200 rounded-none disabled:opacity-50 hover:bg-neutral-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      {removeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRemoveFor(null)}>
          <div className="w-full max-w-md border border-neutral-200 bg-white p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-900">Remove from the AI</h3>
            <p className="text-xs text-neutral-600">
              The AI will stop knowing <span className="font-semibold text-neutral-900">{removeFor.title}</span> and can no longer
              quote it. This cannot be undone from here: the document has to be uploaded and indexed again. The library keeps it
              archived as a record.
            </p>
            <div>
              <label htmlFor="confirm-title" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Type the title to confirm</label>
              <input
                id="confirm-title" value={confirmTitle} onChange={(e) => setConfirmTitle(e.target.value)}
                className="w-full border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRemoveFor(null)} className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900">Cancel</button>
              <button
                onClick={handleRemoveFromAi}
                disabled={confirmTitle.trim() !== removeFor.title.trim() || deleting === removeFor.id}
                className="bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-red-700 disabled:opacity-50"
              >
                Remove from the AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
