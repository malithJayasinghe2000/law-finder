'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Clock, Reply, MoreHorizontal, Flag, Trash2, Edit } from 'lucide-react';
import VoteButtons from './VoteButtons';
import { LawyerWritingReminder } from '@/components/community/CommunityNotice';

interface Author {
  id: string;
  fullName: string | null;
  profileImageUrl: string | null;
  role: string;
  profile?: { isVerified: boolean; fullName?: string | null } | null;
}

interface CommentData {
  id: string;
  content: string;
  language: string;
  isDeleted: boolean;
  score: number;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt: string;
  userVote: 'UPVOTE' | 'DOWNVOTE' | null;
  author: Author;
  replyCount: number;
  replies?: CommentData[];
}

interface CommentThreadProps {
  comments: CommentData[];
  postId: string;
  isLocked: boolean;
  currentUserId?: string | null;
  currentUserRole?: string | null;
  locale: string;
  onReply: (parentId: string, content: string, isAnonymous: boolean) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onVote: (commentId: string, type: 'UPVOTE' | 'DOWNVOTE') => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReport: (commentId: string) => void;
  depth?: number;
}

export default function CommentThread({
  comments,
  postId,
  isLocked,
  currentUserId,
  currentUserRole,
  locale,
  onReply,
  onEdit,
  onVote,
  onDelete,
  onReport,
  depth = 0,
}: CommentThreadProps) {
  return (
    <div className={depth > 0 ? 'ml-4 sm:ml-8 pl-4 border-l-2 border-muted' : ''}>
      {comments.map((comment) => (
        <SingleComment
          key={comment.id}
          comment={comment}
          postId={postId}
          isLocked={isLocked}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          locale={locale}
          onReply={onReply}
          onEdit={onEdit}
          onVote={onVote}
          onDelete={onDelete}
          onReport={onReport}
          depth={depth}
        />
      ))}
    </div>
  );
}

function SingleComment({
  comment,
  postId,
  isLocked,
  currentUserId,
  currentUserRole,
  locale,
  onReply,
  onEdit,
  onVote,
  onDelete,
  onReport,
  depth,
}: {
  comment: CommentData;
  postId: string;
  isLocked: boolean;
  currentUserId?: string | null;
  currentUserRole?: string | null;
  locale: string;
  onReply: (parentId: string, content: string, isAnonymous: boolean) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onVote: (commentId: string, type: 'UPVOTE' | 'DOWNVOTE') => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReport: (commentId: string) => void;
  depth: number;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [submitting, setSubmitting] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const isAuthor = currentUserId === comment.author.id;
  const isAdmin = currentUserRole === 'ADMIN';
  const timeAgo = getTimeAgo(new Date(comment.createdAt));

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, replyContent.trim(), isAnonymous);
      setReplyContent('');
      setShowReply(false);
      setIsAnonymous(false);
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleSaveEdit = async () => {
    if (!editedContent.trim() || editedContent === comment.content) {
      setIsEditing(false);
      return;
    }
    setSubmitting(true);
    try {
      await onEdit(comment.id, editedContent.trim());
      setIsEditing(false);
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  if (comment.isDeleted) {
    return (
      <div className="py-3 text-sm text-muted-foreground italic">
        [comment deleted]
        {comment.replies && comment.replies.length > 0 && (
          <CommentThread
            comments={comment.replies}
            postId={postId}
            isLocked={isLocked}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            locale={locale}
            onReply={onReply}
            onEdit={onEdit}
            onVote={onVote}
            onDelete={onDelete}
            onReport={onReport}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  return (
    <div className="py-3">
      {/* Comment header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">
          {comment.author.profileImageUrl ? (
            <img src={comment.author.profileImageUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            (comment.author.fullName || '?').charAt(0).toUpperCase()
          )}
        </div>
        <span className="font-semibold text-foreground">
          {comment.author.profile?.fullName || comment.author.fullName || 'Community member'}
        </span>
        {comment.author.profile?.isVerified && (
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        )}
        {comment.author.role === 'LAWYER' && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0">Lawyer</Badge>
        )}
        <span>•</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {timeAgo}
          {new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 2000 && (
            <span className="text-[10px] bg-muted px-1 rounded-sm text-muted-foreground ml-1">
              (edited)
            </span>
          )}
        </span>
      </div>

      {/* Comment body */}
      {isEditing ? (
        <div className="mt-2 mb-3">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full p-3 text-sm border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleSaveEdit} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditedContent(comment.content); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap mb-2">
          {comment.content}
        </div>
      )}

      {/* Comment actions */}
      <div className="flex items-center gap-1 text-xs">
        <VoteButtons
          score={comment.score}
          userVote={comment.userVote}
          onVote={(type) => onVote(comment.id, type)}
          orientation="horizontal"
          size="sm"
        />

        {!isLocked && currentUserId && depth < 4 && (
          <button
            onClick={() => setShowReply(!showReply)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Reply className="h-3.5 w-3.5" /> Reply
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showActions && (
            <div className="absolute right-0 top-8 z-20 bg-background border rounded-lg shadow-lg py-1 min-w-[140px]">
              {currentUserId && !isAuthor && (
                <button
                  onClick={() => { onReport(comment.id); setShowActions(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Flag className="h-3.5 w-3.5" /> Report
                </button>
              )}
              {isAuthor && (
                <button
                  onClick={() => { setIsEditing(true); setShowActions(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              {(isAuthor || isAdmin) && (
                <button
                  onClick={() => { onDelete(comment.id); setShowActions(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply composer */}
      {showReply && (
        <div className="mt-3 ml-2">
          <LawyerWritingReminder role={currentUserRole ?? null} className="mb-2" />
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="w-full p-3 text-sm border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]"
            rows={3}
          />
          <div className="flex items-center justify-between gap-2 mt-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-muted text-primary focus:ring-primary/50"
              />
              Post anonymously
            </label>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowReply(false); setReplyContent(''); setIsAnonymous(false); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitReply}
                disabled={!replyContent.trim() || submitting}
              >
                {submitting ? 'Posting...' : 'Reply'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <CommentThread
          comments={comment.replies}
          postId={postId}
          isLocked={isLocked}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          locale={locale}
          onReply={onReply}
          onEdit={onEdit}
          onVote={onVote}
          onDelete={onDelete}
          onReport={onReport}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (hrs < 24) return `${hrs}h`;
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
