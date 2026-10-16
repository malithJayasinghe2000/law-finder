import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNoticeByVersion, getPublishedNotice } from '@/lib/privacy/notice';
import NoticeDocument from '@/components/privacy/NoticeDocument';

/**
 * One version of the privacy notice, at a permanent address.
 *
 * This URL is the whole point of versioning the notice. `ConsentRecord`
 * records which version a person was shown; that is only demonstrable consent
 * if the version can still be read, unchanged, years later. So this page must
 * keep working for every version ever published, including superseded ones —
 * there is no expiry and no redirect to the current text.
 *
 * A DRAFT is not served here. It was never in force, and publishing it at a
 * public address would put wording in the register that nobody agreed to.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string }>;
}): Promise<Metadata> {
  const { version } = await params;
  return {
    title: `Privacy Notice - version ${version}`,
    // Past versions are kept for evidence, not for search traffic. The current
    // notice at /privacy is the one a reader should land on.
    robots: { index: false, follow: true },
  };
}

export default async function PrivacyNoticeVersionPage({
  params,
}: {
  params: Promise<{ locale: string; version: string }>;
}) {
  const { locale, version } = await params;

  const [notice, current] = await Promise.all([
    getNoticeByVersion(version),
    getPublishedNotice(),
  ]);

  if (!notice) notFound();

  return (
    <div className="bg-white">
      <NoticeDocument
        title={notice.title}
        version={notice.version}
        body={notice.body}
        changeSummary={notice.changeSummary}
        status={notice.status}
        publishedAt={notice.publishedAt?.toISOString() ?? null}
        currentVersion={current?.version ?? null}
        currentHref={`/${locale}/privacy`}
      />

      <div className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8">
        <div className="border-t border-neutral-200 pt-6">
          <Link
            href={`/${locale}/privacy`}
            className="text-sm font-semibold text-neutral-900 underline-offset-4 hover:underline"
          >
            ← The notice in force today
          </Link>
        </div>
      </div>
    </div>
  );
}
