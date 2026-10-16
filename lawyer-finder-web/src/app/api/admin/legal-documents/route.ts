import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { ragFetch } from '@/lib/ai/ragService';
import { mkdir, writeFile } from 'fs/promises';
import { LEGAL_DOCUMENT_STORAGE, legalDocumentStoragePath } from '@/lib/legalDocuments';

// Category mapping for display ↔ enum
const CATEGORY_MAP: Record<string, string> = {
  'SRI_LANKA_LAW_REPORTS': 'Sri Lanka Law Reports',
  'ACTS_AND_ORDINANCES': 'Acts & Ordinances',
  'AMENDMENT_ACTS': 'Amendment Acts',
  'GAZETTE_NOTIFICATIONS': 'Gazette Notifications',
  'SUPREME_COURT_DECISIONS': 'Supreme Court Decisions',
  'COURT_OF_APPEAL_DECISIONS': 'Court of Appeal Decisions',
};

const DISPLAY_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAP).map(([k, v]) => [v, k])
);

import { z } from 'zod';
import { sanitizeString, sanitizeFilename, validatePaginationParams } from '@/lib/security';



const preprocessOptionalString = (val: unknown) => {
  if (val === null || val === undefined || val === '') return undefined;
  return typeof val === 'string' ? sanitizeString(val) : val;
};

const LegalDocIngestSchema = z.object({
  title: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(3, 'Title must be at least 3 characters.').max(200, 'Title cannot exceed 200 characters.')
  ),
  category: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(1, 'Category is required.')
  ),
  description: z.preprocess(
    preprocessOptionalString,
    z.string().max(1000, 'Description cannot exceed 1000 characters.').optional().default('')
  ),
  actNumber: z.preprocess(
    preprocessOptionalString,
    z.string().max(50, 'Act number cannot exceed 50 characters.').optional().default('')
  ),
  year: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : Number(val),
    z.number().int().min(1800, 'Year must be after 1800').max(2100, 'Year must be before 2100').optional()
  ),
  courtName: z.preprocess(
    preprocessOptionalString,
    z.string().max(100, 'Court name cannot exceed 100 characters.').optional().default('')
  ),
  caseNumber: z.preprocess(
    preprocessOptionalString,
    z.string().max(50, 'Case number cannot exceed 50 characters.').optional().default('')
  ),
  gazetteNumber: z.preprocess(
    preprocessOptionalString,
    z.string().max(50, 'Gazette number cannot exceed 50 characters.').optional().default('')
  ),
});

// GET: List all legal documents
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const category = url.searchParams.get('category') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') ? sanitizeString(url.searchParams.get('search') || '', 100) : undefined;
    
    // Clamp pagination parameters
    const { page, limit } = validatePaginationParams(
      url.searchParams.get('page'),
      url.searchParams.get('limit')
    );

    const where: any = {};
    if (category) {
      where.category = CATEGORY_MAP[category] ? category : undefined;
    }
    
    const validStatuses = ['PROCESSING', 'ACTIVE', 'FAILED'];
    if (status && validStatuses.includes(status)) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { actNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.legalDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.legalDocument.count({ where }),
    ]);

    // Add display category names
    const enrichedDocs = documents.map((doc: any) => ({
      ...doc,
      categoryDisplay: CATEGORY_MAP[doc.category] || doc.category,
    }));

    // Get category counts
    const categoryCounts = await prisma.legalDocument.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    const categories = Object.entries(CATEGORY_MAP).map(([enumVal, display]) => ({
      value: enumVal,
      label: display,
      count: categoryCounts.find((c: any) => c.category === enumVal)?._count?.id || 0,
    }));

    return NextResponse.json({
      documents: enrichedDocs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      categories,
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
    
    // Parse form entries into raw object
    const rawData = {
      title: formData.get('title'),
      category: formData.get('category'),
      description: formData.get('description'),
      actNumber: formData.get('actNumber'),
      year: formData.get('year'),
      courtName: formData.get('courtName'),
      caseNumber: formData.get('caseNumber'),
      gazetteNumber: formData.get('gazetteNumber'),
    };

    const parsed = LegalDocIngestSchema.safeParse(rawData);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid form input.' }, { status: 400 });
    }

    const {
      title, category, description, actNumber, year,
      courtName, caseNumber, gazetteNumber
    } = parsed.data;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    
    // PDF only, as the upload page says — it accepted Word, text and .log too.
    // Checked by content as well as name: a PDF starts with "%PDF-".
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString('latin1');
    if (fileExt !== 'pdf' || head !== '%PDF-') {
      return NextResponse.json({ error: 'Only PDF files can be uploaded.' }, { status: 400 });
    }

    const sanitizedName = sanitizeFilename(file.name);
    const categoryEnum = DISPLAY_TO_ENUM[category] || category;

    // Create document record in Postgres first (status: PROCESSING)
    const doc = await prisma.legalDocument.create({
      data: {
        title,
        category: categoryEnum as any,
        description,
        actNumber: actNumber || null,
        year: year || null,
        courtName: courtName || null,
        caseNumber: caseNumber || null,
        gazetteNumber: gazetteNumber || null,
        fileName: sanitizedName,
        fileSize: file.size,
        status: 'PROCESSING',
        uploadedById: session.userId,
      },
    });

    // The website's own copy, so the library can serve the file wherever the
    // AI service runs (src/lib/legalDocuments.ts).
    await mkdir(LEGAL_DOCUMENT_STORAGE, { recursive: true });
    await writeFile(legalDocumentStoragePath(doc.id, sanitizedName), Buffer.from(await file.arrayBuffer()));

    // Indexing runs after the response. It used to run inside the request, and
    // a long Act could outlast a server's time limit (often 60-100 s): the
    // admin saw an error while indexing carried on. server.js is long-lived, so
    // the work completes; the admin page shows PROCESSING until it does.
    void ingestLegalDocument(doc.id, file, {
      title, category, description, actNumber, year, courtName, caseNumber, gazetteNumber,
    });

    return NextResponse.json({ success: true, indexing: true, document: doc }, { status: 202 });
  } catch (error) {
    console.error('[LEGAL_DOC_UPLOAD]', error instanceof Error ? error.message : 'Upload failed');
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}

/**
 * Sends a stored upload to the AI service and records the outcome on the
 * document. Never throws: every failure ends as FAILED with a reason.
 */
async function ingestLegalDocument(
  docId: string,
  file: File,
  meta: {
    title: string; category: string; description: string; actNumber?: string; year?: number;
    courtName?: string; caseNumber?: string; gazetteNumber?: string;
  }
): Promise<void> {
  try {
    const ragFormData = new FormData();
    ragFormData.append('file', file);
    ragFormData.append('title', meta.title);
    ragFormData.append('category', meta.category);
    ragFormData.append('description', meta.description);
    if (meta.actNumber) ragFormData.append('act_number', meta.actNumber);
    if (meta.year) ragFormData.append('year', String(meta.year));
    if (meta.courtName) ragFormData.append('court_name', meta.courtName);
    if (meta.caseNumber) ragFormData.append('case_number', meta.caseNumber);
    if (meta.gazetteNumber) ragFormData.append('gazette_number', meta.gazetteNumber);

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
