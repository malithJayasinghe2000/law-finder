import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FileText, Clock, ShieldCheck, PenSquare } from 'lucide-react';
import Link from 'next/link';
import PostFeed from '@/components/community/PostFeed';
import JoinButton from './JoinButton';

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const session = await getSession();

  const community = await prisma.community.findUnique({
    where: { name: slug },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      members: {
        where: { role: { in: ['CREATOR', 'MODERATOR'] } },
        include: {
          user: { select: { id: true, fullName: true, profileImageUrl: true, role: true } },
        },
        take: 10,
      },
      _count: { select: { posts: true, members: true } },
    },
  });

  if (!community || community.status !== 'ACTIVE') notFound();

  // Check user membership
  let membership = null;
  if (session) {
    membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: session.userId } },
    });
  }

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Community Banner */}
        <div className="relative mb-8 rounded-2xl overflow-hidden border bg-gradient-to-r from-primary/10 to-primary/5">
          {community.coverImage && (
            <img
              src={community.coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
          )}
          <div className="relative p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{community.icon || '📋'}</span>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {community.displayName}
                    </h1>
                    <span className="text-sm text-muted-foreground">
                      c/{community.name}
                    </span>
                  </div>
                </div>
                <p className="text-muted-foreground max-w-xl mb-4">
                  {community.description}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <strong className="text-foreground">{community._count.members}</strong> members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    <strong className="text-foreground">{community._count.posts}</strong> posts
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Created {new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <JoinButton
                  communityId={community.id}
                  isMember={!!membership}
                  isLoggedIn={!!session}
                  locale={locale}
                />
                {membership && (
                  <Link href={`/${locale}/blog/create?community=${community.name}`}>
                    <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border rounded-lg hover:bg-muted transition-colors">
                      <PenSquare className="h-4 w-4" /> Create Post
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Feed */}
          <div>
            <PostFeed
              locale={locale}
              communitySlug={slug}
            />
          </div>

          {/* Community Sidebar */}
          <aside className="space-y-6">
            {/* About */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-3">About</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {community.description}
                </p>
                <div className="text-xs text-muted-foreground mb-2">
                  Category: <Badge variant="secondary" className="text-xs">{community.category}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Rules */}
            {community.rules && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3">📜 Community Rules</h3>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {community.rules}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Moderators */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-3">Moderators</h3>
                <div className="space-y-2">
                  {community.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {member.user.profileImageUrl ? (
                          <img src={member.user.profileImageUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          (member.user.fullName || '?').charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{member.user.fullName}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {member.role === 'CREATOR' ? 'Creator' : 'Mod'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
