import prisma from '@/lib/db';
import { normaliseLibraryKey, type AiSource, type ModelContext } from './policy';
import { ragFetch } from './ragService';

/**
 * The only place that talks to the RAG service.
 *
 * The service used to be called from the browser: `NEXT_PUBLIC_RAG_API_URL` was
 * baked into the page and every question a user typed went straight from their
 * machine to a Flask app, with our application never seeing it. That made three
 * things impossible at once — enforcing the AI policy, knowing what was asked,
 * and keeping the service off the public internet.
 *
 * Everything now goes through here, server side. `RAG_API_URL` is a server
 * variable with no `NEXT_PUBLIC_` prefix, so it is not shipped to the client and
 * the service can sit on a private network.
 *
 * Since Stage 0 the service also requires a shared secret on every request. The
 * address and the credential live in `ragService.ts`; see the note there for why
 * an open ingestion endpoint defeated this file's own guardrails.
 *
 * Treat the response as untrusted. The RAG service runs its own prompts against
 * a local model and has its own guardrails, but a guardrail we cannot run in CI
 * is a guardrail we do not have. Everything it returns is checked again in
 * `policy.ts` before a user sees it.
 */

const RAG_TIMEOUT_MS = Number(process.env.RAG_TIMEOUT_MS || 60_000);

/** What the RAG service reports back. Field names are its, not ours. */
type RagResponse = {
  answer?: string;
  sources?: Array<{
    document_name?: string;
    document_type?: string;
    section?: string;
    part?: string;
    chapter?: string;
    status?: string;
    last_updated_year?: string | number;
    relevance_score?: number;
    source_file?: string;
  }>;
  /**
   * How the service classified the question. Advisory only — it decides whether
   * we *expect* a citation, never whether we require one, because it is a value
   * chosen by a language model and we do not let a language model decide when a
   * legal answer may go uncited.
   */
  intent?: string;
  chunks_retrieved?: number;
  /**
   * The service could not resolve what the question referred to, because no
   * conversation was sent with it. A SIGNAL, not an answer: the words shown to
   * the user come from REFUSAL_MESSAGES in policy.ts, like every other refusal,
   * so the service can never put its own prose in front of a reader.
   */
  needs_context?: boolean;
};

export type RagResult = {
  answer: string;
  sources: AiSource[];
  /** True when the question was small talk, so no legislation is expected. */
  isConversational: boolean;
  /** True when the question was a follow-up with no conversation behind it. */
  needsContext: boolean;
};

export class RagUnavailableError extends Error {}

/**
 * Ask the RAG service a question.
 *
 * Note what is *not* in the request: no user id, no matter, no booking, no firm.
 * The service receives the question and this chat's own earlier turns, and
 * nothing else. See the confidentiality note in `policy.ts`.
 */
export async function askRag(context: ModelContext): Promise<RagResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

  let payload: RagResponse;
  try {
    const response = await ragFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: context.question,
        conversation_history: context.history,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new RagUnavailableError(`RAG service returned ${response.status}`);
    }

    payload = (await response.json()) as RagResponse;
  } catch (error) {
    if (error instanceof RagUnavailableError) throw error;
    throw new RagUnavailableError(
      error instanceof Error ? error.message : 'RAG service unreachable'
    );
  } finally {
    clearTimeout(timeout);
  }

  return {
    answer: typeof payload.answer === 'string' ? payload.answer : '',
    sources: (payload.sources ?? []).map(normaliseSource),
    isConversational: payload.intent === 'conversational',
    needsContext: payload.needs_context === true,
  };
}

/**
 * The general question behind a question about someone's own case, or null.
 *
 * Only a rewrite; nothing is retrieved or answered. Never throws: when the
 * service cannot help, the caller falls back to the plain refusal, which needs
 * no service at all. The rewrite is checked by acceptGeneralQuestion
 * (policy.ts) before it is used.
 */
export async function generaliseQuestion(question: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await ragFetch('/api/generalise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { question?: unknown };
    return typeof payload.question === 'string' ? payload.question : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseSource(raw: NonNullable<RagResponse['sources']>[number]): AiSource {
  return {
    documentName: String(raw.document_name ?? ''),
    documentType: String(raw.document_type ?? ''),
    section: String(raw.section ?? ''),
    part: String(raw.part ?? ''),
    chapter: String(raw.chapter ?? ''),
    status: String(raw.status ?? ''),
    lastUpdatedYear: raw.last_updated_year ?? 'N/A',
    relevanceScore: Number(raw.relevance_score ?? 0),
    sourceFile: raw.source_file ? String(raw.source_file) : undefined,
  };
}

/**
 * Build the lookup that turns a citation into something a person can open.
 *
 * Keyed on both the stored file name and the RAG document name, because the two
 * pipelines disagree: a document ingested through the admin upload screen
 * carries its file name, while the Acts loaded by the ingestion script carry a
 * human name like "Companies Act". Normalising both to letters and digits makes
 * `Companies-Act-Consolidated-2024.pdf` and `Companies Act` meet.
 *
 * A citation that finds nothing here is still shown — it names a document that
 * was genuinely ingested — but it is not given a link that goes nowhere.
 */
export async function loadLibraryIndex(): Promise<Map<string, string>> {
  const documents = await prisma.legalDocument.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, title: true, fileName: true, ragDocumentName: true },
  });

  const index = new Map<string, string>();
  for (const doc of documents) {
    for (const key of [doc.fileName, doc.ragDocumentName, doc.title]) {
      const normalised = normaliseLibraryKey(key);
      if (normalised && !index.has(normalised)) index.set(normalised, doc.id);
    }
  }
  return index;
}
