import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ragFetch } from '@/lib/ai/ragService';
import { findLegalDocumentFile } from '@/lib/legalDocuments';
import { PUBLIC_STATUSES, TYPE_LABEL } from '@/lib/legalLibrary';

const visible = { status: { in: [...PUBLIC_STATUSES] } };

// GET: Public endpoint to get single document details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // AWAITING_ORIGINAL is shown too: a law listed with its amendments while
    // its original text is being added.
    const doc = await prisma.legalDocument.findFirst({
      where: { id, ...visible },
      include: {
        amends: { select: { id: true, title: true, status: true } },
        amendments: {
          where: visible,
          select: { id: true, title: true, actNumber: true, year: true, sourceUrl: true, status: true },
          orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Enrich with related documents from RAG
    let relatedDocuments: string[] = [];
    let graphEntities: unknown[] = [];

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
    const relatedDocs = relatedDocuments.length === 0 ? [] : await prisma.legalDocument.findMany({
        where: {
          ragDocumentName: { in: relatedDocuments },
          status: 'ACTIVE',
          id: { not: doc.id },
        },
        select: { id: true, title: true, category: true, year: true, actNumber: true },
        take: 10,
      });

    // Internal fields stay internal.
    const shown: Partial<typeof doc> = { ...doc };
    delete shown.uploadedById;
    delete shown.errorMessage;
    delete shown.ragDocumentName;
    return NextResponse.json({
      document: {
        ...shown,
        amends: doc.amends && (PUBLIC_STATUSES as readonly string[]).includes(doc.amends.status) ? doc.amends : null,
        categoryDisplay: TYPE_LABEL[doc.category],
        // The page offers Download / Open only when there is a file to serve.
        fileAvailable: doc.status === 'ACTIVE' && findLegalDocumentFile(doc) !== null,
      },
      relatedDocuments: relatedDocs.map((d) => ({ ...d, categoryDisplay: TYPE_LABEL[d.category] })),
      graphEntities,
    });
  } catch (error) {
    console.error('[PUBLIC_LEGAL_DOC_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}
