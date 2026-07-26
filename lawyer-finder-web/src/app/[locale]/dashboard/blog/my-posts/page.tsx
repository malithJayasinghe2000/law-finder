import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PenSquare, Eye, Clock, MessageCircle, ArrowBigUp, ArrowLeft, FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { STATUS_COLORS, STATUS_LABELS } from '@/schemas/community.schema';
import PostActionButtons from '@/components/community/PostActionButtons';

export default async function MyPostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const posts = await prisma.post.findMany({
    where: { authorId: session.userId },
    include: {
      community: { select: { name: true, displayName: true, icon: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const stats = {
    total: posts.length,
    published: posts.filter((p) => p.status === 'PUBLISHED').length,
    pending: posts.filter((p) => p.status === 'PENDING_REVIEW').length,
    totalViews: posts.reduce((sum, p) => sum + p.viewCount, 0),
    totalScore: posts.reduce((sum, p) => sum + p.score, 0),
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-2">
      <div className="bg-white rounded-none shadow-sm border border-neutral-200 p-8 sm:p-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-neutral-100">
          <div>
            <h1 className="text-4xl font-serif font-normal tracking-tight text-neutral-900">Community Posts</h1>
            <p className="text-sm text-neutral-500 font-medium mt-0.5">Manage your shared posts and insights</p>
          </div>
          <Link href={`/${locale}/blog/create`}>
            <button className="flex items-center gap-2.5 bg-[#0a0a0a] text-white px-6 py-3 font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-all rounded-none border-none cursor-pointer">
              <PenSquare className="h-4 w-4" /> New Post
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Posts', value: stats.total, icon: FileText },
            { label: 'Published', value: stats.published, icon: Eye },
            { label: 'Total Views', value: stats.totalViews, icon: Eye },
            { label: 'Total Score', value: stats.totalScore, icon: ArrowBigUp },
          ].map((stat) => (
            <Card key={stat.label} className="rounded-none border border-neutral-200 shadow-none">
              <CardContent className="p-4 text-center">
                <stat.icon className="h-5 w-5 text-[#bfa37a] mx-auto mb-1" />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-neutral-450 font-medium">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Posts list */}
        {posts.length === 0 ? (
          <Card className="rounded-none border border-neutral-200 shadow-none">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <FileText className="h-12 w-12 text-neutral-300" />
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">No posts yet</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  Share your legal knowledge with the community!
                </p>
              </div>
              <Link href={`/${locale}/blog/create`}>
                <button className="flex items-center gap-2 bg-[#0a0a0a] text-white px-6 py-3 font-bold uppercase tracking-widest text-xs hover:bg-[#a68d67] transition-all rounded-none border-none cursor-pointer">
                  <PenSquare className="h-4 w-4" /> Create Your First Post
                </button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="hover:shadow-sm transition-shadow rounded-none border border-neutral-200 shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <Badge className={`text-[10px] uppercase font-bold tracking-wider rounded-none ${STATUS_COLORS[post.status]}`}>
                          {STATUS_LABELS[post.status]}
                        </Badge>
                        <span className="text-xs text-neutral-500 font-medium">
                          {post.community.icon} {post.community.displayName}
                        </span>
                      </div>
                      <Link
                        href={post.status === 'PUBLISHED' ? `/${locale}/blog/${post.slug}` : '#'}
                        className={post.status === 'PUBLISHED' ? 'hover:text-[#bfa37a] transition-colors' : 'cursor-default'}
                      >
                        <h3 className="font-semibold text-neutral-900 tracking-tight line-clamp-1 text-base">
                          {post.title}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-4 mt-2.5 text-xs text-neutral-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(post.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowBigUp className="h-3.5 w-3.5" /> {post.score}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" /> {post._count.comments}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" /> {post.viewCount}
                        </span>
                      </div>
                    </div>
                    {post.coverImage && (
                      <img
                        src={post.coverImage}
                        alt=""
                        className="w-20 h-14 object-cover rounded-none flex-shrink-0 hidden sm:block border"
                      />
                    )}
                  </div>
                  
                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-neutral-100">
                    <PostActionButtons postId={post.id} locale={locale} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
