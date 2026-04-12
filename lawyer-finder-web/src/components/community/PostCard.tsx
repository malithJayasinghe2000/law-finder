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
    <Card className={`group transition-all duration-200 hover:shadow-md hover:border-primary/20 overflow-hidden ${post.isPinned ? 'border-primary/30 bg-primary/[0.02]' : ''}`}>
      <div className="flex">
        {/* Vote column */}
        <div className="hidden sm:flex flex-col items-center justify-start py-4 px-3 bg-muted/30">
          <VoteButtons
            score={post.score}
            userVote={post.userVote}
            onVote={handleVote}
            orientation="vertical"
            size="sm"
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-2">
            {post.isPinned && (
              <Badge variant="outline" className="gap-1 text-primary border-primary/30 px-1.5 py-0">
                <Pin className="h-3 w-3" /> Pinned
              </Badge>
            )}
            {showCommunity && (
              <Link
                href={`/${locale}/blog/community/${post.community.name}`}
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                {post.community.icon} {post.community.displayName}
              </Link>
            )}
            <span>•</span>
            <span className="flex items-center gap-1">
              Posted by{' '}
              <span className="font-medium text-foreground/80">
                {post.author.profile?.fullName || post.author.fullName || 'Unknown User'}
              </span>
              {post.author.profile?.isVerified && (
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              )}
              {post.author.role === 'LAWYER' && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">
                  Lawyer
                </Badge>
              )}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {timeAgo}
            </span>
          </div>

          {/* Title */}
          <Link href={`/${locale}/blog/${post.slug}`}>
            <h3 className="text-lg font-semibold tracking-tight group-hover:text-primary transition-colors line-clamp-2 mb-1">
              {post.title}
            </h3>
          </Link>

          {/* Excerpt + Cover */}
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              {post.excerpt && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {post.excerpt}
                </p>
              )}
            </div>
            {post.coverImage && (
              <div className="hidden md:block flex-shrink-0">
                <img
                  src={post.coverImage}
                  alt=""
                  className="w-28 h-20 object-cover rounded-md"
                />
              </div>
            )}
          </div>

          {/* Actions bar */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
              className="flex items-center gap-1.5 hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{post.commentCount} {post.commentCount === 1 ? 'Comment' : 'Comments'}</span>
            </Link>
            <div className="flex items-center gap-1.5 py-1 px-2">
              <Eye className="h-4 w-4" />
              <span>{formatCount(post.viewCount)}</span>
            </div>
            {post.isLocked && (
              <div className="flex items-center gap-1 text-amber-500">
                <Lock className="h-3.5 w-3.5" />
                <span>Locked</span>
              </div>
            )}
            {post.language !== 'en' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {post.language === 'si' ? 'සිංහල' : 'தமிழ்'}
              </Badge>
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
