import { existsSync } from 'fs';
import path from 'path';
import prisma from '@/lib/db';
import { ragFetch } from '@/lib/ai/ragService';
import { LEGISLATION_TYPES } from '@/lib/legalLibrary';

/**
 * Where the website keeps its own copy of an uploaded library document.
 *
 * Outside `public/`, so it is served only through
 * /api/legal-documents/[id]/file (ACTIVE documents only), and on the website's
 * disk, so it does not depend on the AI service running on the same machine.
 * Named by document id; the extension is the uploaded file's.
 */
export const LEGAL_DOCUMENT_STORAGE = path.join(process.cwd(), 'storage', 'legal-documents');

export function legalDocumentStoragePath(id: string, fileName: string): string {
  const ext = (fileName.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
  return path.join(LEGAL_DOCUMENT_STORAGE, `${id}.${ext || 'pdf'}`);
}

/**
 * The file on disk for a library document, or null when there is none.
 *
 * The website's own copy first; then, for documents that came from the AI
 * service, its folders when they are on the same disk. Every candidate is
 * resolved and must stay inside its folder. Never public/uploads: nothing
 * stores library files there, and it holds the files people upload about
 * themselves.
 */
const RAG_DATA = path.join(process.cwd(), '..', 'lawyer-rag', 'data');

function inside(base: string, name: string): string | null {
  const resolved = path.resolve(base, name);
  return resolved.startsWith(path.resolve(base) + path.sep) ? resolved : null;
}

export function findLegalDocumentFile(doc: {
  id: string;
  fileName: string;
  ragDocumentName: string | null;
}): string | null {
  const candidates = [
    legalDocumentStoragePath(doc.id, doc.fileName),
    inside(path.join(RAG_DATA, 'uploads'), doc.fileName),
    inside(path.join(RAG_DATA, 'acts'), doc.fileName),
    doc.ragDocumentName ? inside(path.join(RAG_DATA, 'uploads'), `${doc.ragDocumentName}.pdf`) : null,
  ].filter((p): p is string => !!p);

  return candidates.find((p) => existsSync(p)) ?? null;
}

/**
 * Sends a stored document to the AI service and records the outcome on it.
 * Never throws: every failure ends as FAILED with a reason. Runs after the
 * response (indexing a long Act can outlast a server's time limit); server.js
 * is long-lived, so it completes, and the admin page shows PROCESSING until then.
 *
 * `ragCategory` is the AI service's vocabulary (see ragCategoryFor): it tells an
 * amending Act from the law it amends.
 */
export async function ingestLegalDocument(
  docId: string,
  file: File,
  meta: {
    title: string; ragCategory: string; description?: string | null; actNumber?: string | null;
    year?: number | null; courtName?: string | null; caseNumber?: string | null; gazetteNumber?: string | null;
    // Text the PDF must contain, e.g. "No. 32 of 1991": the AI service refuses a
    // PDF that does not mention it (Parliament has linked the wrong file).
    expectText?: string | null;
  }
): Promise<void> {
  try {
    const ragFormData = new FormData();
    ragFormData.append('file', file);
    ragFormData.append('title', meta.title);
    ragFormData.append('category', meta.ragCategory);
    ragFormData.append('description', meta.description ?? '');
    if (meta.actNumber) ragFormData.append('act_number', meta.actNumber);
    if (meta.year) ragFormData.append('year', String(meta.year));
    if (meta.courtName) ragFormData.append('court_name', meta.courtName);
    if (meta.caseNumber) ragFormData.append('case_number', meta.caseNumber);
    if (meta.gazetteNumber) ragFormData.append('gazette_number', meta.gazetteNumber);
    if (meta.expectText) ragFormData.append('expect_text', meta.expectText);

    // No Content-Type: fetch sets the multipart boundary for a FormData
    // body, and ragFetch only adds the service token.
    const ragRes = await ragFetch('/api/ingest/upload', { method: 'POST', body: ragFormData });
    const ragData = await ragRes.json().catch(() => ({}));

    if (ragRes.ok && ragData.success) {
      await prisma.legalDocument.update({
        where: { id: docId },
        data: {
          status: 'ACTIVE',
          ragDocumentName: ragData.document_name || meta.title,
          chunksCount: ragData.chunks_added || 0,
          graphEntities: ragData.graph_stats?.entity_count || 0,
          graphRelationships: ragData.graph_stats?.relationship_count || 0,
          pageCount: ragData.pdf_info?.page_count || null,
          outline: ragData.outline || null,
          errorMessage: null,
        },
      });
    } else {
      await prisma.legalDocument.update({
        where: { id: docId },
        data: { status: 'FAILED', errorMessage: ragData.error || `Indexing failed (AI service answered ${ragRes.status}).` },
      });
    }
  } catch (error) {
    await prisma.legalDocument
      .update({
        where: { id: docId },
        data: { status: 'FAILED', errorMessage: `The AI service could not be reached: ${error instanceof Error ? error.message : 'unknown error'}` },
      })
      .catch(() => {});
  }
}

/**
 * Only legislation amends, and only a law itself is amended: an amendment of
 * an amendment would hide it from the law's page. Used by upload and edit.
 */
export async function checkAmends(
  amendsId: string | null | undefined,
  category: string,
  selfId?: string | null
): Promise<string | null> {
  if (!amendsId) return null;
  if (!LEGISLATION_TYPES.includes(category as (typeof LEGISLATION_TYPES)[number])) {
    return 'Only an Act, Ordinance, Regulation, Statute or the Constitution can amend a law.';
  }
  if (amendsId === selfId) return 'A law cannot amend itself.';
  const target = await prisma.legalDocument.findUnique({
    where: { id: amendsId },
    select: { amendsId: true, category: true, status: true },
  });
  if (!target) return 'The law it amends was not found.';
  if (target.status === 'ARCHIVED') return 'That law is archived (an old copy). Choose the current one.';
  if (target.amendsId) return 'Choose the law itself, not another amendment to it.';
  if (!LEGISLATION_TYPES.includes(target.category)) return 'The law it amends must be legislation.';
  return null;
}
