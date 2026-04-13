'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PenSquare, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface PostActionButtonsProps {
  postId: string;
  locale: string;
}

export default function PostActionButtons({ postId, locale }: PostActionButtonsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Post deleted successfully');
        router.refresh(); // Refresh the server component page
      } else {
        toast.error('Failed to delete post');
      }
    } catch (error) {
      toast.error('An error occurred while deleting the post');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={`/${locale}/blog/edit/${postId}`}>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-semibold">
          <PenSquare className="h-3.5 w-3.5" /> Edit
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        disabled={deleting}
        onClick={handleDelete}
        className="h-8 gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50"
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Delete
      </Button>
    </div>
  );
}
