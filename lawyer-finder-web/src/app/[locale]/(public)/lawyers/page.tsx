import prisma from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Search, MapPin, Languages, ShieldCheck, Star, Briefcase } from 'lucide-react';

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
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
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
                className="pl-10"
              />
            </div>
            <select
              name="district"
              defaultValue={filters.district || ''}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none"
            >
              <option value="">All Districts</option>
              {['Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Mullaitivu','Batticaloa','Ampara','Trincomalee','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              name="practiceArea"
              defaultValue={filters.practiceArea || ''}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none"
            >
              <option value="">All Practice Areas</option>
              {['Criminal Law','Family Law','Property Law','Labor Law','Corporate Law','Civil Law','Constitutional Law','Tax Law','Immigration Law','Environmental Law','Intellectual Property','Human Rights'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button type="submit" className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Filter
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lawyers.map((lawyer) => {
              const avgRating =
                lawyer.reviews.length > 0
                  ? lawyer.reviews.reduce((sum, r) => sum + r.rating, 0) / lawyer.reviews.length
                  : 0;

              return (
                <Link key={lawyer.id} href={`/${locale}/lawyers/${lawyer.id}`}>
                  <Card className="group h-full hover:shadow-lg transition-all duration-300 hover:border-primary/20 cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary text-lg font-bold">
                          {lawyer.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-semibold group-hover:text-primary transition-colors">
                              {lawyer.fullName}
                            </h3>
                            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                          </div>
                          {lawyer.district && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {lawyer.district}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Practice Areas */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {lawyer.practiceAreas.slice(0, 3).map((area) => (
                          <Badge key={area} variant="secondary" className="text-xs font-normal">
                            {area}
                          </Badge>
                        ))}
                        {lawyer.practiceAreas.length > 3 && (
                          <Badge variant="outline" className="text-xs font-normal">
                            +{lawyer.practiceAreas.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-4 flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Languages className="h-3.5 w-3.5" />
                          {lawyer.languages.join(', ')}
                        </div>
                        {avgRating > 0 && (
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {avgRating.toFixed(1)}
                            <span className="text-muted-foreground">({lawyer.reviews.length})</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
