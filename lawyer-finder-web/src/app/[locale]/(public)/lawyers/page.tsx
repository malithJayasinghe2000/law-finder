import prisma from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Search, MapPin, Languages, ShieldCheck, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdBanner } from '@/components/ads/AdComponents';
import LawyerCard from '@/components/lawyer/LawyerCard';
import LawyerFilterForm from './LawyerFilterForm';
import { LegalDisclaimer } from '@/components/shared/LegalDisclaimer';

export const metadata = { title: 'Lawyer Directory' };

const PAGE_SIZE = 12;

export default async function LawyerDirectory({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;

  // --- Build Prisma where clause ---
  const where: Record<string, unknown> = { isVerified: true };
  if (filters.district) where.district = filters.district;
  if (filters.practiceArea) where.practiceAreas = { has: filters.practiceArea };
  if (filters.language) where.languages = { has: filters.language };
  if (filters.search) {
    const searchTerm = filters.search.trim();
    where.OR = [
      { fullName: { contains: searchTerm, mode: 'insensitive' } },
      { bio: { contains: searchTerm, mode: 'insensitive' } },
      { district: { contains: searchTerm, mode: 'insensitive' } },
      { practiceAreas: { has: searchTerm } },
    ];
  }

  // --- Pagination ---
  const currentPage = Math.max(1, parseInt(filters.page || '1', 10) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [lawyers, totalCount] = await Promise.all([
    prisma.lawyerProfile.findMany({
      where,
      // Rule 40 content limit: no fee range, no rating, no subscription signal.
      // A bare findMany would serialize every column into the RSC payload.
      // See docs/restructure/LEGAL-GUARDRAILS.md.
      select: {
        id: true,
        fullName: true,
        profileImageUrl: true,
        bio: true,
        practiceAreas: true,
        languages: true,
        district: true,
      },
      // Alphabetical, and disclosed as such below. Nobody can buy a position.
      orderBy: { fullName: 'asc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.lawyerProfile.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = !!(filters.search || filters.district || filters.practiceArea || filters.language);

  // --- Build pagination URL helper ---
  function buildPageUrl(page: number) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.district) params.set('district', filters.district);
    if (filters.practiceArea) params.set('practiceArea', filters.practiceArea);
    if (filters.language) params.set('language', filters.language);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return `/${locale}/lawyers${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="py-8 sm:py-9">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
        {/* Header */}
        <div className="mb-10 max-w-2xl">
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">Attorneys</h1>
          <p className="mt-3 text-muted-foreground">
            Browse verified Sri Lankan Attorneys-at-Law. Listings are ordered alphabetically and cannot be paid for. Use the filters to narrow the list, then choose for yourself.
          </p>
        </div>

        {/* Same two lenses as /firms. See the note there. */}
        <div
          className="mb-6 inline-flex border border-neutral-200"
          role="tablist"
          aria-label="Browse by"
        >
          <Link
            href={`/${locale}/firms`}
            role="tab"
            aria-selected="false"
            className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            Practices
          </Link>
          <span
            role="tab"
            aria-selected="true"
            className="bg-neutral-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white"
          >
            People
          </span>
        </div>

        <LawyerFilterForm locale={locale} filters={filters} />

        <Separator className="mb-8" />

        {/* Results count */}
        <p className="mb-3 text-sm text-muted-foreground">
          {totalCount} verified {totalCount === 1 ? 'lawyer' : 'lawyers'} found
          {hasFilters && (
            <span className="text-xs text-neutral-400 ml-2">
              (Showing page {currentPage} of {totalPages})
            </span>
          )}
        </p>

        {/* Ranking neutrality must be disclosed, not just practised */}
        <LegalDisclaimer variant="directory" className="mb-6" />

        {/* Grid */}
        {lawyers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <h3 className="text-lg font-semibold">No lawyers found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters or search query.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Sponsored listings removed from the directory in Phase 2.
                Attorneys were buying an AdCampaign slot and appearing as a
                "★ Sponsored" card ahead of everyone else in this very list.
                That is selling position and visibility to a lawyer — guardrail
                rule 3, and the conduct rules it comes from — on the single
                highest-risk surface in the product.
                The ad system itself is untouched and is restructured in Phase 4,
                where the split between lawyer and non-lawyer advertisers is
                dealt with properly.
                See docs/restructure/LEGAL-GUARDRAILS.md (rule 3). */}

            {lawyers.map((lawyer) => {

              return (
                <LawyerCard
                  key={lawyer.id}
                  id={lawyer.id}
                  fullName={lawyer.fullName}
                  profileImageUrl={lawyer.profileImageUrl}
                  bio={lawyer.bio}
                  practiceAreas={lawyer.practiceAreas}
                  languages={lawyer.languages}
                  district={lawyer.district}

                  locale={locale}
                  imageHeight="h-[280px]"
                />
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-12 pt-8 border-t border-neutral-100" aria-label="Pagination">
            {/* Previous */}
            {currentPage > 1 ? (
              <Link
                href={buildPageUrl(currentPage - 1)}
                className="inline-flex items-center gap-1 h-9 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 h-9 px-4 rounded-md border border-input bg-muted/50 text-sm font-medium text-muted-foreground cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" /> Previous
              </span>
            )}

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // Show: first, last, current, and ±1 neighbors
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                  if (idx > 0) {
                    const prev = arr[idx - 1];
                    if (page - prev > 1) acc.push('ellipsis');
                  }
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">…</span>
                  ) : (
                    <Link
                      key={item}
                      href={buildPageUrl(item)}
                      className={`h-9 w-9 rounded-md inline-flex items-center justify-center text-sm font-medium transition-colors ${item === currentPage
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-input bg-background hover:bg-muted'
                        }`}
                    >
                      {item}
                    </Link>
                  )
                )}
            </div>

            {/* Next */}
            {currentPage < totalPages ? (
              <Link
                href={buildPageUrl(currentPage + 1)}
                className="inline-flex items-center gap-1 h-9 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 h-9 px-4 rounded-md border border-input bg-muted/50 text-sm font-medium text-muted-foreground cursor-not-allowed">
                Next <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
