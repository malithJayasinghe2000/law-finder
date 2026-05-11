'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  RefreshCcw, CheckCircle, XCircle, DollarSign, Clock, AlertTriangle,
  User, CalendarDays, Banknote, CreditCard, ArrowRight,
} from 'lucide-react';
import { formatDateOnlyString } from '@/lib/utils';

interface RefundItem {
  id: string;
  bookingNumber: string;
  clientName: string;
  clientEmail: string;
  lawyerName: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: string;
  totalAmount: number;
  lawyerFee: number;
  platformFee: number;
  refundAmount: number;
  refundStatus: string;
  refundProcessedAt: string | null;
  refundNotes: string | null;
  status: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  paymentMethod: string;
  paymentBankName: string | null;
  paymentAccountHolder: string | null;
  paymentTransactionRef: string | null;
}

interface Stats {
  pendingCount: number;
  processedCount: number;
  totalPendingAmount: number;
}

const REFUND_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSED: 'Processed',
  DECLINED: 'Declined',
};

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [stats, setStats] = useState<Stats>({ pendingCount: 0, processedCount: 0, totalPendingAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedRefund, setSelectedRefund] = useState<RefundItem | null>(null);

  useEffect(() => { loadRefunds(); }, [statusFilter]);

  async function loadRefunds() {
    setLoading(true);
    try {
      const res = await fetch(`/api/consultations/refunds?status=${statusFilter}`);
      const data = await res.json();
      setRefunds(data.refunds || []);
      setStats(data.stats || { pendingCount: 0, processedCount: 0, totalPendingAmount: 0 });
    } catch {
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefundAction(bookingId: string, action: 'process' | 'decline') {
    const notes = action === 'decline'
      ? window.prompt('Reason for declining refund:')
      : window.prompt('Add a note (optional):', 'Refund sent via bank transfer');
    
    if (action === 'decline' && !notes) return; // Require reason for decline

    setActionLoading(bookingId);
    try {
      const res = await fetch('/api/consultations/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action, notes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'process' ? 'Refund marked as processed' : 'Refund declined');
        setSelectedRefund(null);
        loadRefunds();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  const statusTabs = [
    { value: 'PENDING', label: 'Pending Refunds', icon: Clock },
    { value: 'PROCESSED', label: 'Processed', icon: CheckCircle },
    { value: 'ALL', label: 'All History', icon: RefreshCcw },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-red-500 text-white">
          <Banknote className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Refund Management</h1>
          <p className="text-sm text-neutral-500 font-medium">Review and process refunds for cancelled consultations</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-none shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Pending Refunds</p>
                <p className="text-3xl font-bold text-neutral-900 mt-1">{stats.pendingCount}</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none shadow-sm border-l-4 border-l-red-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Total Amount Due</p>
                <p className="text-3xl font-bold text-red-600 mt-1">Rs. {stats.totalPendingAmount.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none shadow-sm border-l-4 border-l-green-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Processed</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.processedCount}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px ${statusFilter === tab.value ? 'border-[#0a0a0a] text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Refund List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-none" />)}
        </div>
      ) : refunds.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-200 bg-neutral-50/50">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-900">
            {statusFilter === 'PENDING' ? 'No pending refunds!' : 'No refunds found'}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {statusFilter === 'PENDING' ? 'All refunds have been processed.' : 'Adjust the filter to see refund records.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {refunds.map((refund) => (
            <Card key={refund.id} className="rounded-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                {/* Card Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-neutral-400">{refund.bookingNumber}</span>
                    <Badge className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${REFUND_STATUS_COLORS[refund.refundStatus] || 'bg-neutral-100 text-neutral-700'}`}>
                      {REFUND_STATUS_LABELS[refund.refundStatus] || refund.refundStatus}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] rounded-sm">
                      {refund.status === 'CANCELLED_BY_CLIENT' ? 'Client Cancelled' : refund.status === 'CANCELLED_BY_LAWYER' ? 'Lawyer Cancelled' : refund.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    {refund.paymentMethod === 'BANK_TRANSFER' ? (
                      <><Banknote className="w-3 h-3" /> Bank Transfer</>
                    ) : (
                      <><CreditCard className="w-3 h-3" /> PayHere</>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Client & Lawyer */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <div>
                            <p className="font-semibold text-neutral-900">{refund.clientName}</p>
                            <p className="text-[10px] text-neutral-400">{refund.clientEmail}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-300" />
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <p className="font-semibold text-neutral-900">{refund.lawyerName}</p>
                        </div>
                      </div>

                      {/* Booking Details */}
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDateOnlyString(refund.date, 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {refund.startTime} – {refund.endTime}
                        </span>
                        {refund.cancelledAt && (
                          <span className="text-red-500">
                            Cancelled {new Date(refund.cancelledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Cancel Reason */}
                      {refund.cancelReason && (
                        <div className="bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                          <span className="font-semibold">Cancel Reason:</span> {refund.cancelReason}
                        </div>
                      )}

                      {/* Refund Notes (for processed ones) */}
                      {refund.refundNotes && refund.refundStatus !== 'PENDING' && (
                        <div className="bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                          <span className="font-semibold">Admin Note:</span> {refund.refundNotes}
                          {refund.refundProcessedAt && (
                            <span className="ml-2 text-blue-400">
                              ({new Date(refund.refundProcessedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Side: Amount & Actions */}
                    <div className="text-right shrink-0 min-w-[180px]">
                      <div className="space-y-1 mb-3">
                        <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">Refund Amount</p>
                        <p className="text-2xl font-bold text-red-600">Rs. {refund.refundAmount.toLocaleString()}</p>
                        <div className="text-[10px] text-neutral-400 space-y-0.5">
                          <p>Original: Rs. {refund.totalAmount.toLocaleString()}</p>
                          <p>Lawyer Fee: Rs. {refund.lawyerFee.toLocaleString()}</p>
                          <p>Platform Fee: Rs. {refund.platformFee.toLocaleString()}</p>
                        </div>
                      </div>

                      {refund.refundStatus === 'PENDING' && (
                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleRefundAction(refund.id, 'process')}
                            disabled={actionLoading === refund.id}
                            className="bg-green-600 text-white hover:bg-green-700 rounded-none h-8 text-[10px] px-3 font-bold w-full"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Mark as Processed
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRefundAction(refund.id, 'decline')}
                            disabled={actionLoading === refund.id}
                            className="rounded-none h-8 text-[10px] px-3 font-bold text-red-600 border-red-200 hover:bg-red-50 w-full"
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Decline Refund
                          </Button>
                        </div>
                      )}

                      {refund.refundStatus === 'PROCESSED' && (
                        <Badge className="bg-green-100 text-green-800 text-[10px] rounded-sm">
                          <CheckCircle className="w-3 h-3 mr-1" /> Refund Sent
                        </Badge>
                      )}

                      {refund.refundStatus === 'DECLINED' && (
                        <Badge className="bg-red-100 text-red-800 text-[10px] rounded-sm">
                          <XCircle className="w-3 h-3 mr-1" /> Declined
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
