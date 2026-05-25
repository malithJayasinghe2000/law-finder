import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Users, FileText, TrendingUp, PenSquare, Search, Award } from 'lucide-react';
import Link from 'next/link';
import PostFeed from '@/components/community/PostFeed';
import { SidebarAd } from '@/components/ads/AdComponents';

export const metadata = {
  title: 'Legal Community Hub — Sri Lanka',
  description:
    'Join Sri Lanka\'s largest legal community. Discuss law, share experiences, and learn from verified attorneys.',
};

export default async function CommunityHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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
    <div className="bg-[#fafafa] min-h-screen">
      {/* ─── Hero Section (Premium Dark Style) ─── */}
      <section className="bg-[#0d1017] text-white py-20 lg:py-24">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 relative">
          <div className="max-w-3xl">
            <span className="inline-block bg-[#ffb84f]/10 text-[#ffb84f] border border-[#ffb84f]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-6">
              Community Hub
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
              Legal Knowledge Community
            </h1>
            <p className="text-neutral-400 text-lg sm:text-xl font-light mb-8 max-w-2xl leading-relaxed">
              Connect with verified lawyers, share legal experiences, and discover expert insights across all areas of Sri Lankan law.
            </p>
            <div className="flex flex-wrap gap-4">
              {session ? (
                <Link 
                  href={`/${locale}/blog/create`}
                  className="flex items-center gap-2 bg-[#ffb84f] text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#e5a443] transition-all hover:scale-105"
                >
                  <PenSquare className="h-4 w-4" /> Create Post
                </Link>
              ) : (
                <Link 
                  href={`/${locale}/login`}
                  className="bg-[#ffb84f] text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#e5a443] transition-all hover:scale-105"
                >
                  Join Community
                </Link>
              )}
              <a 
                href="#communities"
                className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-white/10 transition-colors"
              >
                <Search className="h-4 w-4" /> Browse
              </a>
            </div>
          </div>

          {/* Stats Overlay */}
          <div className="absolute right-6 lg:right-12 xl:right-24 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-8 bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-sm">
            {[
              { icon: Users, value: totalMembers, label: 'Members' },
              { icon: FileText, value: totalPosts, label: 'Discussions' },
              { icon: TrendingUp, value: totalCommunities, label: 'Communities' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="h-6 w-6 text-[#ffb84f] mx-auto mb-2" />
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Main Content Area ─── */}
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-8 lg:gap-12">
          
          {/* Main Feed */}
          <div>
            <PostFeed locale={locale} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            {/* Communities List */}
            <div id="communities" className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h2 className="font-bold text-[#0a0d14] text-lg mb-6 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#ffb84f]" /> Active Communities
              </h2>
              <div className="space-y-2">
                {communities.map((community, index) => (
                  <Link
                    key={community.id}
                    href={`/${locale}/blog/community/${community.name}`}
                    className="flex items-center gap-4 p-3 rounded-2xl hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all group"
                  >
                    <span className="text-[10px] font-bold text-neutral-400 w-4 text-right">
                      {index + 1}
                    </span>
                    <span className="text-xl flex-shrink-0 bg-neutral-100 h-10 w-10 flex items-center justify-center rounded-full group-hover:bg-white group-hover:shadow-sm transition-all">{community.icon || '📋'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#0a0d14] truncate group-hover:text-[#ffb84f] transition-colors">
                        {community.displayName}
                      </div>
                      <div className="text-[11px] text-neutral-500 font-medium">
                        {community._count.members} members • {community._count.posts} posts
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Sponsored Lawyers */}
            <div className="overflow-hidden rounded-3xl">
               <SidebarAd placement="BLOG_FEED" locale={locale} />
            </div>

            {/* Community Guidelines */}
            <div className="bg-[#0a0d14] text-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2">📜 Community Guidelines</h3>
              <ul className="space-y-4 text-sm text-neutral-400 font-light">
                <li className="flex gap-3"><span className="text-[#ffb84f] font-bold">1.</span> Be respectful and professional</li>
                <li className="flex gap-3"><span className="text-[#ffb84f] font-bold">2.</span> No personal legal advice — for general discussion only</li>
                <li className="flex gap-3"><span className="text-[#ffb84f] font-bold">3.</span> Cite sources when discussing legal provisions</li>
                <li className="flex gap-3"><span className="text-[#ffb84f] font-bold">4.</span> No spam, self-promotion, or advertisements</li>
                <li className="flex gap-3"><span className="text-[#ffb84f] font-bold">5.</span> Respect privacy — never share case details</li>
              </ul>
            </div>

            {/* Lawyer CTA */}
            {true && (
              <div className="bg-[#ffb84f]/10 border border-[#ffb84f]/20 rounded-3xl p-8 text-center">
                <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <Award className="h-6 w-6 text-[#ffb84f]" />
                </div>
                <h3 className="font-bold text-[#0a0d14] text-lg mb-2">Lead a Community</h3>
                <p className="text-sm text-neutral-600 font-light mb-6">
                  Request a new legal community for your area of expertise.
                </p>
                <Link 
                  href={`/${locale}/dashboard/lawyer`}
                  className="block w-full bg-[#0a0d14] text-white py-3.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
                >
                  Request Community
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
