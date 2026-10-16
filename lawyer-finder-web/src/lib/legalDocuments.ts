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
