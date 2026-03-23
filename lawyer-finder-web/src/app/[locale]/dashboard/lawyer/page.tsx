'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Inbox, FileText, Star, ShieldCheck, AlertCircle, Eye } from 'lucide-react';

interface ProfileData {
  id: string;
  fullName: string;
  baslNumber: string;
  isVerified: boolean;
  practiceAreas: string[];
  languages: string[];
  district: string | null;
  bio: string | null;
  baseFeeRange: string | null;
  inquiries: { id: string; clientName: string; clientEmail: string; message: string; status: string; createdAt: string }[];
  articles: { id: string; title: string; status: string; createdAt: string }[];
  reviews: { id: string; reviewerName: string; rating: number; comment: string; isApproved: boolean }[];
}

export default function LawyerDashboard() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/lawyers/profile')
      .then((res) => res.json())
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-10 space-y-6 max-w-5xl">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">Profile Not Found</h2>
            <p className="text-sm text-muted-foreground">
              Your lawyer profile has not been set up yet. Please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingInquiries = profile.inquiries.filter((i) => i.status === 'PENDING').length;
  const publishedArticles = profile.articles.filter((a) => a.status === 'PUBLISHED').length;
  const approvedReviews = profile.reviews.filter((r) => r.isApproved).length;

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">Welcome, {profile.fullName}</h1>
          {profile.isVerified ? (
            <Badge className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              Pending Verification
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">BASL: {profile.baslNumber}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/5 text-primary">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingInquiries}</p>
              <p className="text-xs text-muted-foreground">Pending Inquiries</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/5 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{publishedArticles}</p>
              <p className="text-xs text-muted-foreground">Published Articles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/5 text-primary">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedReviews}</p>
              <p className="text-xs text-muted-foreground">Approved Reviews</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Inquiries */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Recent Inquiries
          </h2>
          {profile.inquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No inquiries received yet.</p>
          ) : (
            <div className="space-y-3">
              {profile.inquiries.slice(0, 5).map((inq) => (
                <div key={inq.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{inq.clientName}</span>
                        <Badge variant={inq.status === 'PENDING' ? 'outline' : 'secondary'} className="text-xs">
                          {inq.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{inq.clientEmail}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{inq.message}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(inq.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Preview */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Profile Summary
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">District</p>
              <p className="font-medium">{profile.district || 'Not set'}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Fee Range</p>
              <p className="font-medium">{profile.baseFeeRange || 'Not set'}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Languages</p>
              <div className="flex flex-wrap gap-1">
                {profile.languages.length > 0 ? profile.languages.map((l) => (
                  <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                )) : <span className="text-muted-foreground">Not set</span>}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Practice Areas</p>
              <div className="flex flex-wrap gap-1">
                {profile.practiceAreas.length > 0 ? profile.practiceAreas.map((p) => (
                  <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                )) : <span className="text-muted-foreground">Not set</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
