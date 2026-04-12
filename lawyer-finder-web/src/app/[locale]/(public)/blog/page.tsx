import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, FileText, TrendingUp, PenSquare, Search } from 'lucide-react';
import Link from 'next/link';
import PostFeed from '@/components/community/PostFeed';

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
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Hero Section */}
        <div className="relative mb-10 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-8 sm:p-12">
          <div className="relative z-10 max-w-2xl">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              Community Hub
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Sri Lanka&apos;s Legal Knowledge Community
            </h1>
            <p className="text-muted-foreground text-lg mb-6">
              Connect with verified lawyers, share legal experiences, and discover expert insights across all areas of Sri Lankan law.
            </p>
            <div className="flex flex-wrap gap-3">
              {session ? (
                <Link href={`/${locale}/blog/create`}>
                  <Button size="lg" className="gap-2 font-semibold">
                    <PenSquare className="h-4 w-4" /> Create Post
                  </Button>
                </Link>
              ) : (
                <Link href={`/${locale}/login`}>
                  <Button size="lg" className="gap-2 font-semibold">
                    Join Community
                  </Button>
                </Link>
              )}
              <a href="#communities">
                <Button size="lg" variant="outline" className="gap-2">
                  <Search className="h-4 w-4" /> Browse Communities
                </Button>
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="absolute right-8 top-8 hidden lg:flex gap-6">
            {[
              { icon: Users, value: totalMembers, label: 'Members' },
              { icon: FileText, value: totalPosts, label: 'Posts' },
              { icon: TrendingUp, value: totalCommunities, label: 'Communities' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="h-5 w-5 text-primary mx-auto mb-1" />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Main Feed */}
          <div>
            <PostFeed locale={locale} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Communities List */}
            <Card id="communities">
              <CardContent className="p-5">
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Communities
                </h2>
                <div className="space-y-1">
                  {communities.map((community, index) => (
                    <Link
                      key={community.id}
                      href={`/${locale}/blog/community/${community.name}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group"
                    >
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right">
                        {index + 1}
                      </span>
                      <span className="text-lg flex-shrink-0">{community.icon || '📋'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {community.displayName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {community._count.members} members • {community._count.posts} posts
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Community Guidelines */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-3">📜 Community Guidelines</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="text-primary">1.</span> Be respectful and professional</li>
                  <li className="flex gap-2"><span className="text-primary">2.</span> No personal legal advice — for general discussion only</li>
                  <li className="flex gap-2"><span className="text-primary">3.</span> Cite sources when discussing legal provisions</li>
                  <li className="flex gap-2"><span className="text-primary">4.</span> No spam, self-promotion, or advertisements</li>
                  <li className="flex gap-2"><span className="text-primary">5.</span> Respect privacy — never share case details</li>
                </ul>
              </CardContent>
            </Card>

            {/* Lawyer CTA */}
            {session?.role === 'LAWYER' && (
              <Card className="border-primary/20 bg-primary/[0.02]">
                <CardContent className="p-5 text-center">
                  <h3 className="font-semibold mb-2">Want to create a community?</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Request a new legal community for your area of expertise.
                  </p>
                  <Link href={`/${locale}/dashboard/lawyer`}>
                    <Button size="sm" variant="outline" className="w-full">
                      Request Community
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
