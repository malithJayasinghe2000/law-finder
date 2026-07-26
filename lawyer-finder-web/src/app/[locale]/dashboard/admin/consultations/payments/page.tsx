'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { DollarSign, CheckCircle, XCircle, Search, Eye, Clock, User, Mail, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDateOnlyString } from '@/lib/utils';

export default function AdminConsultationPaymentsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  
  // Search, filtering & pagination states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  
  // Reject/Resubmit dialog states
  const [notesTarget, setNotesTarget] = useState<{ bookingId: string; status: 'CANCELLED' | 'RESUBMIT' } | null>(null);
  const [notesReason, setNotesReason] = useState('');

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  // Load payments whenever the status filter changes
  useEffect(() => { loadPayments(); }, [statusFilter]);

  async function loadPayments() {
    setLoading(true);
    try {
      let url = '/api/consultations/bookings?limit=100';
      if (statusFilter === 'PENDING') {
        url = '/api/consultations/bookings?status=AWAITING_BANK_TRANSFER_VERIFICATION&limit=100';
      } else if (statusFilter === 'RESUBMIT') {
        url = '/api/consultations/bookings?status=PENDING_PAYMENT&limit=100';
      } else if (statusFilter === 'PAID') {
        url = '/api/consultations/bookings?limit=200';
      } else {
        url = '/api/consultations/bookings?limit=200';
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      // Filter for those that have payments via bank transfer
      const bankTransferBookings = (data.bookings || []).filter((b: any) => 
        b.payment && b.payment.method === 'BANK_TRANSFER'
      );
      
      setBookings(bankTransferBookings);
    } catch { 
      toast.error('Failed to load payments'); 
    } finally { 
      setLoading(false); 
    }
  }

  async function handleVerify(bookingId: string, status: 'PAID' | 'CANCELLED' | 'RESUBMIT', notes?: string) {
    setActionLoading(bookingId);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          adminNotes: notes || (status === 'PAID' ? 'Verified manually' : status === 'RESUBMIT' ? 'Payment receipt was unclear. Please resubmit.' : 'Invalid receipt or reference.'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Payment ${status === 'PAID' ? 'approved and booking confirmed' : status === 'RESUBMIT' ? 'resubmission requested' : 'rejected'}`);
        setNotesTarget(null);
        setNotesReason('');
        loadPayments();
      } else {
        toast.error(data.error || 'Failed to update payment');
      }
    } catch { 
      toast.error('Failed to update payment'); 
    } finally { 
      setActionLoading(null); 
    }
  }

  // Filter & Search logic
  const filteredBookings = bookings.filter((b) => {
    // 1. Status Filter
    if (statusFilter !== 'ALL') {
      if (b.payment.status !== statusFilter) return false;
    }

    // 2. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const bookingNo = b.bookingNumber?.toLowerCase() || '';
      const clientName = b.client?.fullName?.toLowerCase() || b.client?.email?.toLowerCase() || '';
      const lawyerName = b.lawyer?.fullName?.toLowerCase() || '';
      const refNo = b.payment.transactionRef?.toLowerCase() || '';
      if (!bookingNo.includes(q) && !clientName.includes(q) && !lawyerName.includes(q) && !refNo.includes(q)) {
        return false;
      }
    }

    return true;
  });

  // Sort logic: latest updated/created data to the top
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const dateA = new Date(a.payment?.updatedAt || a.payment?.createdAt || a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.payment?.updatedAt || b.payment?.createdAt || b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  // Pagination logic
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / limit));
  const paginatedBookings = sortedBookings.slice((page - 1) * limit, page * limit);

  // Status styling helpers
  const paymentStatusColor = (status: string) => {
    if (status === 'PENDING') return 'bg-amber-50 text-amber-700 border border-amber-200';
    if (status === 'PAID') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (status === 'CANCELLED') return 'bg-rose-50 text-rose-700 border border-rose-200';
    if (status === 'RESUBMIT') return 'bg-sky-50 text-sky-700 border border-sky-200';
    return 'bg-neutral-50 text-neutral-700 border border-neutral-200';
  };

  const paymentStatusLabel = (status: string) => {
    if (status === 'PENDING') return 'Pending Verification';
    if (status === 'PAID') return 'Approved & Paid';
    if (status === 'CANCELLED') return 'Rejected';
    if (status === 'RESUBMIT') return 'Resubmit Requested';
    return status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Payment Verification</h1>
            <p className="text-sm text-neutral-500 font-medium">Verify pending bank transfers for consultations</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadPayments} className="rounded-none h-8 gap-2 text-xs border-neutral-200">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-neutral-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by client, lawyer, booking number or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] transition-colors placeholder:text-neutral-400"
            />
          </div>
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2.5 px-3 bg-neutral-50 border border-neutral-200 text-sm font-medium text-neutral-900 outline-none focus:border-[#0a0a0a] min-w-[160px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Verification</option>
              <option value="PAID">Approved (Paid)</option>
              <option value="CANCELLED">Rejected (Cancelled)</option>
              <option value="RESUBMIT">Resubmit Requested</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">
          {filteredBookings.length} Payment Record{filteredBookings.length !== 1 ? 's' : ''} Found
        </p>
      </div>

      {/* Table Grid */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-none w-full" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white border border-neutral-200 p-12 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500 font-medium">No payment records match your filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Booking # & Date</th>
                <th className="px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Client</th>
                <th className="px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Lawyer</th>
                <th className="px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Bank Details</th>
                <th className="px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Receipt</th>
                <th className="px-5 py-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings.map((b) => (
                <tr key={b.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                  {/* Booking Info */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <p className="text-xs font-mono font-semibold text-neutral-900">{b.bookingNumber}</p>
                    <p className="text-[10px] text-neutral-400 mt-1 font-semibold uppercase">
                      {formatDateOnlyString(b.date, 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </td>
                  
                  {/* Client Info */}
                  <td className="px-5 py-4">
                    <p className="text-xs font-bold text-neutral-900">{b.client?.fullName || 'Client'}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5 font-medium truncate max-w-[150px]">{b.client?.email}</p>
                  </td>

                  {/* Lawyer Info */}
                  <td className="px-5 py-4">
                    <p className="text-xs font-bold text-neutral-900">{b.lawyer?.fullName || 'Lawyer'}</p>
                  </td>

                  {/* Amount */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <p className="text-sm font-bold text-neutral-950">Rs. {b.totalAmount.toLocaleString()}</p>
                    <p className="text-[9px] text-neutral-400 font-semibold uppercase mt-0.5">Total Paid</p>
                  </td>

                  {/* Bank Details */}
                  <td className="px-5 py-4">
                    <div className="text-[10px] font-mono text-neutral-600 max-w-[200px] space-y-0.5 leading-normal">
                      <p><span className="font-bold text-neutral-450 uppercase">Bank:</span> {b.payment.bankName}</p>
                      <p><span className="font-bold text-neutral-450 uppercase">Holder:</span> {b.payment.accountHolder}</p>
                      <p><span className="font-bold text-neutral-450 uppercase">Ref:</span> {b.payment.transactionRef}</p>
                    </div>
                  </td>

                  {/* Receipt */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {b.payment.receiptImageUrl ? (
                      <button
                        type="button"
                        onClick={() => setSelectedReceiptUrl(b.payment.receiptImageUrl)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#bfa37a] hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    ) : (
                      <span className="text-[10px] text-neutral-400 font-semibold italic">No Receipt Uploaded</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${paymentStatusColor(b.payment.status)}`}>
                      {paymentStatusLabel(b.payment.status)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {b.payment.status === 'PENDING' ? (
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setNotesTarget({ bookingId: b.id, status: 'RESUBMIT' })}
                          disabled={actionLoading === b.id}
                          className="rounded-none h-7 text-[9px] px-2.5 font-bold border-neutral-250 text-neutral-700 hover:bg-neutral-50"
                        >
                          Resubmit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setNotesTarget({ bookingId: b.id, status: 'CANCELLED' })}
                          disabled={actionLoading === b.id}
                          className="rounded-none h-7 text-[9px] px-2.5 font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-750"
                        >
                          Reject
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleVerify(b.id, 'PAID')}
                          disabled={actionLoading === b.id}
                          className="bg-green-600 hover:bg-green-700 text-white rounded-none h-7 text-[9px] px-2.5 font-bold"
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-neutral-400 font-semibold text-right">
                        {b.payment.verifiedAt && (
                          <p>Verified on {new Date(b.payment.verifiedAt).toLocaleDateString()}</p>
                        )}
                        {b.payment.adminNotes && (
                          <p className="text-[9px] text-neutral-400 truncate max-w-[150px] italic mt-0.5">"{b.payment.adminNotes}"</p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1} 
            className="rounded-none h-8 border-neutral-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-semibold text-neutral-600">Page {page} of {totalPages}</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages} 
            className="rounded-none h-8 border-neutral-200"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Reject / Resubmit Dialog */}
      <Dialog open={Boolean(notesTarget)} onOpenChange={(open) => { if (!open) setNotesTarget(null); }}>
        <DialogContent className="max-w-md bg-white border border-neutral-200 p-6 rounded-none">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-neutral-900">
              {notesTarget?.status === 'RESUBMIT' ? 'Request Payment Resubmission' : 'Reject Bank Transfer Payment'}
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 mt-1">
              Provide instructions or reasons to the client. This will be sent via email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Admin Message / Reasons</label>
            <textarea
              value={notesReason}
              onChange={(e) => setNotesReason(e.target.value)}
              rows={4}
              className="w-full border border-neutral-250 bg-neutral-50/50 p-3 text-xs text-neutral-900 outline-none focus:border-[#0a0a0a] rounded-none transition-colors"
              placeholder={notesTarget?.status === 'RESUBMIT' ? "e.g., 'The transaction receipt is blurry. Please upload a clear image of the bank receipt showing the reference ID.'" : "e.g., 'The uploaded receipt was invalid and transaction reference could not be found in our records.'"}
            />
          </div>

          <DialogFooter className="flex justify-end gap-2 border-t border-neutral-100 pt-4 mt-2">
            <Button variant="outline" size="sm" onClick={() => setNotesTarget(null)} className="rounded-none h-9 text-xs font-bold border-neutral-250">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={actionLoading !== null}
              className={`rounded-none h-9 text-xs font-bold text-white ${notesTarget?.status === 'RESUBMIT' ? 'bg-[#0a0a0a] hover:bg-neutral-800' : 'bg-red-600 hover:bg-red-700'}`}
              onClick={() => {
                if (notesTarget) {
                  handleVerify(notesTarget.bookingId, notesTarget.status, notesReason);
                }
              }}
            >
              {actionLoading ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Image View Dialog */}
      <Dialog open={Boolean(selectedReceiptUrl)} onOpenChange={(open) => { if (!open) setSelectedReceiptUrl(null); }}>
        <DialogContent className="max-w-2xl bg-white border border-neutral-200 p-6 rounded-none">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-neutral-900">Uploaded Bank Receipt</DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 mt-1">Review the bank transfer receipt below.</DialogDescription>
          </DialogHeader>

          {selectedReceiptUrl ? (
            <div className="mt-4 flex items-center justify-center bg-neutral-50 border border-neutral-100 p-2 overflow-hidden">
              <img
                src={selectedReceiptUrl}
                alt="Uploaded receipt"
                className="max-w-full max-h-[65vh] object-contain"
              />
            </div>
          ) : (
            <div className="mt-4 text-xs text-neutral-500 italic">No receipt selected.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
