'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Share2, Flag, Loader2 } from 'lucide-react';
import VoteButtons from '@/components/community/VoteButtons';
import CommentThread from '@/components/community/CommentThread';
import TranslationBadge from '@/components/community/TranslationBadge';
import ReportDialog from '@/components/community/ReportDialog';
import { toast } from 'sonner';

interface PostData {
  id: string;
  content: string;
  language: string;
  score: number;
  isLocked: boolean;
  commentCount: number;
  authorId: string;
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
  const [displayContent, setDisplayContent] = useState(post.content);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationData, setTranslationData] = useState<{ content: string; isAuto: boolean } | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
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
        body: JSON.stringify({ postId: post.id, content: commentText.trim(), language: locale }),
      });
      if (res.ok) {
        setCommentText('');
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

  const handleCommentReply = async (parentId: string, content: string) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id, content, parentId, language: locale }),
    });
    if (res.ok) {
      fetchComments();
      toast.success('Reply posted!');
    } else {
      toast.error('Failed to post reply.');
      throw new Error('Failed');
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
      {(needsTranslation || showTranslation) && (
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
      )}

      {/* Post content */}
      <div className="prose prose-neutral max-w-none text-foreground leading-relaxed mb-6">
        {displayContent.split('\n').map((paragraph, i) => {
          if (!paragraph.trim()) return <br key={i} />;
          if (paragraph.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{paragraph.slice(3)}</h2>;
          if (paragraph.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{paragraph.slice(4)}</h3>;
          if (paragraph.startsWith('- ')) return <li key={i} className="ml-4 text-muted-foreground">{paragraph.slice(2)}</li>;
          if (paragraph.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground">{paragraph.slice(2)}</blockquote>;
          return <p key={i} className="mb-3 text-muted-foreground">{paragraph}</p>;
        })}
      </div>

      {/* Engagement bar */}
      <div className="flex items-center gap-2 py-3 border-y">
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
              <div className="flex justify-end mt-2">
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
            <div className="mb-6 p-4 bg-muted/50 rounded-xl text-sm text-muted-foreground text-center">
              🔒 Comments are locked on this post.
            </div>
          )
        ) : (
          <div className="mb-6 p-4 bg-muted/50 rounded-xl text-sm text-center">
            <span className="text-muted-foreground">Sign in to join the discussion. </span>
            <a href={`/${locale}/login`} className="text-primary font-semibold hover:underline">
              Sign In →
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
