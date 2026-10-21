import { NextResponse } from 'next/server';
import type { LegalSubject, Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { mkdir, writeFile } from 'fs/promises';
import { LEGAL_DOCUMENT_STORAGE, legalDocumentStoragePath, ingestLegalDocument, checkAmends } from '@/lib/legalDocuments';
import { DOCUMENT_TYPES, LEGISLATION_TYPES, TYPE_LABEL, isDocumentType, isSubject, ragCategoryFor } from '@/lib/legalLibrary';
import { LegalDocumentUploadSchema } from '@/schemas/legalDocument.schema';
import { sanitizeString, sanitizeFilename, validatePaginationParams } from '@/lib/security';

const STATUSES = ['PROCESSING', 'ACTIVE', 'FAILED', 'ARCHIVED', 'AWAITING_ORIGINAL'] as const;

// GET: List all legal documents
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const url = new URL(req.url);

    // ?view=laws: every law an Act could amend, for the "Amends which law?" picker.
    if (url.searchParams.get('view') === 'laws') {
      const laws = await prisma.legalDocument.findMany({
        // Not FAILED or ARCHIVED: an archived law is an old copy being replaced
        // (e.g. an unofficial consolidation), never something to link to.
        where: { amendsId: null, category: { in: LEGISLATION_TYPES }, status: { notIn: ['FAILED', 'ARCHIVED'] } },
        select: { id: true, title: true, category: true, status: true, consolidatedToYear: true },
        orderBy: { title: 'asc' },
      });
      return NextResponse.json({ laws });
    }

    const category = url.searchParams.get('category');
    const subject = url.searchParams.get('subject');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search') ? sanitizeString(url.searchParams.get('search') || '', 100) : undefined;

    // Clamp pagination parameters
    const { page, limit } = validatePaginationParams(
      url.searchParams.get('page'),
      url.searchParams.get('limit')
    );

    const where: Prisma.LegalDocumentWhereInput = {};
    if (isDocumentType(category)) where.category = category;
    if (isSubject(subject)) where.subjects = { has: subject };
    if (status && (STATUSES as readonly string[]).includes(status)) where.status = status as (typeof STATUSES)[number];

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { actNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [documents, total, categoryCounts, awaitingOriginal] = await Promise.all([
      prisma.legalDocument.findMany({
        where,
        include: {
          amends: { select: { id: true, title: true } },
          _count: { select: { amendments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.legalDocument.count({ where }),
      prisma.legalDocument.groupBy({ by: ['category'], _count: { id: true } }),
      prisma.legalDocument.count({ where: { status: 'AWAITING_ORIGINAL' } }),
    ]);

    return NextResponse.json({
      documents: documents.map((doc) => ({ ...doc, categoryDisplay: TYPE_LABEL[doc.category] })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      categories: DOCUMENT_TYPES.map((t) => ({
        value: t.value,
        label: t.label,
        count: categoryCounts.find((c) => c.category === t.value)?._count.id ?? 0,
      })),
      awaitingOriginal,
    });
  } catch (error) {
    console.error('[LEGAL_DOCS_LIST]', error instanceof Error ? error.message : 'Fetch failed');
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST: Upload and ingest a new document
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    const field = (k: string) => formData.get(k) ?? undefined;
    const parsed = LegalDocumentUploadSchema.safeParse({
      title: field('title'),
      category: field('category'),
      subjects: field('subjects'),
      description: field('description'),
      actNumber: field('actNumber'),
      year: field('year'),
      consolidatedToYear: field('consolidatedToYear'),
      courtName: field('courtName'),
      caseNumber: field('caseNumber'),
      gazetteNumber: field('gazetteNumber'),
      amendsId: field('amendsId'),
      sourceName: field('sourceName'),
      sourceUrl: field('sourceUrl'),
      originalForId: field('originalForId'),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid form input.' }, { status: 400 });
    }
    const { originalForId, ...data } = parsed.data;
    const category = data.category as (typeof DOCUMENT_TYPES)[number]['value'];

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // PDF only, as the upload page says — it accepted Word, text and .log too.
    // Checked by content as well as name: a PDF starts with "%PDF-".
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString('latin1');
    if (fileExt !== 'pdf' || head !== '%PDF-') {
      return NextResponse.json({ error: 'Only PDF files can be uploaded.' }, { status: 400 });
    }

    const problem = await checkAmends(data.amendsId, category, originalForId);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    if (originalForId) {
      const waiting = await prisma.legalDocument.findUnique({ where: { id: originalForId }, select: { status: true } });
      if (waiting?.status !== 'AWAITING_ORIGINAL') {
        return NextResponse.json({ error: 'That law already has its text. Upload this as a new document instead.' }, { status: 409 });
      }
    }

    const sanitizedName = sanitizeFilename(file.name);
    const record = {
      ...data,
      category,
      subjects: data.subjects as LegalSubject[],
      fileName: sanitizedName,
      fileSize: file.size,
      status: 'PROCESSING' as const,
      lastCheckedAt: new Date(),
      uploadedById: session.userId,
    };

    // Filling in a law listed without its original keeps its id, so the
    // amendments already linked to it stay linked.
    const doc = originalForId
      ? await prisma.legalDocument.update({ where: { id: originalForId }, data: record })
      : await prisma.legalDocument.create({ data: record });

    // The website's own copy, so the library can serve the file wherever the
    // AI service runs (src/lib/legalDocuments.ts).
    await mkdir(LEGAL_DOCUMENT_STORAGE, { recursive: true });
    await writeFile(legalDocumentStoragePath(doc.id, sanitizedName), Buffer.from(await file.arrayBuffer()));

    void ingestLegalDocument(doc.id, file, { ...data, ragCategory: ragCategoryFor(category, !!data.amendsId) });

    return NextResponse.json({ success: true, indexing: true, document: doc }, { status: 202 });
  } catch (error) {
    console.error('[LEGAL_DOC_UPLOAD]', error instanceof Error ? error.message : 'Upload failed');
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
