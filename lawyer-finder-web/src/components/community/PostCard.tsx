'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const timeAgo = getTimeAgo(new Date(post.createdAt));

  const handleVote = async (type: 'UPVOTE' | 'DOWNVOTE') => {
    if (onVote) await onVote(post.id, type);
  };

  return (
    <Card className={`group transition-all duration-300 border border-[#efeae0] bg-white rounded-none hover:shadow-xl hover:border-[#bfa37a]/35 overflow-hidden ${post.isPinned ? 'border-[#bfa37a]/40 bg-[#faf8f6]/40' : ''}`}>
      <div className="flex">
        {/* Vote column */}
        <div className="hidden sm:flex flex-col items-center justify-start py-5 px-3.5 bg-[#faf8f6] border-r border-[#efeae0]/80">
          <VoteButtons
            score={post.score}
            userVote={post.userVote}
            onVote={handleVote}
            orientation="vertical"
            size="sm"
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-5 min-w-0 text-left">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-400 mb-2.5 font-light">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#bfa37a] border border-[#bfa37a]/30 bg-[#faf8f6] px-2 py-0.5">
                <Pin className="h-2.5 w-2.5" /> Pinned
              </span>
            )}
            {showCommunity && (
              <Link
                href={`/${locale}/blog/community/${post.community.name}`}
                className="font-bold text-neutral-600 hover:text-[#bfa37a] uppercase tracking-wider text-[10px] transition-colors"
              >
                {post.community.icon} {post.community.displayName}
              </Link>
            )}
            <span>•</span>
            <span className="flex items-center gap-1">
              Posted by{' '}
              <span className="font-semibold text-neutral-700">
                {post.author.profile?.fullName || post.author.fullName || 'Unknown User'}
              </span>
              {post.author.profile?.isVerified && (
                <ShieldCheck className="h-3.5 w-3.5 text-[#bfa37a]" />
              )}
              {post.author.role === 'LAWYER' && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#bfa37a] bg-[#bfa37a]/5 px-2 py-0.5 border border-[#bfa37a]/10">
                  Lawyer
                </span>
              )}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold uppercase tracking-widest text-[9px]">
              <Clock className="h-2.5 w-2.5" /> {timeAgo}
            </span>
          </div>

          {/* Title */}
          <Link href={`/${locale}/blog/${post.slug}`}>
            <h3 className="text-xl font-serif font-bold text-neutral-900 leading-snug group-hover:text-[#bfa37a] transition-colors line-clamp-2 mb-2">
              {post.title}
            </h3>
          </Link>

          {/* Rich Content + Cover */}
          <div className="flex flex-col md:flex-row gap-5 mt-3 mb-4">
            <div className="flex-1 min-w-0">
              {post.content && (
                <div className="relative">
                  <div 
                    className="prose prose-sm prose-neutral max-w-none text-neutral-500 leading-relaxed font-light tiptap-content max-h-[160px] overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                  {post.content.length > 250 && (
                    <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  )}
                </div>
              )}
              {post.content && post.content.length > 250 && (
                <Link href={`/${locale}/blog/${post.slug}`} className="text-[#bfa37a] hover:text-[#a68d67] text-xs font-bold uppercase tracking-wider hover:underline inline-flex mt-2">
                  Read more
                </Link>
              )}
            </div>
            {post.coverImage && (
              <div className="flex-shrink-0 mb-2 md:mb-0">
                <img
                  src={post.coverImage}
                  alt=""
                  className="w-full md:w-32 h-32 md:h-24 object-cover rounded-none border border-[#efeae0]"
                />
              </div>
            )}
          </div>

          {/* Actions bar */}
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-450">
            {/* Mobile vote */}
            <div className="sm:hidden">
              <VoteButtons
                score={post.score}
                userVote={post.userVote}
                onVote={handleVote}
                orientation="horizontal"
                size="sm"
              />
            </div>
            <Link
              href={`/${locale}/blog/${post.slug}#comments`}
              className="flex items-center gap-1.5 hover:text-[#bfa37a] transition-colors py-1.5 px-2.5 border border-transparent hover:border-[#efeae0] bg-neutral-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{post.commentCount} {post.commentCount === 1 ? 'Comment' : 'Comments'}</span>
            </Link>
            <div className="flex items-center gap-1.5 py-1.5 px-2.5 bg-neutral-50 border border-transparent">
              <Eye className="h-3.5 w-3.5" />
              <span>{formatCount(post.viewCount)}</span>
            </div>
            {post.isLocked && (
              <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1">
                <Lock className="h-3 w-3" />
                <span>Locked</span>
              </div>
            )}
            {post.language !== 'en' && (
              <span className="text-[9px] border border-neutral-200 px-2 py-1 font-bold text-neutral-500 bg-neutral-50 ml-auto shrink-0">
                {post.language === 'si' ? 'සිංහල' : 'தமிழ்'}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
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
