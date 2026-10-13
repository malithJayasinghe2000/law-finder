import Link from 'next/link';
import { Building2 } from 'lucide-react';

/**
 * Shown at `/lawyers` and `/firms` while the public directory is switched off.
 * Old links, bookmarks and search results still land somewhere that explains
 * itself instead of a bare 404. See src/lib/directory.ts.
 */
export default function DirectoryWithdrawn({ locale }: { locale: string }) {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-xl px-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center bg-neutral-100">
          <Building2 className="h-6 w-6 text-neutral-500" />
        </div>
        <h1 className="mt-6 text-2xl font-light tracking-tight sm:text-3xl">
          The public directory is not available
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          To contact a law firm, use the link the firm gave you. If you already have an account,
          your matters and messages are in your dashboard.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/dashboard`}
            className="bg-neutral-900 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-neutral-800"
          >
            My dashboard
          </Link>
          <Link
            href={`/${locale}/legal-library`}
            className="border border-neutral-300 px-6 py-3 text-xs font-bold uppercase tracking-widest text-neutral-700 hover:bg-neutral-50"
          >
            Legal library
          </Link>
        </div>
      </div>
    </div>
  );
}
