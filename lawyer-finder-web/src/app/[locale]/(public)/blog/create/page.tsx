'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ImagePlus, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import RichTextEditor from '@/components/community/RichTextEditor';
import { toast } from 'sonner';

interface Community {
  id: string;
  name: string;
  displayName: string;
  icon: string | null;
}

export default function CreatePostPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState('en');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState<'en' | 'si' | 'ta'>('en');
  const [coverImage, setCoverImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const res = await fetch('/api/communities?limit=100');
        const data = await res.json();
        setCommunities(data.communities || []);

        // Pre-select community from URL param
        const communityParam = searchParams.get('community');
        if (communityParam && data.communities) {
          const found = data.communities.find((c: Community) => c.name === communityParam);
          if (found) setSelectedCommunity(found.id);
        }
      } catch {
        toast.error('Failed to load communities.');
      } finally {
        setLoadingCommunities(false);
      }
    };
    fetchCommunities();
  }, [searchParams]);

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
        } else {
          toast.error(data.error || 'Upload failed.');
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
    if (title.length < 5) {
      toast.error('Title must be at least 5 characters.');
      return;
    }
    if (content.length < 20) {
      toast.error('Content must be at least 20 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId: selectedCommunity,
          title: title.trim(),
          content: content.trim(),
          language,
          coverImage: coverImage || null,
          isAnonymous,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Post created!');
        router.push(`/${locale}/blog/${data.post.slug}`);
      } else {
        const errors = data.error;
        if (typeof errors === 'object') {
          const first = Object.values(errors).flat()[0];
          toast.error(first as string || 'Validation failed.');
        } else {
          toast.error(errors || 'Failed to create post.');
        }
      }
    } catch {
      toast.error('Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/${locale}/blog`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-6">Create Post</h1>

        <div className="space-y-6">
          {/* Community selector */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Community <span className="text-red-500">*</span>
            </label>
            {loadingCommunities ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading communities...
              </div>
            ) : (
              <select
                value={selectedCommunity}
                onChange={(e) => setSelectedCommunity(e.target.value)}
                className="w-full p-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select a community...</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon || '📋'} {c.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="An interesting, descriptive title..."
              className="w-full p-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={200}
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {title.length}/200
            </div>
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium mb-2">Cover Image (optional)</label>
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
                Click to upload a cover image
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
                  onClick={() => setLanguage(lang.key)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                    language === lang.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:border-primary/50'
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
              placeholder="Share your knowledge, experience, or question..."
              minHeight="350px"
              onImageUpload={handleContentImageUpload}
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {content.length} characters (minimum 20)
            </div>
          </div>

          {/* Anonymous Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 text-primary bg-background border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="isAnonymous" className="text-sm font-medium cursor-pointer">
              Post anonymously (hide my name from public view)
            </label>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-muted-foreground max-w-sm">
              By posting, you agree to our community guidelines. Posts may be reviewed before publishing.
            </p>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedCommunity || !title.trim() || content.length < 20}
              size="lg"
              className="gap-2 font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Publish Post
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
