import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { legalDocumentStoragePath } from '@/lib/legalDocuments';

/**
 * GET: the file of a library document — only one that is ACTIVE in the library.
 *
 * It used to serve any document, including a failed upload or an archived one.
 * The file is read from the website's own copy (kept at upload), or, for
 * documents that came from the AI service, from its folders when they are on
 * the same disk. Every candidate is resolved and must stay inside its folder.
 * Never public/uploads: nothing stores library files there, and it holds the
 * files people upload about themselves.
 */
const RAG_DATA = path.join(process.cwd(), '..', 'lawyer-rag', 'data');

function inside(base: string, name: string): string | null {
  const resolved = path.resolve(base, name);
  return resolved.startsWith(path.resolve(base) + path.sep) ? resolved : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await prisma.legalDocument.findUnique({
      where: { id },
      select: { id: true, status: true, fileName: true, ragDocumentName: true },
    });

    if (!doc || doc.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const candidates = [
      legalDocumentStoragePath(doc.id, doc.fileName),
      inside(path.join(RAG_DATA, 'uploads'), doc.fileName),
      inside(path.join(RAG_DATA, 'acts'), doc.fileName),
      doc.ragDocumentName ? inside(path.join(RAG_DATA, 'uploads'), `${doc.ragDocumentName}.pdf`) : null,
    ].filter((p): p is string => !!p);

    const filePath = candidates.find((p) => existsSync(p));
    if (!filePath) {
      return NextResponse.json({ error: 'The file for this document is not available.' }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);

    const ext = doc.fileName.split('.').pop()?.toLowerCase();
    let contentType = 'application/pdf';
    if (ext === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === 'txt') {
      contentType = 'text/plain';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Content-Disposition', `inline; filename="${doc.fileName.replace(/"/g, '')}"`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(fileBuffer, { status: 200, headers });
  } catch (error) {
    console.error('[LEGAL_DOC_FILE_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch document file' }, { status: 500 });
  }
}
