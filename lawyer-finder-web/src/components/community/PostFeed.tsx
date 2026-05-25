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

export default function PostFeed({ locale, communityId, communitySlug, initialSort = 'hot' }: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState(initialSort);
  const [timeRange, setTimeRange] = useState('week');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        page: page.toString(),
        limit: '20',
      });
      if (communityId) params.set('communityId', communityId);
      if (communitySlug) params.set('community', communitySlug);
      if (sort === 'top') params.set('time', timeRange);

      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [sort, page, communityId, communitySlug, timeRange]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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

  const sortTabs = [
    { key: 'hot', label: '🔥 Hot' },
    { key: 'new', label: '✨ New' },
    { key: 'top', label: '📈 Top' },
  ];

  const timeRanges = [
    { key: 'day', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="space-y-4">
        {/* Sort tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-white border border-neutral-100 rounded-full w-fit shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
        {sortTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setSort(tab.key); setPage(1); }}
            className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${
              sort === tab.key
                ? 'bg-[#0a0d14] text-white'
                : 'text-neutral-500 hover:text-[#0a0d14] hover:bg-neutral-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Time range for "top" */}
      {sort === 'top' && (
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mt-4">
          {timeRanges.map((range) => (
            <button
              key={range.key}
              onClick={() => { setTimeRange(range.key); setPage(1); }}
              className={`px-4 py-2 rounded-full transition-all ${
                timeRange === range.key
                  ? 'bg-[#ffb84f] text-black border-transparent'
                  : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-[#0a0d14]'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#ffb84f]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-neutral-100 shadow-sm">
          <p className="text-lg font-bold text-[#0a0d14]">No posts yet</p>
          <p className="text-sm mt-3 font-light text-neutral-500">Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-4">
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
        <div className="flex justify-center items-center gap-4 pt-8">
          <button
            className="px-6 py-3 bg-white border border-neutral-200 rounded-full text-[10px] font-bold uppercase tracking-widest hover:border-[#0a0d14] hover:text-[#0a0d14] disabled:opacity-50 transition-colors"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span className="flex items-center text-[10px] uppercase font-bold tracking-widest text-[#ffb84f] bg-[#0a0d14] px-4 py-2 rounded-full">
            {page} / {totalPages}
          </span>
          <button
            className="px-6 py-3 bg-white border border-neutral-200 rounded-full text-[10px] font-bold uppercase tracking-widest hover:border-[#0a0d14] hover:text-[#0a0d14] disabled:opacity-50 transition-colors"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
