import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { findLegalDocumentFile, ingestLegalDocument } from '@/lib/legalDocuments';
import { ragCategoryFor } from '@/lib/legalLibrary';

/**
 * POST: send a FAILED document's stored file to the AI again, e.g. a scanned
 * Act that failed before OCR was installed. Uses the website's own copy, so
 * nothing is downloaded or uploaded again.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const { id } = await params;

  const doc = await prisma.legalDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.status !== 'FAILED') return NextResponse.json({ error: 'Only a document that failed can be retried.' }, { status: 409 });

  const path = findLegalDocumentFile(doc);
  if (!path) return NextResponse.json({ error: 'The file is not on the server any more. Upload it again.' }, { status: 404 });

  // Claim it, so a double click does not index it twice.
  const claimed = await prisma.legalDocument.updateMany({
    where: { id, status: 'FAILED' },
    data: { status: 'PROCESSING', errorMessage: null },
  });
  if (claimed.count === 0) return NextResponse.json({ error: 'It is already being retried.' }, { status: 409 });

  const file = new File([new Uint8Array(await readFile(path))], doc.fileName, { type: 'application/pdf' });
  void ingestLegalDocument(doc.id, file, {
    title: doc.title,
    ragCategory: ragCategoryFor(doc.category, !!doc.amendsId),
    description: doc.description,
    actNumber: doc.actNumber,
    year: doc.year,
    courtName: doc.courtName,
    caseNumber: doc.caseNumber,
    gazetteNumber: doc.gazetteNumber,
    // The same wrong-file check as an approval: a full "No. 22 of 1995" only.
    expectText: doc.actNumber && /^No\. \d+ of \d{4}$/.test(doc.actNumber) ? doc.actNumber : null,
  });

  return NextResponse.json({ success: true }, { status: 202 });
}
