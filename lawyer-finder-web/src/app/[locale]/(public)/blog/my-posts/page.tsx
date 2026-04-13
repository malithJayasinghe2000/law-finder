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
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link
            href={`/${locale}/blog`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Community Hub
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold tracking-tight">My Posts</h1>
          <Link href={`/${locale}/blog/create`}>
            <Button className="gap-2 font-semibold">
              <PenSquare className="h-4 w-4" /> New Post
            </Button>
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
            <Card key={stat.label}>
              <CardContent className="p-4 text-center">
                <stat.icon className="h-5 w-5 text-primary mx-auto mb-1" />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Posts list */}
        {posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <h3 className="text-lg font-semibold">No posts yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Share your legal knowledge with the community!
                </p>
              </div>
              <Link href={`/${locale}/blog/create`}>
                <Button className="gap-2">
                  <PenSquare className="h-4 w-4" /> Create Your First Post
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-xs px-2 py-0.5 ${STATUS_COLORS[post.status]}`}>
                          {STATUS_LABELS[post.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {post.community.icon} {post.community.displayName}
                        </span>
                      </div>
                      <Link
                        href={post.status === 'PUBLISHED' ? `/${locale}/blog/${post.slug}` : '#'}
                        className={post.status === 'PUBLISHED' ? 'hover:text-primary transition-colors' : 'cursor-default'}
                      >
                        <h3 className="font-semibold tracking-tight line-clamp-1">
                          {post.title}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(post.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowBigUp className="h-3 w-3" /> {post.score}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {post._count.comments}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {post.viewCount}
                        </span>
                      </div>
                    </div>
                    {post.coverImage && (
                      <img
                        src={post.coverImage}
                        alt=""
                        className="w-20 h-14 object-cover rounded-md flex-shrink-0 hidden sm:block"
                      />
                    )}
                  </div>
                  
                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
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
