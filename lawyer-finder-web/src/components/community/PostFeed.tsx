'use client';
 
import { useState, useEffect, useCallback } from 'react';
import PostCard from './PostCard';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
 
interface PostFeedProps {
  locale: string;
  communityId?: string;
  communitySlug?: string;
  initialSort?: string;
  search?: string;
}
 
interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  language: string;
  status: string;
  isPinned: boolean;
  isLocked: boolean;
  score: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  userVote: 'UPVOTE' | 'DOWNVOTE' | null;
  author: {
    id: string;
    fullName: string | null;
    profileImageUrl: string | null;
    role: string;
    profile?: { isVerified: boolean } | null;
  };
  community: {
    id: string;
    name: string;
    displayName: string;
    icon: string | null;
  };
}
 
export default function PostFeed({ locale, communityId, communitySlug, search = '' }: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  // Always newest first — the API no longer orders by votes, because an
  // up-voted attorney's post at the top is the platform promoting them.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
 
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort: 'new',
        page: page.toString(),
        limit: '20',
      });
      if (communityId) params.set('communityId', communityId);
      if (communitySlug) params.set('community', communitySlug);
      if (search) params.set('search', search);
 
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [page, communityId, communitySlug, search]);
 
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    setPage(1);
  }, [search]);
 
  const handleVote = async (postId: string, type: 'UPVOTE' | 'DOWNVOTE') => {
    const res = await fetch(`/api/posts/${postId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) throw new Error('Vote failed');
    const data = await res.json();
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, score: data.score, userVote: data.userVote }
          : p
      )
    );
  };
 
  return (
    <div className="space-y-4 text-left">
      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No posts yet</p>
          <p className="text-sm mt-1">Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              locale={locale}
              onVote={handleVote}
              showCommunity={!communitySlug}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
