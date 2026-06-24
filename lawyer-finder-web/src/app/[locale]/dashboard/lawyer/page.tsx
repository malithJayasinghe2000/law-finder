'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Inbox, FileText, Star, ShieldCheck, AlertCircle, Eye, CreditCard, Zap, Crown, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

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
  const params = useParams();
  const locale = params.locale as string;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/lawyers/profile')
      .then((res) => res.json())
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/subscriptions/status')
      .then((res) => res.json())
      .then(setSubscriptionData)
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-10 space-y-6 max-w-5xl">
        <Skeleton className="h-8 w-64 rounded-none" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-none" />)}
        </div>
        <Skeleton className="h-64 rounded-none" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full rounded-none shadow-sm">
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

  const sub = subscriptionData?.subscription;

  return (
    <div className="p-6 lg:p-10 max-w-[2400px]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">Welcome, {profile.fullName}</h1>
          {profile.isVerified ? (
            <Badge className="gap-1 rounded-none bg-[#0a0a0a] text-white">
              <ShieldCheck className="h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-none text-amber-600 border-amber-300 bg-amber-50">
              Pending Verification
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">BASL: {profile.baslNumber}</p>
      </div>

      {/* Subscription Status Card */}
      <Card className={`rounded-none shadow-sm mb-6 border-l-4 ${
        sub?.status === 'ACTIVE' ? 'border-l-green-500' :
        sub?.status === 'CANCELED' ? 'border-l-amber-500' :
        sub?.status === 'EXPIRED' ? 'border-l-red-500' :
        sub?.status === 'PAST_DUE' ? 'border-l-blue-500' :
        'border-l-neutral-300'
      }`}>
        <CardContent className="p-5">
          {sub ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-none ${
                  sub.status === 'ACTIVE' ? 'bg-green-100' :
                  sub.status === 'CANCELED' ? 'bg-amber-100' :
                  sub.status === 'EXPIRED' ? 'bg-red-100' :
                  'bg-blue-100'
                }`}>
                  {sub.status === 'ACTIVE' ? <CheckCircle className="h-5 w-5 text-green-700" /> :
                   sub.status === 'CANCELED' ? <AlertTriangle className="h-5 w-5 text-amber-700" /> :
                   sub.status === 'EXPIRED' ? <XCircle className="h-5 w-5 text-red-700" /> :
                   <CreditCard className="h-5 w-5 text-blue-700" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{sub.planName}</p>
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      sub.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      sub.status === 'CANCELED' ? 'bg-amber-100 text-amber-800' :
                      sub.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sub.billingCycle} · {sub.daysRemaining != null ? `${sub.daysRemaining} days remaining` : ''}
                    {sub.endDate ? ` · Expires ${new Date(sub.endDate).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {sub.status === 'EXPIRED' && (
                  <Link href="/en/pricing">
                    <button className="text-xs font-bold uppercase tracking-wider bg-[#0a0a0a] text-white px-4 py-2 hover:bg-neutral-800 transition-colors">
                      Subscribe
                    </button>
                  </Link>
                )}
                {!sub || sub.status === 'PAST_DUE' ? (
                  <Link href="/en/pricing">
                    <button className="text-xs font-bold uppercase tracking-wider border border-neutral-200 px-4 py-2 hover:bg-neutral-50 transition-colors">
                      View Plans
                    </button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-none bg-neutral-100">
                  <CreditCard className="h-5 w-5 text-neutral-400" />
                </div>
                <div>
                  <p className="font-bold text-sm">No Active Subscription</p>
                  <p className="text-xs text-muted-foreground">Subscribe to unlock premium features</p>
                </div>
              </div>
              <Link href="/en/pricing">
                <button className="text-xs font-bold uppercase tracking-wider bg-[#0a0a0a] text-white px-4 py-2 hover:bg-neutral-800 transition-colors">
                  View Plans
                </button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <Card className="rounded-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-none bg-[#0a0a0a] text-white">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingInquiries}</p>
              <p className="text-xs text-muted-foreground font-medium">Pending Inquiries</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-none bg-[#0a0a0a] text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{publishedArticles}</p>
              <p className="text-xs text-muted-foreground font-medium">Published Articles</p>
              <Link href={`/${locale}/dashboard/blog/my-posts`} className="text-[10px] text-primary hover:underline mt-2 block font-semibold">
                Manage articles →
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-none bg-[#0a0a0a] text-white">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedReviews}</p>
              <p className="text-xs text-muted-foreground font-medium">Approved Reviews</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Inquiries */}
      <Card className="mb-6 rounded-none shadow-sm">
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
                <div key={inq.id} className="rounded-none border p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{inq.clientName}</span>
                        <Badge variant={inq.status === 'PENDING' ? 'outline' : 'secondary'} className="text-[10px] rounded-none px-2 uppercase tracking-wide">
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
      <Card className="rounded-none shadow-sm">
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
                  <Badge key={l} variant="secondary" className="text-[11px] rounded-none hover:bg-neutral-200">{l}</Badge>
                )) : <span className="text-muted-foreground">Not set</span>}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Practice Areas</p>
              <div className="flex flex-wrap gap-1">
                {profile.practiceAreas.length > 0 ? profile.practiceAreas.map((p) => (
                  <Badge key={p} variant="secondary" className="text-[11px] rounded-none hover:bg-neutral-200">{p}</Badge>
                )) : <span className="text-muted-foreground">Not set</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
