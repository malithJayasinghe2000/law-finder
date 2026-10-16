import { existsSync } from 'fs';
import path from 'path';

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
