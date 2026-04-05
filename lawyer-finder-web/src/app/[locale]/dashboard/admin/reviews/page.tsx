'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Star, CheckCircle2, XCircle, Loader2, Search
} from 'lucide-react';

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  lawyer: { fullName: string };
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReviews = () => {
    setLoading(true);
    fetch('/api/admin')
      .then(res => res.json())
      .then(d => setReviews(d.pendingReviews || []))
      .catch(() => toast.error('Failed to load reviews.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReviews(); }, []);

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
      fetchReviews();
    } catch {
      toast.error(`Failed to ${label.toLowerCase()}.`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <Star className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Reviews</h1>
          <p className="text-sm text-neutral-500 font-medium">Moderate platform reviews</p>
        </div>
      </div>

      {/* Reviews */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-neutral-200 p-12 text-center">
          <Star className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 font-medium">No reviews pending approval.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-bold text-neutral-900">{review.reviewerName}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-medium mb-2">
                    For: <span className="font-semibold text-neutral-700">{review.lawyer.fullName}</span>
                  </p>
                  <p className="text-sm text-neutral-600">{review.comment}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAction('approve-review', review.id, 'Approve')}
                    disabled={actionLoading === `approve-review-${review.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#0a0a0a] text-white text-xs font-bold uppercase tracking-wide hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === `approve-review-${review.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction('reject-review', review.id, 'Reject')}
                    disabled={actionLoading === `reject-review-${review.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 text-xs font-bold uppercase tracking-wide hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === `reject-review-${review.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
