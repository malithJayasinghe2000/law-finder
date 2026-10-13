import prisma from '@/lib/db';
import { isPublicDirectoryEnabled } from '@/lib/directory';
import DirectoryWithdrawn from '@/components/directory/DirectoryWithdrawn';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import {
  Building2, MapPin, Users, ShieldCheck, ChevronLeft, ChevronRight, Clock,
} from 'lucide-react';
import FirmFilterForm from './FirmFilterForm';
import { LegalDisclaimer } from '@/components/shared/LegalDisclaimer';

export const metadata = { title: 'Law Firms' };

const PAGE_SIZE = 12;

/**
 * Public directory of law firms.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The firm is the provider of legal services, so this — not the attorney list —
 * is the front door of the product.
 *
 * Bound by the Rule 40 content limit. The `select` below is the real boundary of
 * what we publish: every field lands in the RSC payload whether the JSX renders
 * it or not. No fee indication, no rating, no "featured" treatment, and no
 * ordering anyone can buy — alphabetical, and said so on the page.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md — "The Rule 40 content limit", and
 * counsel questions 16–18 on whether this surface may exist at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default async function FirmDirectory({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { locale } = await params;

  // Withdrawn by an administrator — see src/lib/directory.ts.
  if (!(await isPublicDirectoryEnabled())) {
    return <DirectoryWithdrawn locale={locale} />;
  }

  const filters = await searchParams;

  const where: Record<string, unknown> = {
    isActive: true,
    verificationStatus: 'VERIFIED',
  };
  if (filters.district) where.district = filters.district;
  if (filters.practiceArea) where.practiceAreas = { has: filters.practiceArea };
  if (filters.search) {
    where.name = { contains: filters.search.trim(), mode: 'insensitive' };
  }

  const currentPage = Math.max(1, parseInt(filters.page || '1', 10) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [firms, totalCount] = await Promise.all([
    prisma.lawFirm.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        firmType: true,
        description: true,
        practiceAreas: true,
        languages: true,
        district: true,
        officeHours: true,
        establishedYear: true,
        logoUrl: true,
        _count: { select: { lawyers: true } },
      },
      // Alphabetical. Nobody can buy a position in this list.
      orderBy: { name: 'asc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.lawFirm.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = !!(filters.search || filters.district || filters.practiceArea);

  function buildPageUrl(page: number) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.district) params.set('district', filters.district);
    if (filters.practiceArea) params.set('practiceArea', filters.practiceArea);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return `/${locale}/firms${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="py-8 sm:py-9">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
        <div className="mb-10 max-w-2xl">
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">Law Firms</h1>
          <p className="mt-3 text-muted-foreground">
            Browse verified Sri Lankan law firms. Listings are ordered alphabetically
            and cannot be paid for. Use the filters to narrow the list, then choose for
            yourself.
          </p>
        </div>

        {/* One browse surface, two lenses.
            Every firm here is a practice and every attorney belongs to one, so
            listing both as separate menu items showed a sole practitioner twice
            — once as a person and once as their own firm. The toggle keeps both
            ways of looking without pretending they are different populations. */}
        <div
          className="mb-6 inline-flex border border-neutral-200"
          role="tablist"
          aria-label="Browse by"
        >
          <span
            role="tab"
            aria-selected="true"
            className="bg-neutral-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white"
          >
            Practices
          </span>
          <Link
            href={`/${locale}/lawyers`}
            role="tab"
            aria-selected="false"
            className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            People
          </Link>
        </div>

        <FirmFilterForm locale={locale} filters={filters} />

        <Separator className="mb-8" />

        <p className="mb-3 text-sm text-muted-foreground">
          {totalCount} verified {totalCount === 1 ? 'firm' : 'firms'} found
          {hasFilters && ' for your filters'}
        </p>

        {firms.length === 0 ? (
          <Card className="rounded-none">
            <CardContent className="py-16 text-center">
              <Building2 className="mx-auto h-8 w-8 text-neutral-300" />
              <h3 className="mt-3 text-lg font-semibold">No firms found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try widening your filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {firms.map((firm) => (
              <Link
                key={firm.id}
                href={`/${locale}/firms/${firm.slug}`}
                className="group border border-neutral-100 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="flex items-start gap-3">
                  {firm.logoUrl ? (
                    <img
                      src={firm.logoUrl}
                      alt={firm.name}
                      className="h-12 w-12 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-neutral-100">
                      <Building2 className="h-5 w-5 text-neutral-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate font-serif text-lg text-neutral-900 transition-colors group-hover:text-[#bfa37a]">
                      {firm.name}
                    </h2>
                    <p className="text-[11px] uppercase tracking-widest text-[#bfa37a]">
                      {firm.firmType === 'SOLE_PRACTITIONER'
                        ? 'Sole practitioner'
                        : 'Attorneys-at-Law'}
                    </p>
                  </div>
                </div>

                {firm.description && (
                  <p className="mt-3 line-clamp-2 text-sm font-light leading-relaxed text-neutral-600">
                    {firm.description}
                  </p>
                )}

                <div className="mt-4 space-y-1.5 text-[11px] text-neutral-500">
                  {firm.district && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0" /> {firm.district}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3 w-3 shrink-0" />
                    {firm._count.lawyers}{' '}
                    {firm._count.lawyers === 1 ? 'attorney' : 'attorneys'}
                    {firm.establishedYear && ` · est. ${firm.establishedYear}`}
                  </p>
                  {firm.officeHours && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 shrink-0" /> {firm.officeHours}
                    </p>
                  )}
                </div>

                {firm.practiceAreas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {firm.practiceAreas.slice(0, 3).map((a) => (
                      <span
                        key={a}
                        className="border border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-600"
                      >
                        {a}
                      </span>
                    ))}
                    {firm.practiceAreas.length > 3 && (
                      <span className="px-1 py-0.5 text-[10px] text-neutral-400">
                        +{firm.practiceAreas.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-4 flex items-center gap-1 text-[10px] uppercase tracking-widest text-neutral-400">
                  <ShieldCheck className="h-3 w-3" /> Verified practice
                </p>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              href={buildPageUrl(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage <= 1}
              className={`inline-flex h-9 items-center gap-1 border border-neutral-200 px-3 text-sm ${
                currentPage <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-neutral-50'
              }`}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Link
              href={buildPageUrl(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage >= totalPages}
              className={`inline-flex h-9 items-center gap-1 border border-neutral-200 px-3 text-sm ${
                currentPage >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-neutral-50'
              }`}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <div className="mt-10">
          <LegalDisclaimer variant="directory" />
        </div>
      </div>
    </div>
  );
}
