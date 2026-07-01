import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:5000';

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
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(1000, 'Description cannot exceed 1000 characters.').optional().default('')
  ),
  actNumber: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(50, 'Act number cannot exceed 50 characters.').optional().default('')
  ),
  year: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : Number(val),
    z.number().int().min(1800, 'Year must be after 1800').max(2100, 'Year must be before 2100').optional()
  ),
  courtName: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(100, 'Court name cannot exceed 100 characters.').optional().default('')
  ),
  caseNumber: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(50, 'Case number cannot exceed 50 characters.').optional().default('')
  ),
  gazetteNumber: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
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
    
    // Validate file extension/type (Only PDF/DOCX/TXT/log documents are allowed)
    const allowedExtensions = ['pdf', 'docx', 'txt', 'log'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return NextResponse.json({ error: 'Unsupported file type. Only PDF, DOCX, and TXT files are allowed.' }, { status: 400 });
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

    // Forward the file to the RAG backend for ingestion
    try {
      const ragFormData = new FormData();
      ragFormData.append('file', file);
      ragFormData.append('title', title);
      ragFormData.append('category', category);
      ragFormData.append('description', description);
      if (actNumber) ragFormData.append('act_number', actNumber);
      if (year) ragFormData.append('year', String(year));
      if (courtName) ragFormData.append('court_name', courtName);
      if (caseNumber) ragFormData.append('case_number', caseNumber);
      if (gazetteNumber) ragFormData.append('gazette_number', gazetteNumber);

      const ragRes = await fetch(`${RAG_API_URL}/api/ingest/upload`, {
        method: 'POST',
        body: ragFormData,
      });

      const ragData = await ragRes.json();

      if (ragRes.ok && ragData.success) {
        // Update document with ingestion results
        await prisma.legalDocument.update({
          where: { id: doc.id },
          data: {
            status: 'ACTIVE',
            ragDocumentName: ragData.document_name || title,
            chunksCount: ragData.chunks_added || 0,
            graphEntities: ragData.graph_stats?.entity_count || 0,
            pageCount: ragData.pdf_info?.page_count || null,
          },
        });
      } else {
        await prisma.legalDocument.update({
          where: { id: doc.id },
          data: {
            status: 'FAILED',
            errorMessage: ragData.error || 'Ingestion failed',
          },
        });

        return NextResponse.json({
          error: `Document uploaded but ingestion failed: ${ragData.error}`,
          documentId: doc.id,
        }, { status: 500 });
      }
    } catch (ragError: any) {
      await prisma.legalDocument.update({
        where: { id: doc.id },
        data: {
          status: 'FAILED',
          errorMessage: `RAG API unreachable: ${ragError.message}`,
        },
      });

      return NextResponse.json({
        error: 'RAG backend is unreachable. Document saved but not ingested.',
        documentId: doc.id,
      }, { status: 503 });
    }

    const updatedDoc = await prisma.legalDocument.findUnique({ where: { id: doc.id } });

    return NextResponse.json({
      success: true,
      document: updatedDoc,
    }, { status: 201 });
  } catch (error) {
    console.error('[LEGAL_DOC_UPLOAD]', error instanceof Error ? error.message : 'Upload failed');
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
