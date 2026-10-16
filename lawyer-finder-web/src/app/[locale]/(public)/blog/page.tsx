import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, FileText, TrendingUp, PenSquare, Search, ArrowRight, Scale, BookOpen } from 'lucide-react';
import Link from 'next/link';
import PostFeed from '@/components/community/PostFeed';
import { SidebarAd, AdBanner, StickyBottomAd } from '@/components/ads/AdComponents';
import { CommunityDisclaimer } from '@/components/community/CommunityNotice';

export const metadata = {
  title: 'Legal Community Hub - Sri Lanka',
  description:
    'Join Sri Lanka\'s largest legal community. Discuss law, share experiences, and learn from verified attorneys.',
};

export default async function CommunityHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const { locale } = await params;
  const { search = '' } = await searchParams;
  const session = await getSession();

  // Fetch communities
  const communities = await prisma.community.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { memberCount: 'desc' },
    take: 20,
    include: {
      _count: { select: { posts: true, members: true } },
    },
  });

  // Stats
  const [totalPosts, totalMembers, totalCommunities] = await Promise.all([
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.communityMember.count(),
    prisma.community.count({ where: { status: 'ACTIVE' } }),
  ]);

  return (
    <div className="py-12 sm:py-16 bg-white selection:bg-[#bfa37a]/30">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
        {/* Editorial Hero Header */}
        <div className="relative mb-12 border border-[#efeae0] bg-[#faf8f6] p-8 sm:p-12 transition-all duration-300">
          <div className="relative z-10 max-w-2xl space-y-6">
            <span className="inline-flex text-[9px] font-bold uppercase tracking-[0.2em] text-[#bfa37a] bg-[#bfa37a]/10 px-3.5 py-1.5 border border-[#bfa37a]/20">
              Community Hub
            </span>
            <h1 className="text-3xl sm:text-5xl font-serif tracking-tight text-neutral-900 leading-tight">
              Sri Lanka&apos;s Legal <br />Knowledge Community
            </h1>
            <p className="text-neutral-550 text-sm sm:text-base font-light leading-relaxed max-w-xl">
              Discuss Sri Lankan law and how it works, area by area. General discussion, not legal advice.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {session ? (
                <Link href={`/${locale}/blog/create`}>
                  <Button className="bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none px-7 py-5.5 text-xs font-bold uppercase tracking-widest transition-all">
                    <PenSquare className="h-4 w-4 mr-1.5" /> Create Post
                  </Button>
                </Link>
              ) : (
                <Link href={`/${locale}/login`}>
                  <Button className="bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none px-7 py-5.5 text-xs font-bold uppercase tracking-widest transition-all">
                    Join Community
                  </Button>
                </Link>
              )}
              <a href="#communities">
                <Button variant="outline" className="border border-[#bfa37a] text-[#bfa37a] hover:bg-[#bfa37a]/5 rounded-none px-7 py-5.5 text-xs font-bold uppercase tracking-widest transition-all">
                  <Search className="h-3.5 w-3.5 mr-1.5" /> Browse Communities
                </Button>
              </a>
            </div>
          </div>

          {/* Stats on Right */}
          <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden lg:flex gap-8 border-l border-[#efeae0] pl-10 py-6">
            {[
              { icon: Users, value: totalMembers, label: 'Members' },
              { icon: FileText, value: totalPosts, label: 'Posts' },
              { icon: TrendingUp, value: totalCommunities, label: 'Communities' },
            ].map((stat) => (
              <div key={stat.label} className="text-center space-y-1 min-w-[80px]">
                <stat.icon className="h-5 w-5 text-[#bfa37a] mx-auto mb-1.5 stroke-[1.5]" />
                <div className="text-2xl font-serif font-bold text-neutral-900">{stat.value}</div>
                <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
          {/* Main Feed */}
          <div>
            <CommunityDisclaimer className="mb-4" />
            <PostFeed locale={locale} search={search} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            {/* Search Box */}
            <Card className="border border-[#efeae0] rounded-none bg-[#faf8f6] shadow-none">
              <CardContent className="p-6 space-y-4 text-left">
                <h3 className="font-serif font-bold text-base text-neutral-900 uppercase tracking-wider border-b border-[#efeae0] pb-2.5">Search Here</h3>
                <form action={`/${locale}/blog`} method="GET" className="flex">
                  <input
                    type="text"
                    name="search"
                    defaultValue={search}
                    placeholder="Search Here"
                    className="w-full bg-white border border-[#efeae0] border-r-0 px-4 py-3 outline-none focus:border-[#bfa37a] text-neutral-800 text-xs font-light"
                  />
                  <button
                    type="submit"
                    className="bg-[#bfa37a] hover:bg-[#a68d67] text-white px-5 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </form>
              </CardContent>
            </Card>

            {/* Top of Category Card Banner */}
            <AdBanner placement="BLOG_TOP_BANNER" locale={locale} className="mb-6" />

            {/* Communities list as Dark Categories list */}
            <Card id="communities" className="border border-neutral-900 bg-[#1e1e21] text-white rounded-none shadow-none">
              <CardContent className="p-6 text-left">
                <h2 className="font-serif font-bold text-base uppercase tracking-wider text-white mb-5 flex items-center gap-2 border-b border-white/10 pb-3">
                  <Users className="h-4.5 w-4.5 text-[#bfa37a] stroke-[1.8]" /> Categories
                </h2>
                <div className="space-y-1">
                  {communities.map((community) => (
                    <Link
                      key={community.id}
                      href={`/${locale}/blog/community/${community.name}`}
                      className="flex items-center justify-between py-3.5 border-b border-white/5 hover:border-[#bfa37a]/30 transition-all group"
                    >
                      <span className="text-xs font-semibold text-neutral-300 group-hover:text-[#bfa37a] group-hover:translate-x-1.5 transition-all truncate pr-4 uppercase tracking-wider">
                        {community.displayName}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-white/40 group-hover:text-[#bfa37a] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Community Guidelines */}
            <Card className="border border-[#efeae0] rounded-none bg-white shadow-none">
              <CardContent className="p-6 text-left">
                <h3 className="font-serif font-bold text-base uppercase tracking-wider text-neutral-900 mb-4 border-b border-[#efeae0] pb-3 flex items-center gap-2">
                  <BookOpen className="h-4.5 w-4.5 text-[#bfa37a] stroke-[1.8]" /> Guidelines
                </h3>
                <ul className="space-y-3.5 text-xs text-neutral-500 font-light">
                  <li className="flex gap-2"><span className="text-[#bfa37a] font-bold">1.</span> Be respectful and professional</li>
                  <li className="flex gap-2"><span className="text-[#bfa37a] font-bold">2.</span> General discussion only - no legal advice</li>
                  <li className="flex gap-2"><span className="text-[#bfa37a] font-bold">3.</span> Cite sources when discussing legal provisions</li>
                  <li className="flex gap-2"><span className="text-[#bfa37a] font-bold">4.</span> No spam, self-promotion, or advertisements</li>
                  <li className="flex gap-2"><span className="text-[#bfa37a] font-bold">5.</span> Respect privacy - never share case details</li>
                </ul>
              </CardContent>
            </Card>

            {/* Lawyer CTA */}
            {session?.role === 'LAWYER' && (
              <Card className="border border-[#bfa37a]/30 bg-[#faf8f6] rounded-none shadow-none">
                <CardContent className="p-6 text-center space-y-4">
                  <h3 className="font-serif font-bold text-base text-neutral-900">Want to create a community?</h3>
                  <p className="text-xs text-neutral-500 font-light leading-relaxed">
                    Request a new legal community for your area of expertise.
                  </p>
                  <Link href={`/${locale}/dashboard/lawyer`} className="block">
                    <Button size="sm" className="w-full bg-[#bfa37a] text-white hover:bg-[#a68d67] rounded-none py-4.5 text-xs font-bold uppercase tracking-wider">
                      Request Community
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Sticky Ad Sidebar (rotated 3sec, 5 ads max) */}
            <div className="sticky top-24 pt-4">
              <SidebarAd placement="BLOG_RIGHT_SIDEBAR" locale={locale} />
            </div>
          </aside>
        </div>
      </div>
      
      {/* Blog bottom fixed sticky ad */}
      <StickyBottomAd placement="BLOG_BOTTOM_STICKY" locale={locale} />
    </div>
  );
}
