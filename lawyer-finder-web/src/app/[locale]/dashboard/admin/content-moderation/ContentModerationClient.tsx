'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Eye, AlertTriangle, FileText, Flag, ExternalLink, Search, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { STATUS_COLORS, STATUS_LABELS } from '@/schemas/community.schema';

interface PendingPost {
  id: string;
  title: string;
  content: string;
  slug: string;
  language: string;
  createdAt: string;
  author: { id: string; fullName: string | null; role: string };
  community: { name: string; displayName: string };
}

interface PendingReport {
  id: string;
  reason: string;
  description: string | null;
  createdAt: string;
  reporter: { id: string; fullName: string | null };
  post: { id: string; title: string; slug: string } | null;
  comment: { id: string; content: string } | null;
}

export default function ContentModerationClient({
  pendingPosts: initialPosts,
  pendingReports: initialReports,
  locale,
}: {
  pendingPosts: PendingPost[];
  pendingReports: PendingReport[];
  locale: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [reports, setReports] = useState(initialReports);
  const [allPosts, setAllPosts] = useState<PendingPost[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const fetchAllPosts = async () => {
    setLoadingAll(true);
    try {
      const res = await fetch('/api/admin/posts?status=all&limit=100');
      const data = await res.json();
      if (res.ok) {
        setAllPosts(data.posts);
      }
    } catch {
      toast.error('Failed to fetch all content.');
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    fetchAllPosts();
  }, []);

  const filteredAllPosts = allPosts.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.author.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleModeratePost = async (postId: string, status: 'PUBLISHED' | 'REJECTED') => {
    setProcessing(postId);
    try {
      const res = await fetch('/api/admin/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, status }),
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success(`Post ${status.toLowerCase()}.`);
      } else {
        toast.error('Failed to moderate post.');
      }
    } catch {
      toast.error('Error moderating post.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReviewReport = async (reportId: string, status: 'DISMISSED' | 'ACTION_TAKEN') => {
    setProcessing(reportId);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        toast.success(`Report ${status === 'DISMISSED' ? 'dismissed' : 'action taken'}.`);
      }
    } catch {
      toast.error('Error processing report.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Tabs defaultValue="posts" className="space-y-4">
      <TabsList>
        <TabsTrigger value="posts" className="gap-1.5">
          <FileText className="h-4 w-4" /> Posts ({posts.length})
        </TabsTrigger>
        <TabsTrigger value="reports" className="gap-1.5">
          <Flag className="h-4 w-4" /> Reports ({reports.length})
        </TabsTrigger>
        <TabsTrigger value="all" className="gap-1.5">
          <Search className="h-4 w-4" /> All Content ({allPosts.length})
        </TabsTrigger>
      </TabsList>

      {/* Pending Posts */}
      <TabsContent value="posts" className="space-y-3">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Check className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm">No posts pending review.</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="border-amber-200/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                      <span>{post.community.displayName}</span>
                      <span>•</span>
                      <span>by {post.author.fullName} ({post.author.role})</span>
                      <span>•</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      <Badge variant="outline" className="text-[10px]">{post.language}</Badge>
                    </div>
                    <h3 className="font-semibold tracking-tight mb-1">{post.title}</h3>
                    
                    {expandedPost === post.id ? (
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap border rounded-lg p-3 bg-muted/30 max-h-[300px] overflow-y-auto my-2">
                        {post.content}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.content.substring(0, 200)}...</p>
                    )}
                    
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        {expandedPost === post.id ? 'Collapse' : 'Read preview'}
                      </button>
                      <Link 
                        href={`/${locale}/blog/${post.slug}`}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        target="_blank"
                      >
                        <ExternalLink className="h-3 w-3" /> Manage full post
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleModeratePost(post.id, 'PUBLISHED')}
                      disabled={processing === post.id}
                      className="gap-1 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleModeratePost(post.id, 'REJECTED')}
                      disabled={processing === post.id}
                      className="gap-1 text-red-500 border-red-200"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      {/* Reports */}
      <TabsContent value="reports" className="space-y-3">
        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Check className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="font-medium">No pending reports!</p>
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="border-red-200/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs text-red-500 border-red-200">
                        {report.reason}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Reported by {report.reporter.fullName}
                      </span>
                    </div>
                    {report.post && (
                      <p className="text-sm font-medium">Post: &quot;{report.post.title}&quot;</p>
                    )}
                    {report.comment && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        Comment: &quot;{report.comment.content}&quot;
                      </p>
                    )}
                    {report.description && (
                      <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReviewReport(report.id, 'DISMISSED')}
                      disabled={processing === report.id}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReviewReport(report.id, 'ACTION_TAKEN')}
                      disabled={processing === report.id}
                      className="gap-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Take Action
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      {/* All Content Management */}
      <TabsContent value="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchAllPosts} disabled={loadingAll} className="gap-2">
            <RefreshCcw className={`h-4 w-4 ${loadingAll ? 'animate-spin' : ''}`} />
            Refresh List
          </Button>
        </div>

        {loadingAll ? (
          <div className="py-12 text-center text-muted-foreground">
            <RefreshCcw className="h-8 w-8 mx-auto mb-2 animate-spin text-primary/50" />
            <p>Loading all community content...</p>
          </div>
        ) : filteredAllPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="font-medium">No results found.</p>
              <p className="text-sm">Try adjusting your search criteria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAllPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground flex-wrap">
                        <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[post.status as any]}`}>
                          {STATUS_LABELS[post.status as any]}
                        </Badge>
                        <span>{post.community.displayName}</span>
                        <span>•</span>
                        <span>by {post.author.fullName}</span>
                        <span>•</span>
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-semibold tracking-tight truncate">{post.title}</h3>
                      <div className="mt-2">
                        <Link 
                          href={`/${locale}/blog/${post.slug}`}
                          className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                          target="_blank"
                        >
                          <ExternalLink className="h-3 w-3" /> Manage full post
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
