import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { promises as fs } from 'fs';
import { findLegalDocumentFile } from '@/lib/legalDocuments';

/**
 * GET: the file of a library document — only one that is ACTIVE in the library.
 *
 * It used to serve any document, including a failed upload or an archived one.
 * Where the file is looked for: `findLegalDocumentFile`.
 */
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

    const filePath = findLegalDocumentFile(doc);
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
