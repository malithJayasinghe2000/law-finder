import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ragFetch } from '@/lib/ai/ragService';

const CATEGORY_MAP: Record<string, string> = {
  'SRI_LANKA_LAW_REPORTS': 'Sri Lanka Law Reports',
  'ACTS_AND_ORDINANCES': 'Acts & Ordinances',
  'AMENDMENT_ACTS': 'Amendment Acts',
  'GAZETTE_NOTIFICATIONS': 'Gazette Notifications',
  'SUPREME_COURT_DECISIONS': 'Supreme Court Decisions',
  'COURT_OF_APPEAL_DECISIONS': 'Court of Appeal Decisions',
};

// GET: Public endpoint to get single document details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await prisma.legalDocument.findUnique({
      where: { id, status: 'ACTIVE' },
    });

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Enrich with related documents from RAG
    let relatedDocuments: string[] = [];
    let graphEntities: any[] = [];

    if (doc.ragDocumentName) {
      try {
        const ragRes = await ragFetch(
          `/api/documents/${encodeURIComponent(doc.ragDocumentName)}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (ragRes.ok) {
          const ragData = await ragRes.json();
          relatedDocuments = ragData.related_documents || [];
          graphEntities = ragData.graph_entities || [];
        }
      } catch {
        // RAG unavailable, skip enrichment
      }
    }

    // Find related documents in Postgres by matching ragDocumentName
    let relatedDocs: any[] = [];
    if (relatedDocuments.length > 0) {
      relatedDocs = await prisma.legalDocument.findMany({
        where: {
          ragDocumentName: { in: relatedDocuments },
          status: 'ACTIVE',
          id: { not: doc.id },
        },
        select: {
          id: true,
          title: true,
          category: true,
          year: true,
          actNumber: true,
        },
        take: 10,
      });
    }

    return NextResponse.json({
      document: {
        ...doc,
        categoryDisplay: CATEGORY_MAP[doc.category] || doc.category,
      },
      relatedDocuments: relatedDocs.map((d: any) => ({
        ...d,
        categoryDisplay: CATEGORY_MAP[d.category] || d.category,
      })),
      graphEntities,
    });
  } catch (error) {
    console.error('[PUBLIC_LEGAL_DOC_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}
