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
    <div className="py-8 sm:py-9">
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
                  <div className="group relative flex h-[440px] flex-col overflow-hidden rounded-none bg-[#222a35] text-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
                    {/* Top Image Area */}
                    <div className="relative h-[220px] w-full shrink-0">
                      <img 
                        src={lawyer.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'} 
                        alt={lawyer.fullName}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#222a35] via-[rgba(34,42,53,0.3)] to-transparent" />
                      
                      <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-none bg-white/20 backdrop-blur-md transition-colors hover:bg-white/30 text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="relative z-10 flex flex-1 flex-col px-6 pb-6 -mt-3">
                      {/* Title & Price */}
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="text-[22px] font-semibold tracking-tight text-white drop-shadow-sm leading-tight mt-1 max-w-[70%]">
                          {lawyer.fullName}
                        </h3>
                        <div className="shrink-0 rounded-none bg-white/10 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md border border-white/5">
                          {lawyer.baseFeeRange ? `LKR ${lawyer.baseFeeRange.split('-')[0].trim()}` : 'TBD'}
                        </div>
                      </div>

                      {/* Bio */}
                      <p className="line-clamp-2 text-[13px] text-white/70 leading-relaxed font-light mb-4 text-balance">
                        {lawyer.bio || 'Experienced legal professional dedicated to providing precise and strategic guidance.'}
                      </p>

                      {/* Badges row */}
                      <div className="mt-auto flex gap-2 overflow-x-hidden whitespace-nowrap mb-6 scrollbar-hide">
                        {avgRating > 0 && (
                           <div className="flex shrink-0 items-center gap-1.5 rounded-none bg-white/10 px-3 py-[5px] text-xs font-medium backdrop-blur-md border border-white/5">
                             <Star className="h-3.5 w-3.5 fill-current" />
                             {avgRating.toFixed(1)}
                           </div>
                        )}
                        {lawyer.district && (
                          <div className="flex shrink-0 items-center rounded-none bg-white/10 px-3 py-[5px] text-xs font-medium backdrop-blur-md border border-white/5 text-white/90">
                            {lawyer.district}
                          </div>
                        )}
                        {lawyer.practiceAreas.slice(0, 1).map((area) => (
                           <div key={area} className="flex shrink-0 items-center rounded-none bg-white/10 px-3 py-[5px] text-xs font-medium backdrop-blur-md border border-white/5 text-white/90">
                             {area}
                           </div>
                        ))}
                      </div>

                      {/* Button */}
                      <button className="w-full rounded-none bg-white py-3.5 text-[15px] font-bold text-[#222a35] transition-colors hover:bg-neutral-200 mt-auto">
                        View Profile
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
