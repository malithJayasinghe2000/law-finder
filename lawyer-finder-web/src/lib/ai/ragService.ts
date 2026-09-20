/**
 * The address of the RAG service, and the credential for talking to it.
 *
 * One module, because a shared secret copied into four route files is four
 * places to forget it — and forgetting it here does not fail loudly, it just
 * gets a 401 that the callers below swallow into "RAG backend unavailable".
 *
 * ## Why there is a credential at all
 *
 * Until Stage 0 the Flask service had no authentication on any endpoint. Anyone
 * who could reach the port could run inference on our hardware, delete an Act
 * from the corpus, or — the one that matters — ingest a PDF and thereby author
 * Sri Lankan legislation that does not exist.
 *
 * That last one defeats `policy.ts` rather than merely bypassing it. Our
 * UNSUPPORTED_CITATION check verifies that a citation matches what retrieval
 * returned. A fabricated Act that is genuinely in the vector store matches
 * perfectly, so the assistant would cite invented law with a section number and
 * a relevance score, and every server-side check we have would pass it.
 *
 * The service is also bound to 127.0.0.1 now. The token is the second layer:
 * the network boundary is the first, and neither is trusted alone.
 */

/**
 * Base URL of the RAG service.
 *
 * Note the port. `src/app/api/legal-documents/[id]/route.ts` defaulted to 5000
 * while every other caller defaulted to 5001, so on a default setup that route's
 * corpus enrichment silently never worked — on macOS port 5000 is AirPlay
 * Receiver, which answers. Defaulting in one place is how that stops happening.
 */
export const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:5001';

const RAG_SERVICE_TOKEN = process.env.RAG_SERVICE_TOKEN || '';

let warnedAboutMissingToken = false;

/**
 * Headers for a call to the RAG service.
 *
 * @param extra headers to merge in, e.g. Content-Type. Do not pass a
 *              Content-Type for a FormData body — fetch sets the multipart
 *              boundary itself, and overriding it produces an unparseable
 *              request.
 */
export function ragServiceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  if (!RAG_SERVICE_TOKEN && !warnedAboutMissingToken) {
    warnedAboutMissingToken = true;
    console.error(
      '[rag] RAG_SERVICE_TOKEN is not set. Every call to the RAG service will ' +
        'be rejected with 401. Set it in lawyer-finder-web/.env to the same ' +
        'value as RAG_SERVICE_TOKEN in lawyer-rag/.env.'
    );
  }

  return { ...extra, 'X-Service-Token': RAG_SERVICE_TOKEN };
}

/**
 * `fetch` against the RAG service, with the service token attached.
 *
 * @param path a path beginning with `/`, e.g. `/api/chat`.
 */
export function ragFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = ragServiceHeaders(
    (init.headers as Record<string, string> | undefined) ?? {}
  );
  return fetch(`${RAG_API_URL}${path}`, { ...init, headers });
}
