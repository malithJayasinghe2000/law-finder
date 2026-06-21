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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#efeae0] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight font-serif text-neutral-900">Welcome, {profile.fullName}</h1>
            {profile.isVerified ? (
              <Badge className="gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-250 py-1 px-3 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Partner
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full text-amber-600 border-amber-300 bg-amber-50/50 py-1 px-3 text-xs font-semibold gap-1.5">
                Pending Verification
              </Badge>
            )}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#bfa37a]">BASL: {profile.baslNumber}</p>
        </div>
      </div>

      {/* Subscription Status Card */}
      <Card className={`rounded-2xl border border-[#efeae0] bg-[#fdfbf7] shadow-sm overflow-hidden border-l-4 ${
        sub?.status === 'ACTIVE' ? 'border-l-emerald-500' :
        sub?.status === 'CANCELED' ? 'border-l-amber-500' :
        sub?.status === 'EXPIRED' ? 'border-l-red-500' :
        sub?.status === 'PAST_DUE' ? 'border-l-blue-500' :
        'border-l-neutral-300'
      }`}>
        <CardContent className="p-6">
          {sub ? (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                  sub.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  sub.status === 'CANCELED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  sub.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {sub.status === 'ACTIVE' ? <CheckCircle className="h-5 w-5" /> :
                   sub.status === 'CANCELED' ? <AlertTriangle className="h-5 w-5" /> :
                   sub.status === 'EXPIRED' ? <XCircle className="h-5 w-5" /> :
                   <CreditCard className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <p className="font-serif font-bold text-base text-neutral-900">{sub.planName}</p>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      sub.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      sub.status === 'CANCELED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      sub.status === 'EXPIRED' ? 'bg-red-100 text-red-800 border border-red-200' :
                      'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {sub.billingCycle} billing · {sub.daysRemaining != null ? `${sub.daysRemaining} days remaining` : ''}
                    {sub.endDate ? ` · Next renewal on ${new Date(sub.endDate).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {sub.status === 'EXPIRED' && (
                  <Link href="/en/pricing">
                    <button className="text-[10px] font-bold uppercase tracking-widest bg-[#bfa37a] hover:bg-[#a68d67] text-white px-5 py-3 rounded-full transition-all duration-300 shadow-sm hover:shadow-md">
                      Subscribe
                    </button>
                  </Link>
                )}
                {!sub || sub.status === 'PAST_DUE' ? (
                  <Link href="/en/pricing">
                    <button className="text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-neutral-50 text-neutral-700 border border-[#efeae0] px-5 py-3 rounded-full transition-all duration-300 shadow-sm hover:shadow-md">
                      View Plans
                    </button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-50 border border-[#efeae0] text-neutral-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-serif font-bold text-base text-neutral-900">No Active Subscription</p>
                  <p className="text-xs text-neutral-500 mt-1">Subscribe to unlock premium features and lists</p>
                </div>
              </div>
              <Link href="/en/pricing">
                <button className="text-[10px] font-bold uppercase tracking-widest bg-[#bfa37a] hover:bg-[#a68d67] text-white px-5 py-3 rounded-full transition-all duration-300 shadow-sm hover:shadow-md">
                  View Plans
                </button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
 
        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card className="rounded-2xl border border-[#efeae0] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-md transition-all duration-300">
            <CardContent className="flex items-center gap-4 p-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a]">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <p className="text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">{pendingInquiries}</p>
                <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1">Pending Inquiries</p>
              </div>
            </CardContent>
          </Card>
 
          <Card className="rounded-2xl border border-[#efeae0] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-md transition-all duration-300">
            <CardContent className="flex items-center gap-4 p-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">{publishedArticles}</p>
                <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1">Published Articles</p>
                <Link href={`/${locale}/blog/my-posts`} className="text-[9px] text-[#bfa37a] hover:text-[#a68d67] font-bold uppercase tracking-widest transition-colors mt-2.5 block">
                  Manage articles &rarr;
                </Link>
              </div>
            </CardContent>
          </Card>
 
          <Card className="rounded-2xl border border-[#efeae0] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-md transition-all duration-300">
            <CardContent className="flex items-center gap-4 p-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a]">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">{approvedReviews}</p>
                <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1">Approved Reviews</p>
              </div>
            </CardContent>
          </Card>
        </div>
 
        {/* Recent Inquiries */}
        <Card className="rounded-2xl border border-[#efeae0] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <h2 className="text-base font-bold uppercase tracking-widest text-neutral-800 mb-6 flex items-center gap-2 font-serif border-b border-[#efeae0] pb-4">
              <Inbox className="h-4.5 w-4.5 text-[#bfa37a]" />
              Recent Inquiries
            </h2>
            {profile.inquiries.length === 0 ? (
              <p className="text-sm text-neutral-400 py-12 text-center font-light">No inquiries received yet.</p>
            ) : (
              <div className="space-y-4">
                {profile.inquiries.slice(0, 5).map((inq) => (
                  <div key={inq.id} className="rounded-xl border border-[#efeae0]/60 bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] hover:border-[#bfa37a]/30 hover:shadow-md transition-all duration-300">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-serif font-bold text-[14px] text-neutral-950">{inq.clientName}</span>
                          <Badge variant={inq.status === 'PENDING' ? 'outline' : 'secondary'} className={`text-[9px] rounded-full px-2 py-0.5 uppercase tracking-wider ${
                            inq.status === 'PENDING' 
                              ? 'text-amber-600 bg-amber-50/50 border-amber-200' 
                              : 'text-neutral-500 bg-neutral-100 border-neutral-200'
                          }`}>
                            {inq.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#bfa37a] font-medium mb-2">{inq.clientEmail}</p>
                        <p className="text-xs text-neutral-600 font-light leading-relaxed text-balance">{inq.message}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
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
        <Card className="rounded-2xl border border-[#efeae0] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <h2 className="text-base font-bold uppercase tracking-widest text-neutral-800 mb-6 flex items-center gap-2 font-serif border-b border-[#efeae0] pb-4">
              <Eye className="h-4.5 w-4.5 text-[#bfa37a]" />
              Profile Summary
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
              <div className="border border-[#efeae0]/40 p-4 rounded-xl">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-1.5">District</p>
                <p className="font-serif font-bold text-neutral-900 text-[14px]">{profile.district || 'Not set'}</p>
              </div>
              <div className="border border-[#efeae0]/40 p-4 rounded-xl">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-1.5">Fee Range</p>
                <p className="font-serif font-bold text-neutral-900 text-[14px]">{profile.baseFeeRange || 'Not set'}</p>
              </div>
              <div className="border border-[#efeae0]/40 p-4 rounded-xl">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-2.5">Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.languages.length > 0 ? profile.languages.map((l) => (
                    <Badge key={l} variant="secondary" className="text-[9px] rounded-full bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] px-2.5 py-0.5 hover:bg-[#bfa37a]/10 font-bold uppercase tracking-wider transition-colors">{l}</Badge>
                  )) : <span className="text-neutral-400 text-xs font-light">Not set</span>}
                </div>
              </div>
              <div className="border border-[#efeae0]/40 p-4 rounded-xl">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-2.5">Practice Areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.practiceAreas.length > 0 ? profile.practiceAreas.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[9px] rounded-full bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a] px-2.5 py-0.5 hover:bg-[#bfa37a]/10 font-bold uppercase tracking-wider transition-colors">{p}</Badge>
                  )) : <span className="text-neutral-400 text-xs font-light">Not set</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
