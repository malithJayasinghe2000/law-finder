'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Share2, Flag, Loader2, PenSquare, Trash2, ShieldAlert, Lock } from 'lucide-react';
import VoteButtons from '@/components/community/VoteButtons';
import CommentThread from '@/components/community/CommentThread';
import TranslationBadge from '@/components/community/TranslationBadge';
import ReportDialog from '@/components/community/ReportDialog';
import { toast } from 'sonner';
import Link from 'next/link';
import { SidebarAd } from '@/components/ads/AdComponents';

interface PostData {
  id: string;
  content: string;
  language: string;
  score: number;
  isLocked: boolean;
  commentCount: number;
  authorId: string;
  communityName: string;
}

interface Translation {
  id: string;
  locale: string;
  title: string;
  content: string;
  excerpt: string | null;
  isAuto: boolean;
}

interface PostInteractionsProps {
  post: PostData;
  userVote: 'UPVOTE' | 'DOWNVOTE' | null;
  currentUserId: string | null;
  currentUserRole: string | null;
  locale: string;
  translations: Translation[];
}

export default function PostInteractions({
  post,
  userVote,
  currentUserId,
  currentUserRole,
  locale,
  translations,
}: PostInteractionsProps) {
  const router = useRouter();
  const [displayContent, setDisplayContent] = useState(post.content);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationData, setTranslationData] = useState<{ content: string; isAuto: boolean } | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ postId?: string; commentId?: string }>({});

  const needsTranslation = post.language !== locale && post.language !== 'en';

  // Load comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?postId=${post.id}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  }, [post.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Check for cached translation
  useEffect(() => {
    if (needsTranslation) {
      const cached = translations.find((t) => t.locale === locale);
      if (cached) {
        setTranslationData({ content: cached.content, isAuto: cached.isAuto });
      }
    }
  }, [needsTranslation, translations, locale]);

  const handleTranslationToggle = async () => {
    if (showTranslation) {
      setDisplayContent(post.content);
      setShowTranslation(false);
      return;
    }

    if (translationData) {
      setDisplayContent(translationData.content);
      setShowTranslation(true);
      return;
    }

    // Fetch translation
    setTranslationLoading(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/translate?locale=${locale}`);
      const data = await res.json();
      if (data.content) {
        setTranslationData({ content: data.content, isAuto: data.isAuto });
        setDisplayContent(data.content);
        setShowTranslation(true);
      }
    } catch {
      toast.error('Translation failed. Showing original content.');
    } finally {
      setTranslationLoading(false);
    }
  };

  const handleVote = async (type: 'UPVOTE' | 'DOWNVOTE') => {
    if (!currentUserId) {
      toast.error('Please sign in to vote.');
      return;
    }
    const res = await fetch(`/api/posts/${post.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) throw new Error('Vote failed');
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || !currentUserId) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          postId: post.id, 
          content: commentText.trim(), 
          language: locale,
          isAnonymous: commentAnonymous,
        }),
      });
      if (res.ok) {
        setCommentText('');
        setCommentAnonymous(false);
        fetchComments(); // Refresh comments
        toast.success('Comment posted!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to post comment.');
      }
    } catch {
      toast.error('Failed to post comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCommentReply = async (parentId: string, content: string, isAnonymous: boolean) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id, content, parentId, language: locale, isAnonymous }),
    });
    if (res.ok) {
      fetchComments();
      toast.success('Reply posted!');
    } else {
      toast.error('Failed to post reply.');
      throw new Error('Failed');
    }
  };
 
  const handleCommentEdit = async (commentId: string, content: string) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      fetchComments();
      toast.success('Comment updated!');
    } else {
      toast.error('Failed to update comment.');
      throw new Error('Failed');
    }
  };

  const handlePostDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Post deleted.');
      router.push(`/${locale}/blog`);
    } else {
      toast.error('Failed to delete post.');
    }
  };

  const handleCommentVote = async (commentId: string, type: 'UPVOTE' | 'DOWNVOTE') => {
    if (!currentUserId) {
      toast.error('Please sign in to vote.');
      return;
    }
    await fetch(`/api/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchComments();
      toast.success('Comment deleted.');
    }
  };

  const handleReport = async (reason: string, description?: string) => {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, description, ...reportTarget }),
    });
    if (res.ok) {
      toast.success('Report submitted. Thank you.');
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to submit report.');
      throw new Error('Failed');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  return (
    <div>
      {/* Translation notice */}
      {/* {(needsTranslation || showTranslation) && (
        <div className="mb-4">
          {translationLoading ? (
            <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Translating...
            </div>
          ) : (
            <TranslationBadge
              sourceLanguage={post.language}
              isAuto={translationData?.isAuto ?? true}
              isShowingTranslation={showTranslation}
              onToggle={handleTranslationToggle}
            />
          )}
        </div>
      )} */}

      {/* Post content */}
      {(currentUserId === post.authorId || currentUserRole === 'ADMIN') && (
        <div className="mb-6 p-4 bg-muted/30 border-2 border-dashed rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span>You have management access to this post</span>
          </div>
          <div className="flex gap-2">
            <Link href={`/${locale}/blog/edit/${post.id}`}>
              <Button size="sm" variant="outline" className="gap-2">
                <PenSquare className="h-4 w-4" /> Edit
              </Button>
            </Link>
            <Button size="sm" variant="ghost" className="gap-2 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={handlePostDelete}>
                <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      )}

      <div 
        className="prose prose-neutral max-w-none text-foreground leading-relaxed mb-6 tiptap-content"
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />

      {/* Mobile Inline Ads (Only shows on mobile, hidden on desktop since they appear in the real sidebar there) */}
      <div className="block lg:hidden my-8">
        <SidebarAd 
          placement="BLOG_SIDEBAR" 
          locale={locale} 
          practiceArea={post.communityName} 
        />
      </div>

      {/* Engagement bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 py-3 border-y">
        <VoteButtons
          score={post.score}
          userVote={userVote}
          onVote={handleVote}
          orientation="horizontal"
          size="md"
        />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <a
          href="#comments"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount} Comments
        </a>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        {currentUserId && currentUserId !== post.authorId && (
          <button
            onClick={() => { setReportTarget({ postId: post.id }); setReportOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-auto"
          >
            <Flag className="h-4 w-4" /> Report
          </button>
        )}
      </div>

      {/* Comment Section */}
      <div id="comments" className="pt-8">
        <h2 className="text-lg font-semibold mb-4">
          Comments ({post.commentCount})
        </h2>

        {/* Comment composer */}
        {currentUserId ? (
          !post.isLocked ? (
            <div className="mb-6">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share your thoughts..."
                className="w-full p-4 text-sm border rounded-xl bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]"
                rows={4}
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-2 gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  <input
                    type="checkbox"
                    checked={commentAnonymous}
                    onChange={(e) => setCommentAnonymous(e.target.checked)}
                    className="rounded border-muted text-primary focus:ring-primary/50"
                  />
                  Post anonymously
                </label>
                <Button
                  onClick={handleCommentSubmit}
                  disabled={!commentText.trim() || commentSubmitting}
                  className="font-semibold"
                >
                  {commentSubmitting ? 'Posting...' : 'Post Comment'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-[#faf8f6] border border-[#efeae0] rounded-none text-xs font-bold uppercase tracking-widest text-neutral-450 flex items-center justify-center gap-2">
              <Lock className="h-4 w-4 text-[#bfa37a]" /> Comments are locked on this post
            </div>
          )
        ) : (
          <div className="mb-6 p-4 bg-[#faf8f6] border border-[#efeae0] rounded-none text-xs font-bold uppercase tracking-widest text-center text-neutral-400">
            <span>Sign in to join the discussion. </span>
            <a href={`/${locale}/login`} className="text-[#bfa37a] hover:text-[#a68d67] hover:underline ml-1.5 transition-colors">
              Sign In
            </a>
          </div>
        )}

        {/* Comments list */}
        {commentsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          <CommentThread
            comments={comments}
            postId={post.id}
            isLocked={post.isLocked}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            locale={locale}
            onReply={handleCommentReply}
            onEdit={handleCommentEdit}
            onVote={handleCommentVote}
            onDelete={handleCommentDelete}
            onReport={(commentId) => { setReportTarget({ commentId }); setReportOpen(true); }}
          />
        )}
      </div>

      {/* Report dialog */}
      <ReportDialog
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReport}
        contentType={reportTarget.commentId ? 'comment' : 'post'}
      />
    </div>
  );
}
