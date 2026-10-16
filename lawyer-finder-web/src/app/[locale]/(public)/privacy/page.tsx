import Link from 'next/link';
import type { Metadata } from 'next';
import prisma from '@/lib/db';
import { getPublishedNotice } from '@/lib/privacy/notice';
import NoticeDocument from '@/components/privacy/NoticeDocument';

/**
 * The privacy notice currently in force.
 *
 * Read from the database rather than a file, because the version register is
 * what consent records point at — a notice kept in the repository would be a
 * second copy that could drift from the one people actually agreed to.
 *
 * Past versions stay readable at /privacy/<version>, permanently. They are
 * listed at the bottom of this page rather than behind a separate index, since
 * a version list nobody can find is not a version list.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privacy Notice',
  description:
    'What personal data TheLawyr collects, why, on what legal basis, who can reach it, and how long it is kept.',
};

export default async function PrivacyNoticePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const notice = await getPublishedNotice();

  const past = await prisma.privacyNotice.findMany({
    where: { status: 'SUPERSEDED' },
    orderBy: { publishedAt: 'desc' },
    select: { version: true, publishedAt: true, changeSummary: true },
  });

  if (!notice) {
    // Honest rather than blank. If this ever renders, the register is empty and
    // consent cannot be recorded either — the consents API refuses a grant in
    // exactly this state rather than stamping an unprovable version.
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="font-serif text-3xl tracking-tight text-neutral-900">Privacy Notice</h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600">
          No version of this notice is published yet. Until one is, we are not recording any
          new consents - a record of agreement to a document that cannot be produced is not
          worth anything to you or to us.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600">
          Write to{' '}
          <a className="underline underline-offset-2" href="mailto:hello@thelawyr.lk">
            hello@thelawyr.lk
          </a>{' '}
          with any question about your personal data in the meantime.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <NoticeDocument
        title={notice.title}
        version={notice.version}
        body={notice.body}
        changeSummary={notice.changeSummary}
        status="PUBLISHED"
        publishedAt={notice.publishedAt?.toISOString() ?? null}
      />

      <div className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8">
        <div className="border-t border-neutral-200 pt-8">
          <h2 className="font-serif text-lg tracking-tight text-neutral-900">
            Previous versions
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Every version is kept permanently at its own address, so that a consent you gave
            under an earlier one still points at the exact words you were shown.
          </p>

          {past.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              This is the first version. Nothing has been replaced yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-neutral-100 border-y border-neutral-100">
              {past.map((p) => (
                <li key={p.version} className="py-3">
                  <Link
                    href={`/${locale}/privacy/${p.version}`}
                    className="text-sm font-semibold text-neutral-900 underline-offset-4 hover:underline"
                  >
                    Version {p.version}
                  </Link>
                  {p.publishedAt && (
                    <span className="ml-2 text-xs text-neutral-500">
                      in force from{' '}
                      {new Date(p.publishedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                  {p.changeSummary && (
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      {p.changeSummary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-sm text-neutral-600">
            To see what we hold about you, change a consent, download your data or ask us to
            delete your account, go to{' '}
            <Link
              href={`/${locale}/dashboard/profile/privacy`}
              className="font-semibold underline underline-offset-2"
            >
              Your data
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
