'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Shield, Users, Inbox, FileText, Star,
  CheckCircle2, XCircle, Loader2, LayoutDashboard, Search
} from 'lucide-react';

interface AdminData {
  pendingLawyers: {
    id: string;
    fullName: string;
    baslNumber: string;
    user: { email: string; createdAt: string };
    draftData: any;
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

  // Modal Control States
  const [selectedLawyer, setSelectedLawyer] = useState<AdminData['pendingLawyers'][0] | null>(null);
  const [rejectLawyerId, setRejectLawyerId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchData = () => {
    fetch('/api/admin')
      .then((res) => res.json())
      .then(setData)
      .catch(() => toast.error('Failed to load admin data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (action: string, id: string, label: string) => {
    if (action === 'reject-lawyer' && !rejectReason.trim()) {
      return toast.error("Rejection reason is mandatory.");
    }

    setActionLoading(`${action}-${id}`);
    try {
      let endpoint = '/api/admin';
      let method = 'PATCH';
      let body = JSON.stringify({ action, id });

      if (action === 'verify-lawyer') {
        endpoint = `/api/applications/${id}/approve`;
        method = 'POST';
        body = JSON.stringify({});
      } else if (action === 'reject-lawyer') {
        endpoint = `/api/applications/${id}/reject`;
        method = 'POST';
        body = JSON.stringify({ reason: rejectReason });
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      toast.success(result.message || `${label} successful.`);
      
      // Cleanup UI
      setSelectedLawyer(null);
      setRejectLawyerId(null);
      setRejectReason("");
      
      fetchData();
    } catch {
      toast.error(`Failed to ${label.toLowerCase()}.`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 space-y-6 max-w-6xl w-full">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
           <Skeleton className="h-24 rounded-xl" />
        </div>
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
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Admin Pipeline</h1>
          <p className="font-medium text-gray-500 mt-0.5">Manage verifications, reviews, and platform analytics in real-time.</p>
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
                      onClick={() => setSelectedLawyer(lawyer)}
                      variant="secondary"
                      className="gap-1 font-semibold"
                    >
                      <Search className="h-4 w-4" /> Review Dossier
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectLawyerId(lawyer.id)}
                      className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="h-4 w-4" /> Refuse
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

      {/* --- MODALS --- */}
      <Dialog open={!!selectedLawyer} onOpenChange={(open) => !open && setSelectedLawyer(null)}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-3xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Verification Readout</DialogTitle>
            <DialogDescription>Validate all submitted credentials prior to platform enrollment.</DialogDescription>
          </DialogHeader>
          
          {selectedLawyer && (
            <div className="space-y-6 my-2">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                 <div><span className="text-gray-500 font-medium">Full Legal Name</span><p className="font-bold text-base mt-0.5 text-gray-900">{selectedLawyer.draftData?.step1?.fullName || 'N/A'}</p></div>
                 <div><span className="text-gray-500 font-medium">NIC Number</span><p className="font-bold text-base mt-0.5 text-gray-900">{selectedLawyer.draftData?.step1?.nic || 'N/A'}</p></div>
                 <div><span className="text-gray-500 font-medium">Contact Phone</span><p className="font-bold text-base mt-0.5 text-gray-900">{selectedLawyer.draftData?.step1?.phone || 'N/A'}</p></div>
                 <div><span className="text-gray-500 font-medium">Email Account</span><p className="font-bold text-base mt-0.5 text-gray-900">{selectedLawyer.user.email}</p></div>
                 <div className="col-span-2"><span className="text-gray-500 font-medium">Physical Address</span><p className="font-bold text-base mt-0.5 text-gray-900">{selectedLawyer.draftData?.step1?.address || 'N/A'}</p></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                 <div><span className="text-blue-600/80 font-bold uppercase text-[10px] tracking-wider">BASL Hash Sequence</span><p className="font-black text-xl text-blue-900 mt-0.5">{selectedLawyer.draftData?.step2?.baslNumber || 'N/A'}</p></div>
                 <div><span className="text-blue-600/80 font-bold uppercase text-[10px] tracking-wider">Supreme Court Year</span><p className="font-bold text-base text-blue-900 mt-1.5">{selectedLawyer.draftData?.step2?.enrollmentYear || 'N/A'}</p></div>
                 <div className="col-span-2"><span className="text-blue-600/80 font-bold uppercase text-[10px] tracking-wider">Practice Domains</span><p className="font-bold text-sm text-blue-900 mt-1">{selectedLawyer.draftData?.step3?.practiceAreas || 'N/A'}</p></div>
                 <div><span className="text-blue-600/80 font-bold uppercase text-[10px] tracking-wider">Primary District</span><p className="font-bold text-sm text-blue-900 mt-1">{selectedLawyer.draftData?.step3?.district || 'N/A'}</p></div>
                 <div><span className="text-blue-600/80 font-bold uppercase text-[10px] tracking-wider">Spoken Languages</span><p className="font-bold text-sm text-blue-900 mt-1">{selectedLawyer.draftData?.step3?.languages || 'N/A'}</p></div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-4">
            <Button variant="ghost" onClick={() => setSelectedLawyer(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 font-bold tracking-tight shadow-lg shadow-green-600/20" disabled={actionLoading !== null} onClick={() => selectedLawyer && handleAction('verify-lawyer', selectedLawyer.id, 'Approve')}>
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Authorize & Grant License
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectLawyerId} onOpenChange={(open) => !open && setRejectLawyerId(null)}>
        <DialogContent className="sm:max-w-md border-red-100 shadow-xl shadow-red-900/5">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2 text-xl font-bold"><XCircle className="w-5 h-5"/> Revoke Application</DialogTitle>
            <DialogDescription className="text-red-900/60 font-medium">
              This applicant will be immediately notified via Email Service. You must log the specific reasoning.
            </DialogDescription>
          </DialogHeader>
          <div className="my-2">
            <Textarea
              placeholder="e.g. Your BASL sequence fails security verification..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[140px] resize-none border-red-100 focus-visible:ring-red-500/20 font-medium text-gray-900 bg-red-50/30"
            />
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setRejectLawyerId(null)}>Cancel</Button>
            <Button variant="destructive" className="font-bold" disabled={!rejectReason.trim() || actionLoading !== null} onClick={() => rejectLawyerId && handleAction('reject-lawyer', rejectLawyerId, 'Reject')}>
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />} Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
