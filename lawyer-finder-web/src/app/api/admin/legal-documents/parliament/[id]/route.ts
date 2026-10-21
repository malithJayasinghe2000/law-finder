import { NextResponse } from 'next/server';
import type { LegalSubject } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { LEGAL_DOCUMENT_STORAGE, legalDocumentStoragePath, ingestLegalDocument, checkAmends } from '@/lib/legalDocuments';
import { PARLIAMENT_SOURCE, ragCategoryFor } from '@/lib/legalLibrary';
import { libraryTitle } from '@/lib/parliamentActs';
import { ParliamentApproveSchema } from '@/schemas/legalDocument.schema';

const MAX_PDF_BYTES = 40 * 1024 * 1024;

async function requireAdmin() {
  const session = await getSession();
  return session?.role === 'ADMIN' ? session : null;
}

/**
 * POST: approve. Downloads the official PDF from Parliament, adds it to the
 * library linked to the law it amends, and sends it to the AI. One Act at a
 * time on purpose: indexing runs the embedding model on this machine.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const { id } = await params;

  const parsed = ParliamentApproveSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid details.' }, { status: 400 });
  const { amendsId, newLaw, subjects } = parsed.data;

  const act = await prisma.parliamentAct.findUnique({ where: { id } });
  if (!act) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isConstitution = /constitution/i.test(act.title);
  const category = isConstitution ? 'CONSTITUTION' : 'ACT';
  const problem = await checkAmends(amendsId, category);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // Claim it first, so two admins cannot import the same Act twice.
  const claimed = await prisma.parliamentAct.updateMany({
    where: { id, status: 'NEW' },
    data: { status: 'IMPORTED', decidedAt: new Date(), decidedById: session.userId },
  });
  if (claimed.count === 0) return NextResponse.json({ error: 'Someone has already dealt with this Act.' }, { status: 409 });

  let pdf: Buffer;
  try {
    const res = await fetch(act.pdfUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Parliament's website answered ${res.status}.`);
    pdf = Buffer.from(await res.arrayBuffer());
    if (pdf.length > MAX_PDF_BYTES) throw new Error('The PDF is larger than 40 MB.');
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Parliament did not send a PDF.');
  } catch (error) {
    await prisma.parliamentAct.update({ where: { id }, data: { status: 'NEW', decidedAt: null, decidedById: null } });
    const reason = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({ error: `Could not download the Act from Parliament: ${reason} Nothing was added.` }, { status: 502 });
  }

  // A law Parliament amends but the library lacks (often one older than
  // Parliament, like the Penal Code) is listed without its original text.
  const parentId = newLaw
    ? (
        await prisma.legalDocument.create({
          data: {
            title: newLaw.title,
            category: newLaw.category,
            subjects: subjects as LegalSubject[],
            fileName: '',
            fileSize: 0,
            status: 'AWAITING_ORIGINAL',
            uploadedById: session.userId,
          },
        })
      ).id
    : amendsId ?? null;

  const fileName = `${act.ref}.pdf`;
  const [no, year = act.year] = (act.actNumber ?? '').split('/');
  const doc = await prisma.legalDocument.create({
    data: {
      title: libraryTitle(act),
      category,
      subjects: subjects as LegalSubject[],
      actNumber: act.actNumber ? (year ? `No. ${no} of ${year}` : `No. ${no}`) : null,
      year: act.year,
      amendsId: parentId,
      sourceName: PARLIAMENT_SOURCE,
      sourceUrl: act.pdfUrl,
      lastCheckedAt: new Date(),
      fileName,
      fileSize: pdf.length,
      status: 'PROCESSING',
      uploadedById: session.userId,
    },
  });
  await prisma.parliamentAct.update({ where: { id }, data: { legalDocumentId: doc.id } });

  await mkdir(LEGAL_DOCUMENT_STORAGE, { recursive: true });
  await writeFile(legalDocumentStoragePath(doc.id, fileName), pdf);

  void ingestLegalDocument(doc.id, new File([new Uint8Array(pdf)], fileName, { type: 'application/pdf' }), {
    title: doc.title,
    ragCategory: ragCategoryFor(category, !!parentId),
    actNumber: doc.actNumber,
    year: doc.year,
    // Only a full number ("No. 23 of 2026") is distinctive enough to check.
    expectText: act.actNumber?.includes('/') ? doc.actNumber : null,
  });

  return NextResponse.json({ success: true, document: doc }, { status: 202 });
}

/** PATCH: dismiss an Act (not wanted in the library), or put it back in the queue. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.status !== 'DISMISSED' && body?.status !== 'NEW') {
    return NextResponse.json({ error: 'Status must be DISMISSED or NEW.' }, { status: 400 });
  }
  // An imported Act is managed from the library list, not here.
  const changed = await prisma.parliamentAct.updateMany({
    where: { id, status: body.status === 'NEW' ? 'DISMISSED' : 'NEW' },
    data: body.status === 'NEW'
      ? { status: 'NEW', decidedAt: null, decidedById: null }
      : { status: 'DISMISSED', decidedAt: new Date(), decidedById: session.userId },
  });
  if (changed.count === 0) return NextResponse.json({ error: 'That Act is not in a state that can change.' }, { status: 409 });
  return NextResponse.json({ success: true });
}
