import prisma from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Search, MapPin, Languages, ShieldCheck, Briefcase } from 'lucide-react';
import { SponsoredListing, AdBanner } from '@/components/ads/AdComponents';
import LawyerCard from '@/components/lawyer/LawyerCard';

export const metadata = { title: 'Lawyer Directory' };

export default async function LawyerDirectory({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;

  const where: Record<string, unknown> = { isVerified: true };
  if (filters.district) where.district = filters.district;
  if (filters.practiceArea) where.practiceAreas = { has: filters.practiceArea };
  if (filters.language) where.languages = { has: filters.language };
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { bio: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const lawyers = await prisma.lawyerProfile.findMany({
    where,
    include: { reviews: { where: { isApproved: true } } },
    orderBy: { fullName: 'asc' },
  });

  return (
    <div className="py-8 sm:py-9">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
        {/* Header */}
        <div className="mb-10 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Lawyer Directory</h1>
          <p className="mt-3 text-muted-foreground">
            Browse verified Sri Lankan legal professionals. Use the filters to find the right match.
          </p>
        </div>

        {/* Search + Filters */}
        <form className="mb-10">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="search"
                placeholder="Search by name or specialty..."
                defaultValue={filters.search || ''}
                className="pl-10 h-9"
              />
            </div>
            <select
              name="district"
              defaultValue={filters.district || ''}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none"
            >
              <option value="">All Districts</option>
              {['Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee', 'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              name="practiceArea"
              defaultValue={filters.practiceArea || ''}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none"
            >
              <option value="">All Practice Areas</option>
              {['Criminal Law', 'Family Law', 'Property Law', 'Labor Law', 'Corporate Law', 'Civil Law', 'Constitutional Law', 'Tax Law', 'Immigration Law', 'Environmental Law', 'Intellectual Property', 'Human Rights'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button type="submit" className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Filter
            </button>
            <button type="reset" className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Clear
            </button>
          </div>
        </form>

        <Separator className="mb-8" />

        {/* Results count */}
        <p className="mb-6 text-sm text-muted-foreground">
          {lawyers.length} verified {lawyers.length === 1 ? 'lawyer' : 'lawyers'} found
        </p>

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
            {/* Sponsored Listings at the top */}
            <SponsoredListing placement="DIRECTORY_INLINE" locale={locale} imageHeight="h-[280px]" />

            {lawyers.map((lawyer) => {
              const avgRating =
                lawyer.reviews.length > 0
                  ? lawyer.reviews.reduce((sum, r) => sum + r.rating, 0) / lawyer.reviews.length
                  : 0;

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
                  avgRating={avgRating}
                  locale={locale}
                  imageHeight="h-[280px]"
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
