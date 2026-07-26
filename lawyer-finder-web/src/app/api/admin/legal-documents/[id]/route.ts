import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:5001';

// GET: Get single document details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const doc = await prisma.legalDocument.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Try to get related documents from RAG backend
    let relatedDocuments: string[] = [];
    let graphEntities: any[] = [];

    if (doc.ragDocumentName) {
      try {
        const ragRes = await fetch(
          `${RAG_API_URL}/api/documents/${encodeURIComponent(doc.ragDocumentName)}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (ragRes.ok) {
          const ragData = await ragRes.json();
          relatedDocuments = ragData.related_documents || [];
          graphEntities = ragData.graph_entities || [];
        }
      } catch {
        // RAG backend unavailable, skip enrichment
      }
    }

    return NextResponse.json({
      document: doc,
      relatedDocuments,
      graphEntities,
    });
  } catch (error) {
    console.error('[LEGAL_DOC_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

// DELETE: Remove document from both Postgres and RAG
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    const doc = await prisma.legalDocument.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Delete from RAG backend
    if (doc.ragDocumentName) {
      try {
        await fetch(
          `${RAG_API_URL}/api/documents/${encodeURIComponent(doc.ragDocumentName)}`,
          { method: 'DELETE', signal: AbortSignal.timeout(10000) }
        );
      } catch {
        console.warn('Failed to delete from RAG backend');
      }
    }

    // Delete from Postgres
    await prisma.legalDocument.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('[LEGAL_DOC_DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

// PATCH: Update document metadata
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const allowedFields = ['title', 'description', 'actNumber', 'year', 'courtName', 'caseNumber', 'gazetteNumber', 'status'];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await prisma.legalDocument.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[LEGAL_DOC_PATCH]', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
