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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#efeae0] pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a]">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-serif text-neutral-900">Welcome Back</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-450 mt-1">Manage your community posts and interactions</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-md transition-all duration-300">
          <div className="w-11 h-11 bg-[#faf8f6] border border-[#efeae0] flex items-center justify-center rounded-xl mb-4 text-[#bfa37a]">
            <FileText className="h-5 w-5" />
          </div>
          <p className="text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">{stats.total}</p>
          <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1.5">Total Posts</p>
        </div>
        
        <div className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-md transition-all duration-300">
          <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 flex items-center justify-center rounded-xl mb-4 text-emerald-600">
            <Eye className="h-5 w-5" />
          </div>
          <p className="text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">{stats.published}</p>
          <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1.5">Published</p>
        </div>

        <div className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-md transition-all duration-300">
          <div className="w-11 h-11 bg-amber-50 border border-amber-100 flex items-center justify-center rounded-xl mb-4 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <p className="text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">{stats.pending}</p>
          <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1.5">Pending Review</p>
        </div>

        <div className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-md transition-all duration-300">
          <div className="w-11 h-11 bg-[#faf8f6] border border-[#efeae0] flex items-center justify-center rounded-xl mb-4 text-[#bfa37a]">
            <Eye className="h-5 w-5" />
          </div>
          <p className="text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">{stats.totalViews}</p>
          <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1.5">Total Views</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white border border-[#efeae0] p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-6 border-b border-[#efeae0] pb-4">
            <h3 className="text-base font-bold uppercase tracking-widest text-neutral-800 flex items-center gap-2 font-serif">
              <PenSquare className="w-4.5 h-4.5 text-[#bfa37a]" />
              Recent Posts
            </h3>
            <Link href={`/${locale}/blog/my-posts`} className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a] hover:text-[#a68d67] flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          
          {recentPosts.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[#efeae0] bg-[#faf8f6]/30 rounded-2xl p-6">
              <FileText className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-neutral-900 font-serif">No posts yet</p>
              <p className="text-xs text-neutral-500 mb-6 mt-2 max-w-sm mx-auto font-light leading-relaxed">Start engaging with the community by creating your first post.</p>
              <Link href={`/${locale}/blog/create`}>
                <Button className="bg-[#bfa37a] hover:bg-[#a68d67] text-white text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 h-10 rounded-full shadow-sm hover:shadow-md transition-all duration-300">
                  Create Post
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <div key={post.id} className="flex items-center justify-between border border-[#efeae0]/60 p-5 rounded-xl hover:border-[#bfa37a]/30 hover:shadow-md transition-all duration-300">
                  <div className="flex-1 min-w-0 pr-4">
                    <Link
                      href={post.status === 'PUBLISHED' ? `/${locale}/blog/${post.slug}` : `/${locale}/blog/my-posts`}
                      className="block truncate text-sm font-bold font-serif text-neutral-950 hover:text-[#bfa37a] transition-colors mb-1.5"
                    >
                      {post.title}
                    </Link>
                    <div className="flex items-center gap-4 text-xs text-neutral-450 font-medium">
                      <span>{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {post.viewCount} views</span>
                    </div>
                  </div>
                  <div>
                    <Badge className={`text-[9px] uppercase tracking-wider px-2.5 py-0.5 whitespace-nowrap rounded-full font-bold ${
                      post.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                      post.status === 'PENDING_REVIEW' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                      'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {STATUS_LABELS[post.status] || post.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#161616] text-white p-6 rounded-2xl flex flex-col shadow-md">
          <h3 className="text-base font-bold uppercase tracking-widest mb-4 font-serif text-white">Quick Actions</h3>
          <p className="text-xs text-neutral-400 mb-8 flex-1 leading-relaxed font-light">
            Share your legal questions or experiences with the community. Admins will review your post before it gets published.
          </p>
          <div className="space-y-4">
            <Link href={`/${locale}/blog/create`} className="block">
              <button className="w-full bg-[#bfa37a] hover:bg-[#a68d67] text-white rounded-full h-12 text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-sm flex items-center justify-center gap-2 border border-transparent">
                <PenSquare className="w-4 h-4" /> Create New Post
              </button>
            </Link>
            <Link href={`/${locale}/blog/my-posts`} className="block">
              <button className="w-full bg-transparent border-neutral-700 text-white hover:bg-white/10 rounded-full h-12 text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border">
                <FileText className="w-4 h-4" /> Manage My Posts
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
