import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { ragFetch } from '@/lib/ai/ragService';
import { LegalDocumentUpdateSchema } from '@/schemas/legalDocument.schema';

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
        await ragFetch(
          `/api/documents/${encodeURIComponent(doc.ragDocumentName)}`,
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
    const parsed = LegalDocumentUpdateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid details.' }, { status: 400 });
    }

    const doc = await prisma.legalDocument.findUnique({
      where: { id },
      select: { status: true, ragDocumentName: true, chunksCount: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // "Active" means the AI has read it. A failed or unfinished upload shown in
    // the library would be a document the AI cannot cite.
    if (parsed.data.status === 'ACTIVE' && (!doc.ragDocumentName || doc.chunksCount === 0)) {
      return NextResponse.json(
        { error: 'This document was never indexed by the AI, so it cannot be shown in the library. Upload it again.' },
        { status: 409 }
      );
    }

    const updated = await prisma.legalDocument.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[LEGAL_DOC_PATCH]', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
