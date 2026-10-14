import prisma from '@/lib/db';
import { directoryPath } from '@/lib/directoryLinks';
import { isPublicDirectoryEnabled } from '@/lib/directory';
import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Clock, Eye, Pin, Lock, ArrowLeft, Scale } from 'lucide-react';
import Link from 'next/link';
import PostInteractions from './PostInteractions';
import { SidebarAd, AdBanner } from '@/components/ads/AdComponents';
import { CommunityDisclaimer } from '@/components/community/CommunityNotice';

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const directoryEnabled = await isPublicDirectoryEnabled();
  const session = await getSession();

  const post = await prisma.post.findFirst({
    where: {
      slug,
    },
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          profileImageUrl: true,
          role: true,
          profile: {
            select: { isVerified: true, fullName: true, practiceAreas: true, district: true, id: true },
          },
        },
      },
      community: {
        select: { id: true, name: true, displayName: true, icon: true },
      },
      translations: true,
    },
  });

  if (!post) notFound();

  // Only show non-published posts to author or admin
  if (post.status !== 'PUBLISHED') {
    if (!session || (session.userId !== post.authorId && session.role !== 'ADMIN')) {
      notFound();
    }
  }

  // Get user's vote on this post
  let userVote = null;
  if (session) {
    const vote = await prisma.vote.findUnique({
      where: { userId_postId: { userId: session.userId, postId: post.id } },
    });
    userVote = vote?.type || null;
  }

  // Increment view count (fire-and-forget)
  prisma.post.update({
    where: { id: post.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  // Get comment count
  const commentCount = await prisma.comment.count({
    where: { postId: post.id, isDeleted: false },
  });

  return (
    <div className="py-12 sm:py-16 bg-white selection:bg-[#bfa37a]/30">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12 xl:px-24">
        {/* Back navigation */}
        <div className="flex flex-wrap items-center gap-3 mb-8 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
          <Link
            href={`/${locale}/blog`}
            className="flex items-center gap-1.5 hover:text-[#bfa37a] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Community Hub
          </Link>
          <span>/</span>
          <Link
            href={`/${locale}/blog/community/${post.community.name}`}
            className="flex items-center gap-1.5 hover:text-[#bfa37a] transition-colors font-bold uppercase tracking-wider text-[10px]"
          >
            <Scale className="h-3.5 w-3.5 text-[#bfa37a]" /> {post.community.displayName}
          </Link>
        </div>

        {/* Status badges */}
        {post.status === 'PENDING_REVIEW' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 animate-pulse" /> This post is pending review and is only visible to you.
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 min-w-0">
        <article className="text-left">
          {/* Post header */}
          <header className="mb-8">
            <div className="flex items-center gap-2.5 flex-wrap text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4">
              {post.isPinned && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#bfa37a] border border-[#bfa37a]/30 bg-[#faf8f6] px-2 py-0.5">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </span>
              )}
              <Link
                href={`/${locale}/blog/community/${post.community.name}`}
                className="flex items-center gap-1 text-neutral-600 hover:text-[#bfa37a] transition-colors"
              >
                <Scale className="h-3.5 w-3.5 text-[#bfa37a]" /> {post.community.displayName}
              </Link>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(post.createdAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </span>
              {new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 60000 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 italic text-neutral-400 normal-case font-light">
                    Last updated: {new Date(post.updatedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> {post.viewCount} views
              </span>
              {post.isLocked && (
                <span className="inline-flex items-center gap-1 text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5">
                  <Lock className="h-2.5 w-2.5" /> Comments locked
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-900 leading-tight mb-6">
              {post.title}
            </h1>

            {/* Cover image */}
            {post.coverImage && (
              <div className="mb-8 overflow-hidden border border-[#efeae0]">
                <img
                  src={post.coverImage}
                  alt=""
                  className="w-full h-auto max-h-[420px] object-cover"
                />
              </div>
            )}

            {/* Author card */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-[#faf8f6] border border-[#efeae0]">
              {/* Not a link, and no practice areas or district: a post is not a
                  route to hiring its author. Name and "Lawyer" stay — they are
                  what the reader needs to weigh what was written. */}
              <div>
                <div className="flex h-12 w-12 items-center justify-center bg-neutral-100 border border-neutral-200 text-neutral-800 font-bold flex-shrink-0 overflow-hidden">
                  {post.author.profileImageUrl ? (
                    <img src={post.author.profileImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (post.author.profile?.fullName || post.author.fullName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-serif font-bold text-neutral-900">{post.author.profile?.fullName || post.author.fullName || 'Unknown User'}</span>
                  {post.author.profile?.isVerified && (
                    <ShieldCheck className="h-4 w-4 text-[#bfa37a]" />
                  )}
                  {post.author.role === 'LAWYER' && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#bfa37a] bg-[#bfa37a]/10 px-2 py-0.5 border border-[#bfa37a]/20">Lawyer</span>
                  )}
                </div>
              </div>
            </div>
          </header>

          <Separator className="my-8 bg-[#efeae0]" />

          <CommunityDisclaimer className="mb-6" />

          {/* Post content + interactions (client component) */}
          <PostInteractions
            post={{
              id: post.id,
              content: post.content,
              language: post.language,
              score: post.score,
              isLocked: post.isLocked,
              commentCount,
              authorId: post.authorId,
              communityName: post.community.name,
            }}
            userVote={userVote as 'UPVOTE' | 'DOWNVOTE' | null}
            currentUserId={session?.userId || null}
            currentUserRole={session?.role || null}
            locale={locale}
            translations={post.translations}
          />

          <Separator className="my-10 bg-[#efeae0]" />

          {/* Footer CTA */}
          <Card className="border border-[#efeae0] rounded-none bg-[#faf8f6] shadow-none">
            <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
              <h3 className="text-lg font-serif font-bold text-neutral-900">Need help with your own matter?</h3>
              <p className="text-xs text-neutral-500 max-w-md font-light leading-relaxed">
                A discussion here is general. For advice on your own situation, send a request to a practice of your choice.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                {/* No "Contact Author": a post must not become a lead for the
                    attorney who wrote it (BASL note, June 2021; Rule 39). */}
                {directoryEnabled && (
                  <Link href={directoryPath(locale)}>
                    <button className="inline-flex items-center px-6 py-4 border border-[#bfa37a] text-[#bfa37a] hover:bg-[#bfa37a]/5 text-xs font-bold uppercase tracking-widest transition-all">
                      Browse Directory
                    </button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </article>
        </div>

        {/* Sidebar Ad Zone */}
        <SidebarAd 
          placement="BLOG_POST_SIDEBAR" 
          locale={locale} 
          practiceArea={post.community.name} 
          className="hidden lg:block w-[280px] shrink-0 sticky top-24"
        />
        </div>

        {/* Bottom Banner Ad */}
        <AdBanner placement="BLOG_POST_BOTTOM" locale={locale} className="mt-8" />
      </div>
    </div>
  );
}
