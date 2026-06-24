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

// GET: List all legal documents
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const category = url.searchParams.get('category') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;
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
    console.error('[LEGAL_DOCS_LIST]', error);
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
    const title = formData.get('title') as string;
    const categoryDisplay = formData.get('category') as string;
    const description = (formData.get('description') as string) || '';
    const actNumber = (formData.get('actNumber') as string) || '';
    const year = formData.get('year') as string;
    const courtName = (formData.get('courtName') as string) || '';
    const caseNumber = (formData.get('caseNumber') as string) || '';
    const gazetteNumber = (formData.get('gazetteNumber') as string) || '';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!categoryDisplay) return NextResponse.json({ error: 'Category is required' }, { status: 400 });

    const categoryEnum = DISPLAY_TO_ENUM[categoryDisplay] || categoryDisplay;

    // Create document record in Postgres first (status: PROCESSING)
    const doc = await prisma.legalDocument.create({
      data: {
        title,
        category: categoryEnum as any,
        description,
        actNumber: actNumber || null,
        year: year ? parseInt(year, 10) : null,
        courtName: courtName || null,
        caseNumber: caseNumber || null,
        gazetteNumber: gazetteNumber || null,
        fileName: file.name,
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
      ragFormData.append('category', categoryDisplay);
      ragFormData.append('description', description);
      if (actNumber) ragFormData.append('act_number', actNumber);
      if (year) ragFormData.append('year', year);
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
    console.error('[LEGAL_DOC_UPLOAD]', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
