import prisma from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Search, MapPin, Star, Briefcase, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SponsoredListing, AdBanner } from '@/components/ads/AdComponents';

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
    <div className="flex min-h-screen flex-col bg-white">
      {/* Hero Section */}
      <section className="relative bg-[#0d1017] text-white py-20 px-6 lg:px-12 xl:px-24">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            Find Your Perfect Lawyer
          </h1>
          <p className="text-[#a0a4ab] text-lg font-light mb-10 max-w-2xl">
            Browse verified Sri Lankan legal professionals. Use the filters to find the right match for your legal needs.
          </p>

          {/* Search + Filters */}
          <form className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                  <Input
                    name="search"
                    placeholder="Search by name or specialty..."
                    defaultValue={filters.search || ''}
                    className="pl-12 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-full focus:ring-[#ffb84f]"
                  />
                </div>
              </div>
              
              <div className="w-full lg:w-auto">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">District</label>
                <select
                  name="district"
                  defaultValue={filters.district || ''}
                  className="w-full h-12 rounded-full bg-white/10 border border-white/20 text-white px-4 text-sm focus:ring-2 focus:ring-[#ffb84f] outline-none"
                >
                  <option value="" className="bg-[#0d1017]">All Districts</option>
                  {['Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee', 'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle'].map((d) => (
                    <option key={d} value={d} className="bg-[#0d1017]">{d}</option>
                  ))}
                </select>
              </div>
              
              <div className="w-full lg:w-auto">
                <label className="block text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Practice Area</label>
                <select
                  name="practiceArea"
                  defaultValue={filters.practiceArea || ''}
                  className="w-full h-12 rounded-full bg-white/10 border border-white/20 text-white px-4 text-sm focus:ring-2 focus:ring-[#ffb84f] outline-none"
                >
                  <option value="" className="bg-[#0d1017]">All Areas</option>
                  {['Criminal Law', 'Family Law', 'Property Law', 'Labor Law', 'Corporate Law', 'Civil Law', 'Constitutional Law', 'Tax Law', 'Immigration Law', 'Environmental Law', 'Intellectual Property', 'Human Rights'].map((p) => (
                    <option key={p} value={p} className="bg-[#0d1017]">{p}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 w-full lg:w-auto">
                <button type="submit" className="flex-1 lg:flex-initial h-12 px-6 rounded-full bg-[#ffb84f] text-black font-bold text-sm hover:bg-[#e5a443] transition-all">
                  Filter
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Results Section */}
      <section className="flex-1 px-6 lg:px-12 xl:px-24 py-16">
        <div className="mx-auto max-w-[1200px]">
          
          {/* Results count & Ad */}
          <div className="mb-12">
            <p className="text-sm font-medium text-[#0a0d14] mb-6">
              Showing <span className="font-bold text-[#ffb84f]">{lawyers.length}</span> verified {lawyers.length === 1 ? 'lawyer' : 'lawyers'}
            </p>
            <div className="mb-10 w-full rounded-2xl overflow-hidden">
              <SponsoredListing placement="DIRECTORY_TOP" locale={locale} />
            </div>
          </div>

          {/* Grid */}
          {lawyers.length === 0 ? (
            <div className="text-center py-20">
              <Briefcase className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-2xl font-medium text-[#0a0d14] mb-2">No lawyers found</h3>
              <p className="text-neutral-500 font-light">
                Try adjusting your filters or search query to find the right legal professional.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {lawyers.map((lawyer) => {
                const avgRating =
                  lawyer.reviews.length > 0
                    ? lawyer.reviews.reduce((sum, r) => sum + r.rating, 0) / lawyer.reviews.length
                    : 0;

                return (
                  <Link key={lawyer.id} href={`/${locale}/lawyers/${lawyer.id}`}>
                    <div className="group relative flex h-[460px] flex-col overflow-hidden rounded-2xl bg-white border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]">
                      {/* Image Area */}
                      <div className="relative h-[210px] w-full shrink-0 overflow-hidden bg-neutral-100">
                        <img
                          src={lawyer.profileImageUrl || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=800&q=80'}
                          alt={lawyer.fullName}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </div>

                      {/* Content Area */}
                      <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
                        
                        <h3 className="text-lg font-medium tracking-tight text-[#0a0d14] line-clamp-1 mb-1">
                          {lawyer.fullName}
                        </h3>
                        
                        <p className="line-clamp-2 text-sm text-neutral-500 font-light mb-4">
                          {lawyer.bio || 'Experienced legal professional dedicated to providing precise and strategic guidance.'}
                        </p>

                        {/* Rating & Location */}
                        <div className="flex flex-wrap gap-2 mb-4 mt-auto">
                          {avgRating > 0 && (
                            <div className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-600">
                              <Star className="h-3 w-3 fill-orange-500 text-orange-500" />
                              {avgRating.toFixed(1)}
                            </div>
                          )}
                          {lawyer.district && (
                            <div className="flex items-center rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600">
                              <MapPin className="h-3 w-3 mr-1" />
                              {lawyer.district}
                            </div>
                          )}
                        </div>

                        {/* Footer - Price & Link */}
                        <div className="flex items-center justify-between border-t border-neutral-100 pt-4 mt-auto">
                          <span className="text-sm font-semibold text-[#0a0d14]">
                            {lawyer.baseFeeRange ? `LKR ${lawyer.baseFeeRange.split('-')[0].trim()}` : 'TBD'}
                          </span>
                          <span className="flex items-center text-[12px] font-bold text-[#ffb84f] uppercase tracking-wider group-hover:text-[#e5a443] transition-colors">
                            View <ArrowRight className="w-3 h-3 ml-1" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Bottom Ad */}
          {lawyers.length > 0 && (
            <div className="mt-16 w-full rounded-2xl overflow-hidden">
              <AdBanner placement="DIRECTORY_BOTTOM" locale={locale} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
                   

                 