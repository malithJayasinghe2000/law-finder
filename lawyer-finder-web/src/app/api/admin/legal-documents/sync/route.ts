import { NextResponse } from 'next/server';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { ragFetch } from '@/lib/ai/ragService';

/**
 * The library against what the AI actually holds.
 *
 * Locally the AI held 14 Acts (3,401 sections) while the library and this
 * admin page listed none: the AI quoted Acts the library did not show, and an
 * admin could not see or manage what the AI used (2026-10-16). GET compares;
 * POST adds every AI document the library lacks, as ACTIVE (they are already
 * indexed — the AI is quoting them now).
 */

type AiDocument = {
  document_name: string;
  document_type?: string;
  source_file?: string;
  chunk_count?: number;
  graph_entity_count?: number;
  last_updated_year?: number;
};

const CATEGORY_FOR_TYPE: Record<string, 'AMENDMENT_ACTS' | 'ACTS_AND_ORDINANCES'> = {
  'Amendment Act': 'AMENDMENT_ACTS',
  'Consolidated Act': 'ACTS_AND_ORDINANCES',
};

const RAG_DATA = path.join(process.cwd(), '..', 'lawyer-rag', 'data');

async function compare() {
  const res = await ragFetch('/api/documents', { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`AI service answered ${res.status}`);
  const data = (await res.json()) as { documents?: AiDocument[] };
  const ai = (data.documents ?? []).filter((d) => d.document_name);

  const inLibrary = await prisma.legalDocument.findMany({
    where: { ragDocumentName: { in: ai.map((d) => d.document_name) } },
    select: { ragDocumentName: true },
  });
  const known = new Set(inLibrary.map((d) => d.ragDocumentName));
  return { ai, missing: ai.filter((d) => !known.has(d.document_name)) };
}

async function requireAdmin() {
  const session = await getSession();
  return session?.role === 'ADMIN' ? session : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  try {
    const { ai, missing } = await compare();
    return NextResponse.json({ aiCount: ai.length, missing: missing.map((d) => d.document_name) });
  } catch (error) {
    // An outage is not a fact about the library: say we could not tell.
    console.error('[LEGAL_DOC_SYNC_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not reach the AI service, so the library cannot be compared with it.' }, { status: 503 });
  }
}

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  try {
    const { missing } = await compare();
    for (const d of missing) {
      const fileName = d.source_file || `${d.document_name}.pdf`;
      const onDisk = ['acts', 'uploads'].map((dir) => path.join(RAG_DATA, dir, fileName)).find((p) => existsSync(p));
      await prisma.legalDocument.create({
        data: {
          title: d.document_name,
          category: CATEGORY_FOR_TYPE[d.document_type ?? ''] ?? 'ACTS_AND_ORDINANCES',
          year: d.last_updated_year ?? null,
          fileName,
          fileSize: onDisk ? statSync(onDisk).size : 0,
          ragDocumentName: d.document_name,
          chunksCount: d.chunk_count ?? 0,
          graphEntities: d.graph_entity_count ?? 0,
          status: 'ACTIVE',
          uploadedById: session.userId,
        },
      });
    }
    return NextResponse.json({ added: missing.length });
  } catch (error) {
    console.error('[LEGAL_DOC_SYNC_POST]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not reach the AI service. Nothing was added.' }, { status: 503 });
  }
}
