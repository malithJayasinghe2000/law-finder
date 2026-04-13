'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ImagePlus, Loader2, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import RichTextEditor from '@/components/community/RichTextEditor';
import { toast } from 'sonner';

interface Community {
  id: string;
  name: string;
  displayName: string;
  icon: string | null;
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const locale = params.locale as string;

  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState<'en' | 'si' | 'ta'>('en');
  const [coverImage, setCoverImage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [slug, setSlug] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch communities
        const commRes = await fetch('/api/communities?limit=100');
        const commData = await commRes.json();
        setCommunities(commData.communities || []);

        // Fetch post data
        const postRes = await fetch(`/api/posts/${id}`);
        const postData = await postRes.json();
        
        if (postRes.ok && postData.post) {
          const post = postData.post;
          setTitle(post.title);
          setContent(post.content);
          setSelectedCommunity(post.communityId);
          setLanguage(post.language);
          setCoverImage(post.coverImage || '');
          setIsAnonymous(post.isAnonymous || false);
          setSlug(post.slug);
        } else {
          toast.error('Failed to load post data.');
          router.push(`/${locale}/blog`);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('An error occurred while loading.');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, locale, router]);

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5MB.');
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          setCoverImage(data.url);
          toast.success('Cover image uploaded!');
        }
      } catch {
        toast.error('Upload failed.');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleContentImageUpload = async (insertImage: (url: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          insertImage(data.url);
          toast.success('Image inserted!');
        }
      } catch {
        toast.error('Upload failed.');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleSubmit = async () => {
    if (!selectedCommunity || !title.trim() || !content.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          language,
          coverImage: coverImage || null,
          status: 'PUBLISHED', // Reset to published if edited
        }),
      });

      if (res.ok) {
        toast.success('Post updated!');
        router.push(`/${locale}/blog/${slug}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update post.');
      }
    } catch {
      toast.error('Failed to update post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Post deleted.');
        router.push(`/${locale}/blog`);
      } else {
        toast.error('Failed to delete post.');
      }
    } catch {
      toast.error('Error deleting post.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading post data...</p>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/${locale}/blog/${slug}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-red-500 hover:bg-red-50 hover:text-red-600 font-semibold"
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Delete Post
          </Button>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-6">Edit Post</h1>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              className="w-full p-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={200}
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium mb-2">Cover Image</label>
            {coverImage ? (
              <div className="relative rounded-lg overflow-hidden border">
                <img src={coverImage} alt="" className="w-full h-48 object-cover" />
                <button
                  onClick={() => setCoverImage('')}
                  className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-md text-xs hover:bg-black/80"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={handleImageUpload}
                disabled={uploading}
                className="flex items-center gap-2 p-4 w-full border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
                Update cover image
              </button>
            )}
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium mb-2">Content Language</label>
            <div className="flex gap-2">
              {[
                { key: 'en' as const, label: 'English' },
                { key: 'si' as const, label: 'සිංහල' },
                { key: 'ta' as const, label: 'தமிழ்' },
              ].map((lang) => (
                <button
                  key={lang.key}
                  disabled // Disable language change on edit for stability
                  className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                    language === lang.key
                      ? 'bg-primary/10 text-primary border-primary'
                      : 'text-muted-foreground opacity-50'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Editor */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Content <span className="text-red-500">*</span>
            </label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Edit your post content..."
              minHeight="400px"
              onImageUpload={handleContentImageUpload}
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-6 border-t">
            <p className="text-xs text-muted-foreground">
              Last saved: {new Date().toLocaleTimeString()}
            </p>
            <div className="flex gap-3">
               <Link href={`/${locale}/blog/${slug}`}>
                <Button variant="outline">Cancel</Button>
               </Link>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || content.length < 20}
                className="gap-2 font-semibold min-w-[140px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
