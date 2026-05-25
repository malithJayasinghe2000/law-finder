'use client';

import { MessageCircle, Clock, Eye, Pin, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import VoteButtons from './VoteButtons';

interface PostCardProps {
  post: {
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
      profile?: { isVerified: boolean; fullName?: string | null } | null;
    };
    community: {
      id: string;
      name: string;
      displayName: string;
      icon: string | null;
    };
  };
  locale: string;
  onVote?: (postId: string, type: 'UPVOTE' | 'DOWNVOTE') => Promise<void>;
  showCommunity?: boolean;
}

export default function PostCard({ post, locale, onVote, showCommunity = true }: PostCardProps) {
  const timeAgo = getTimeAgo(post?.createdAt ? new Date(post.createdAt) : new Date());

  const handleVote = async (type: 'UPVOTE' | 'DOWNVOTE') => {
    if (onVote && post?.id) await onVote(post.id, type);
  };

  return (
    <div className={`group bg-white rounded-3xl overflow-hidden border ${post?.isPinned ? 'border-[#ffb84f]/20 bg-[#ffb84f]/5 rounded-3xl' : 'border-neutral-100 bg-white'} shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-neutral-200`}>
      <div className="flex">
        {/* Vote column */}
        <div className="hidden sm:flex flex-col items-center justify-start py-6 px-4 bg-neutral-50 border-r border-neutral-100">
          <VoteButtons
            score={post.score}
            userVote={post.userVote}
            onVote={handleVote}
            orientation="vertical"
            size="sm"
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-4">
            {post?.isPinned && (
              <span className="flex items-center gap-1.5 text-[#ffb84f] bg-[#ffb84f]/10 px-2 py-1 rounded-full border border-[#ffb84f]/20">
                <Pin className="h-3 w-3" /> Pinned
              </span>
            )}
            {showCommunity && post?.community && (
              <Link
                href={`/${locale}/blog/community/${post.community.name || ''}`}
                className="text-[#0a0d14] hover:text-[#ffb84f] transition-colors flex items-center gap-1"
              >
                {post.community.icon} {post.community.displayName}
              </Link>
            )}
            <span className="text-neutral-300">•</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#0a0d14]">
                {post?.author?.profile?.fullName || post?.author?.fullName || 'Unknown User'}
              </span>
              {post?.author?.profile?.isVerified && (
                <ShieldCheck className="h-4 w-4 text-[#ffb84f]" />
              )}
              {post?.author?.role === 'LAWYER' && (
                <span className="bg-[#0a0d14] text-white px-2 py-1 rounded-full text-[9px]">
                  Lawyer
                </span>
              )}
            </span>
            <span className="text-neutral-300">•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-neutral-400" /> {timeAgo}
            </span>
          </div>

          {/* Title */}
          <Link href={`/${locale}/blog/${post?.slug || ''}`}>
            <h3 className="text-xl sm:text-2xl font-bold text-[#0a0d14] tracking-tight group-hover:text-[#ffb84f] transition-colors line-clamp-2 mb-3 leading-snug">
              {post?.title || 'Untitled Post'}
            </h3>
          </Link>

          {/* Rich Content + Cover */}
          <div className="flex flex-col md:flex-row gap-6 mt-4 mb-6">
            <div className="flex-1 min-w-0 relative">
              {post?.content && (
                <div className="relative">
                  <div 
                    className="prose prose-neutral max-w-none text-neutral-500 font-light leading-relaxed max-h-[140px] overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                  {post.content.length > 250 && (
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  )}
                </div>
              )}
              {post?.content && post.content.length > 250 && (
                <Link href={`/${locale}/blog/${post?.slug || ''}`} className="text-[#0a0d14] text-[10px] font-bold uppercase tracking-widest hover:text-[#ffb84f] transition-colors inline-block mt-4 border-b border-[#0a0d14] hover:border-[#ffb84f] pb-0.5">
                  Read Full Article
                </Link>
              )}
            </div>
            {post?.coverImage && (
              <div className="flex-shrink-0">
                <img
                  src={post.coverImage}
                  alt=""
                  className="w-full md:w-36 h-36 object-cover rounded-2xl border border-neutral-100 shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Actions bar */}
          <div className="flex items-center flex-wrap gap-6 text-[10px] font-bold uppercase tracking-widest text-[#0a0d14]">
            {/* Mobile vote */}
            <div className="sm:hidden">
              <VoteButtons
                score={post?.score || 0}
                userVote={post?.userVote || null}
                onVote={handleVote}
                orientation="horizontal"
                size="sm"
              />
            </div>
            <Link
              href={`/${locale}/blog/${post?.slug || ''}#comments`}
              className="flex items-center gap-2 hover:text-[#ffb84f] transition-colors bg-neutral-50 px-4 py-2 rounded-full"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{post?.commentCount || 0} <span className="hidden sm:inline">Comments</span></span>
            </Link>
            <div className="flex items-center gap-2 text-neutral-400 border border-neutral-100 px-4 py-2 rounded-full">
              <Eye className="h-4 w-4" />
              <span>{formatCount(post?.viewCount || 0)}</span>
            </div>
            {post?.isLocked && (
              <div className="flex items-center gap-1.5 text-[#0a0d14] bg-neutral-100 px-3 py-2 rounded-full">
                <Lock className="h-3 w-3" />
                <span>Locked</span>
              </div>
            )}
            {post?.language && post?.language !== 'en' && (
              <span className="bg-neutral-100 text-neutral-500 px-3 py-2 rounded-full border border-neutral-200">
                {post.language === 'si' ? 'සිංහල' : 'தமிழ்'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}
