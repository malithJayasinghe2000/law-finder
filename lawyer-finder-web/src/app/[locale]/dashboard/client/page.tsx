import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Eye, PenSquare, ArrowRight, LayoutDashboard, Clock } from 'lucide-react';
import Link from 'next/link';
import { STATUS_COLORS, STATUS_LABELS } from '@/schemas/community.schema';
import { Badge } from '@/components/ui/badge';

export default async function ClientDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Fetch client's posts stats
  const posts = await prisma.post.findMany({
    where: { authorId: session.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      viewCount: true,
      slug: true,
    }
  });

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'PUBLISHED').length,
    pending: posts.filter(p => p.status === 'PENDING_REVIEW').length,
    rejected: posts.filter(p => p.status === 'REJECTED').length,
    totalViews: posts.reduce((sum, p) => sum + p.viewCount, 0),
  };

  const recentPosts = posts.slice(0, 3);

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Welcome back</h1>
          <p className="text-sm text-neutral-500 font-medium">Manage your community posts and interactions</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow">
          <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center mb-3">
            <FileText className="h-4 w-4 text-neutral-600" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 tracking-tight">{stats.total}</p>
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">Total Posts</p>
        </div>
        
        <div className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow">
          <div className="w-9 h-9 bg-emerald-50 flex items-center justify-center mb-3">
            <Eye className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 tracking-tight">{stats.published}</p>
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">Published Posts</p>
        </div>

        <div className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow">
          <div className="w-9 h-9 bg-amber-50 flex items-center justify-center mb-3">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 tracking-tight">{stats.pending}</p>
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">Pending Review</p>
        </div>

        <div className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow">
          <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center mb-3">
            <Eye className="h-4 w-4 text-neutral-600" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 tracking-tight">{stats.totalViews}</p>
          <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-wide">Total Views</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
              <PenSquare className="w-4 h-4" />
              Recent Posts
            </h3>
            <Link href={`/${locale}/dashboard/blog/my-posts`} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          {recentPosts.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-neutral-200 bg-neutral-50/50">
              <FileText className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-900">No posts yet</p>
              <p className="text-xs text-neutral-500 mb-4 mt-1">Start engaging with the community by creating your first post.</p>
              <Link href={`/${locale}/blog/create`}>
                <Button className="bg-[#0a0a0a] text-white hover:bg-neutral-800 text-xs px-4 h-8 rounded-none">
                  Create Post
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div key={post.id} className="flex items-center justify-between border border-neutral-100 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex-1 min-w-0 pr-4">
                    <Link
                      href={post.status === 'PUBLISHED' ? `/${locale}/blog/${post.slug}` : `/${locale}/dashboard/blog/my-posts`}
                      className="block truncate text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors mb-1"
                    >
                      {post.title}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span>{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.viewCount}</span>
                    </div>
                  </div>
                  <div>
                    <Badge className={`text-[10px] uppercase tracking-wider px-2 py-0.5 whitespace-nowrap rounded-sm ${STATUS_COLORS[post.status] || 'bg-neutral-100 text-neutral-700'}`}>
                      {STATUS_LABELS[post.status] || post.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#0a0a0a] text-white p-6 flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-4">Quick Actions</h3>
          <p className="text-xs text-neutral-400 mb-6 flex-1">
            Share your legal questions or experiences with the community. Admins will review your post before it gets published.
          </p>
          <div className="space-y-3">
            <Link href={`/${locale}/blog/create`} className="block">
              <Button className="w-full bg-white text-black hover:bg-neutral-200 rounded-none h-11 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                <PenSquare className="w-4 h-4" /> Create New Post
              </Button>
            </Link>
            <Link href={`/${locale}/dashboard/blog/my-posts`} className="block">
              <Button variant="outline" className="w-full bg-transparent border-neutral-700 text-white hover:bg-neutral-800 hover:text-white rounded-none h-11 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> Manage My Posts
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
