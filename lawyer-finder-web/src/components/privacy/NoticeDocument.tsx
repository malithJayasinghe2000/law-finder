'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders one version of the privacy notice as a document.
 *
 * Deliberately plain. This is a legal instrument, not a landing page — there is
 * no hero, no illustration and no "we care about your privacy". The only
 * decoration is the banner that appears when you are reading a version that is
 * no longer in force, because that is a fact the reader needs and cannot get
 * from the text itself.
 */
export default function NoticeDocument({
  title,
  version,
  body,
  changeSummary,
  status,
  publishedAt,
  currentVersion,
  currentHref,
}: {
  title: string;
  version: string;
  body: string;
  changeSummary: string | null;
  status: 'PUBLISHED' | 'SUPERSEDED' | 'DRAFT';
  publishedAt: string | null;
  /** The version in force, so a superseded page can point at it. */
  currentVersion?: string | null;
  currentHref?: string;
}) {
  const published = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="border-b border-neutral-200 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bfa37a]">
          TheLawyr
        </p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-neutral-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-neutral-600">
          Version <span className="font-semibold text-neutral-900">{version}</span>
          {published && <> · in force from {published}</>}
          {status === 'SUPERSEDED' && <> · no longer in force</>}
        </p>
      </header>

      {status === 'SUPERSEDED' && (
        <div
          role="status"
          className="mt-6 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="font-semibold">You are reading a past version.</p>
          <p className="mt-1 leading-relaxed">
            This version has been replaced and is kept here permanently so that anyone who
            agreed to something under it can read the exact words they were shown.
            {currentVersion && currentHref && (
              <>
                {' '}
                The version in force now is{' '}
                <a href={currentHref} className="font-semibold underline underline-offset-2">
                  {currentVersion}
                </a>
                .
              </>
            )}
          </p>
        </div>
      )}

      {changeSummary && (
        <div className="mt-6 border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
            What changed in this version
          </p>
          {changeSummary}
        </div>
      )}

      <div
        className="prose prose-neutral mt-8 max-w-none prose-headings:font-serif prose-headings:tracking-tight
                   prose-h1:text-2xl prose-h2:mt-10 prose-h2:text-xl prose-h3:mt-8 prose-h3:text-base
                   prose-p:leading-relaxed prose-li:leading-relaxed prose-table:text-sm
                   prose-th:text-left prose-a:text-[#8a6d3b] prose-hr:my-10"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </article>
  );
}
