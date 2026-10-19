import type { Metadata } from 'next';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Users, FileText, Clock, ShieldCheck, PenSquare, Scale, BookOpen } from 'lucide-react';
import Link from 'next/link';
import PostFeed from '@/components/community/PostFeed';
import JoinButton from './JoinButton';
import { CommunityDisclaimer } from '@/components/community/CommunityNotice';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const community = await prisma.community.findFirst({
    where: { name: slug, status: 'ACTIVE' },
    select: { displayName: true },
  });
  return { title: community?.displayName ?? 'Community Hub' };
}

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
    <div className="py-8 sm:py-12 bg-white selection:bg-[#bfa37a]/30">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
        {/* Community Banner */}
        <div className="relative mb-8 rounded-none overflow-hidden border border-[#efeae0] bg-[#faf8f6]">
          {community.coverImage && (
            <img
              src={community.coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-10"
            />
          )}
          <div className="relative p-8 sm:p-10 text-left">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center bg-[#bfa37a]/15 text-[#bfa37a] border border-[#bfa37a]/30 shrink-0 rounded-none">
                    <Scale className="h-6 w-6 stroke-[1.8]" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-neutral-900">
                      {community.displayName}
                    </h1>
                    <span className="text-xs text-[#bfa37a] uppercase tracking-wider font-bold">
                      c/{community.name}
                    </span>
                  </div>
                </div>
                <p className="text-neutral-500 text-sm font-light max-w-xl mb-5 leading-relaxed">
                  {community.description}
                </p>
                <div className="flex flex-wrap items-center gap-5 text-[10px] text-neutral-450 uppercase font-bold tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[#bfa37a]" />
                    <strong className="text-neutral-700 font-bold">{community._count.members}</strong> members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#bfa37a]" />
                    <strong className="text-neutral-700 font-bold">{community._count.posts}</strong> posts
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#bfa37a]" />
                    Created {new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <JoinButton
                  communityId={community.id}
                  isMember={!!membership}
                  isLoggedIn={!!session}
                  locale={locale}
                />
                {membership && (
                  <Link href={`/${locale}/blog/create?community=${community.name}`}>
                    <button className="inline-flex items-center gap-2 px-6 py-3.5 text-xs font-bold uppercase tracking-widest bg-transparent border border-[#bfa37a] text-[#bfa37a] hover:bg-[#bfa37a]/5 rounded-none transition-all">
                      <PenSquare className="h-3.5 w-3.5" /> Create Post
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
            <CommunityDisclaimer className="mb-4" />
            <PostFeed
              locale={locale}
              communitySlug={slug}
            />
          </div>

          {/* Community Sidebar */}
          <aside className="space-y-6">
            {/* About */}
            <Card className="border border-[#efeae0] rounded-none bg-white shadow-none text-left">
              <CardContent className="p-5">
                <h3 className="font-serif font-bold text-sm uppercase tracking-wider text-neutral-900 mb-3 border-b border-[#efeae0] pb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#bfa37a]" /> About c/{community.name}
                </h3>
                <p className="text-xs text-neutral-500 font-light leading-relaxed">
                  {community.description}
                </p>
              </CardContent>
            </Card>

            {/* Rules */}
            {community.rules && (
              <Card className="border border-[#efeae0] rounded-none bg-white shadow-none text-left">
                <CardContent className="p-5">
                  <h3 className="font-serif font-bold text-sm uppercase tracking-wider text-neutral-900 mb-3 border-b border-[#efeae0] pb-2 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-[#bfa37a]" /> Rules
                  </h3>
                  <div className="text-xs text-neutral-500 font-light leading-relaxed whitespace-pre-wrap">
                    {community.rules}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Moderation: the platform moderates every community. The old card
                listed creator accounts, which are staff accounts with no name. */}
            <p className="text-xs text-neutral-500 font-light flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[#bfa37a]" /> Moderated by the TheLawyr team.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
