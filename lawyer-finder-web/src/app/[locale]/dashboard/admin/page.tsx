'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Shield, Users, Inbox, FileText, Star,
  CheckCircle2, XCircle, Loader2, LayoutDashboard,
} from 'lucide-react';

interface AdminData {
  pendingLawyers: {
    id: string;
    fullName: string;
    baslNumber: string;
    user: { email: string; createdAt: string };
  }[];
  pendingReviews: {
    id: string;
    reviewerName: string;
    rating: number;
    comment: string;
    lawyer: { fullName: string };
  }[];
  stats: {
    totalVerified: number;
    pendingApprovals: number;
    totalInquiries: number;
    totalArticles: number;
    pendingReviewCount: number;
  };
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = () => {
    fetch('/api/admin')
      .then((res) => res.json())
      .then(setData)
      .catch(() => toast.error('Failed to load admin data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (action: string, id: string, label: string) => {
    setActionLoading(`${action}-${id}`);
    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(result.message || `${label} successful.`);
      fetchData();
    } catch {
      toast.error(`Failed to ${label.toLowerCase()}.`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 space-y-6 max-w-6xl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const statCards = [
    { label: 'Verified Lawyers', value: data.stats.totalVerified, icon: Shield, color: 'text-primary' },
    { label: 'Pending Approvals', value: data.stats.pendingApprovals, icon: Users, color: 'text-amber-600' },
    { label: 'Total Inquiries', value: data.stats.totalInquiries, icon: Inbox, color: 'text-primary' },
    { label: 'Published Articles', value: data.stats.totalArticles, icon: FileText, color: 'text-primary' },
    { label: 'Pending Reviews', value: data.stats.pendingReviewCount, icon: Star, color: 'text-amber-600' },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage lawyers, reviews, and platform data</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Lawyers */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Lawyers Pending Verification
            {data.pendingLawyers.length > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                {data.pendingLawyers.length}
              </Badge>
            )}
          </h2>

          {data.pendingLawyers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              All lawyers are verified. No pending approvals.
            </p>
          ) : (
            <div className="space-y-3">
              {data.pendingLawyers.map((lawyer) => (
                <div key={lawyer.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{lawyer.fullName}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>BASL: {lawyer.baslNumber}</span>
                      <span>{lawyer.user.email}</span>
                      <span>
                        Joined {new Date(lawyer.user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAction('verify-lawyer', lawyer.id, 'Verify')}
                      disabled={actionLoading === `verify-lawyer-${lawyer.id}`}
                      className="gap-1"
                    >
                      {actionLoading === `verify-lawyer-${lawyer.id}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction('reject-lawyer', lawyer.id, 'Reject')}
                      disabled={actionLoading === `reject-lawyer-${lawyer.id}`}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      {actionLoading === `reject-lawyer-${lawyer.id}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Reviews */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="h-4 w-4" />
            Reviews Pending Approval
            {data.pendingReviews.length > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                {data.pendingReviews.length}
              </Badge>
            )}
          </h2>

          {data.pendingReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No reviews pending approval.
            </p>
          ) : (
            <div className="space-y-3">
              {data.pendingReviews.map((review) => (
                <div key={review.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{review.reviewerName}</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        For: {review.lawyer.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleAction('approve-review', review.id, 'Approve')}
                        disabled={actionLoading === `approve-review-${review.id}`}
                        className="gap-1"
                      >
                        {actionLoading === `approve-review-${review.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('reject-review', review.id, 'Reject')}
                        disabled={actionLoading === `reject-review-${review.id}`}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        {actionLoading === `reject-review-${review.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
