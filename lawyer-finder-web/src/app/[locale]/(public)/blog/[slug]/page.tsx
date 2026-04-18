import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Clock, Eye, Pin, Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import PostInteractions from './PostInteractions';
import { SidebarAd, AdBanner } from '@/components/ads/AdComponents';

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
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
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Back navigation */}
        <div className="flex items-center gap-3 mb-6 text-sm text-muted-foreground">
          <Link
            href={`/${locale}/blog`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Community Hub
          </Link>
          <span>/</span>
          <Link
            href={`/${locale}/blog/community/${post.community.name}`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            {post.community.icon} {post.community.displayName}
          </Link>
        </div>

        {/* Status badges */}
        {post.status === 'PENDING_REVIEW' && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
            ⏳ This post is pending review and is only visible to you.
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
        <article>
          {/* Post header */}
          <header className="mb-8">
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-3">
              {post.isPinned && (
                <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                  <Pin className="h-3 w-3" /> Pinned
                </Badge>
              )}
              <Link
                href={`/${locale}/blog/community/${post.community.name}`}
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                {post.community.icon} {post.community.displayName}
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
                  <span className="flex items-center gap-1 italic">
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
                <Badge variant="outline" className="gap-1 text-amber-500 border-amber-300">
                  <Lock className="h-3 w-3" /> Comments locked
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight mb-4">
              {post.title}
            </h1>

            {/* Cover image */}
            {post.coverImage && (
              <div className="mb-6 rounded-xl overflow-hidden border">
                <img
                  src={post.coverImage}
                  alt=""
                  className="w-full h-auto max-h-[400px] object-cover"
                />
              </div>
            )}

            {/* Author card */}
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
              <Link href={post.author.profile ? `/${locale}/lawyers/${post.author.profile.id}` : '#'}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold flex-shrink-0">
                  {post.author.profileImageUrl ? (
                    <img src={post.author.profileImageUrl} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    (post.author.profile?.fullName || post.author.fullName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{post.author.profile?.fullName || post.author.fullName || 'Unknown User'}</span>
                  {post.author.profile?.isVerified && (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  )}
                  {post.author.role === 'LAWYER' && (
                    <Badge variant="secondary" className="text-xs">Lawyer</Badge>
                  )}
                </div>
                {post.author.profile && (
                  <div className="text-xs text-muted-foreground">
                    {post.author.profile.practiceAreas?.slice(0, 2).join(', ')}
                    {post.author.profile.district && ` • ${post.author.profile.district}`}
                  </div>
                )}
              </div>
            </div>
          </header>

          <Separator className="my-6" />

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
            }}
            userVote={userVote as 'UPVOTE' | 'DOWNVOTE' | null}
            currentUserId={session?.userId || null}
            currentUserRole={session?.role || null}
            locale={locale}
            translations={post.translations}
          />

          <Separator className="my-8" />

          {/* Footer CTA */}
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <h3 className="text-lg font-semibold">Need legal assistance?</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Connect with verified Sri Lankan legal professionals for expert advice.
              </p>
              <div className="flex gap-3">
                {post.author.profile && (
                  <Link href={`/${locale}/lawyers/${post.author.profile.id}`}>
                    <button className="inline-flex items-center px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                      Contact Author
                    </button>
                  </Link>
                )}
                <Link href={`/${locale}/lawyers`}>
                  <button className="inline-flex items-center px-4 py-2 text-sm font-semibold border rounded-lg hover:bg-muted transition-colors">
                    Browse Directory
                  </button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </article>
        </div>

        {/* Sidebar Ad Zone */}
        <SidebarAd 
          placement="BLOG_SIDEBAR" 
          locale={locale} 
          practiceArea={post.community.category} 
          className="hidden lg:block w-[280px] shrink-0 sticky top-24"
        />
        </div>

        {/* Bottom Banner Ad */}
        <AdBanner placement="BLOG_POST_BOTTOM" locale={locale} className="mt-8" />
      </div>
    </div>
  );
}
