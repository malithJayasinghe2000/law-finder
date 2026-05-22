'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  CalendarDays, Clock, MapPin, Video, Star, XCircle, ChevronLeft, ChevronRight, AlertTriangle, CreditCard, Building2
} from 'lucide-react';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/schemas/consultation.schema';
import { formatDateOnlyString } from '@/lib/utils';
import Link from 'next/link';

interface Booking {
  id: string;
  bookingNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  mode: string;
  meetingLink: string | null;
  officeAddress: string | null;
  lawyerFee: number;
  platformFee: number;
  totalAmount: number;
  subject: string;
  description: string;
  status: string;
  clientRating: number | null;
  createdAt: string;
  lawyer: { id: string; fullName: string; profileImageUrl: string | null; district: string | null; contactPhone: string | null };
  payment: any;
}

export default function ClientConsultationsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelModal, setCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rateModal, setRateModal] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadBookings(); }, [page, statusFilter]);

  async function loadBookings() {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '10' });
      if (statusFilter) p.set('status', statusFilter);
      const res = await fetch(`/api/consultations/bookings?${p}`);
      const data = await res.json();
      setBookings(data.bookings || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }

  async function cancelBooking() {
    if (!cancelModal || cancelReason.length < 5) { toast.error('Please provide a reason (min 5 chars)'); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${cancelModal}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: cancelReason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Booking cancelled${data.refundAmount ? `. Refund: Rs. ${data.refundAmount.toLocaleString()}` : ''}`);
        setCancelModal(null);
        setCancelReason('');
        loadBookings();
      } else toast.error(data.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setActionLoading(false); }
  }

  async function submitRating() {
    if (!rateModal) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${rateModal}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rate', rating, feedback: feedback || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Thank you for your feedback!');
        setRateModal(null);
        setFeedback('');
        loadBookings();
      } else toast.error(data.error || 'Failed');
    } catch { toast.error('Failed'); }
    finally { setActionLoading(false); }
  }

  async function submitPaymentDetails() {
    if (!bankName || !accountHolder || !transactionRef) {
      toast.error('Please fill in all bank details');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${paymentModal}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'BANK_TRANSFER',
          bankName,
          accountHolder,
          transactionRef
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Payment details submitted successfully! Awaiting admin verification.');
        setPaymentModal(null);
        setBankName('');
        setAccountHolder('');
        setTransactionRef('');
        loadBookings();
      } else {
        toast.error(data.error || 'Failed to submit payment details');
      }
    } catch { toast.error('Failed to submit'); }
    finally { setActionLoading(false); }
  }

  const statusTabs = [
    { value: '', label: 'All' },
    { value: 'CONFIRMED', label: 'Upcoming' },
    { value: 'PENDING_PAYMENT', label: 'Pending Payment' },
    { value: 'AWAITING_BANK_TRANSFER_VERIFICATION', label: 'Pending Bank Transfer Verification' },
    { value: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">My Consultations</h1>
          <p className="text-sm text-neutral-500 font-medium">Track your lawyer consultation bookings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {statusTabs.map((tab) => (
          <button key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors ${statusFilter === tab.value ? 'border-[#0a0a0a] text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
          >{tab.label}</button>
        ))}
      </div>

      {/* Bookings */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-none" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-200 bg-neutral-50/50">
          <CalendarDays className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-900">No consultations yet</p>
          <p className="text-xs text-neutral-500 mt-1 mb-4">Browse lawyers and book your first consultation</p>
          <Link href={`/${locale}/lawyers`}>
            <Button className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-9 text-xs font-bold uppercase tracking-wide">Find a Lawyer</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Card key={b.id} className="rounded-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-neutral-400">{b.bookingNumber}</span>
                      <Badge className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${BOOKING_STATUS_COLORS[b.status]}`}>
                        {BOOKING_STATUS_LABELS[b.status]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] rounded-sm">
                        {b.mode === 'PHYSICAL' ? <><MapPin className="w-3 h-3 mr-1" /> Physical</> : <><Video className="w-3 h-3 mr-1" /> Online</>}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-bold text-neutral-900">{b.subject}</h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                      <span>Lawyer: <strong className="text-neutral-700">{b.lawyer?.fullName}</strong></span>
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDateOnlyString(b.date, 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.startTime} – {b.endTime}</span>
                    </div>
                    {/* Meeting link for confirmed online bookings */}
                    {b.status === 'CONFIRMED' && b.mode !== 'PHYSICAL' && b.meetingLink && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 inline-flex items-center gap-2">
                        <Video className="w-3.5 h-3.5 text-blue-600" />
                        <a href={b.meetingLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-semibold underline">Join Meeting</a>
                      </div>
                    )}
                    {b.status === 'CONFIRMED' && b.mode === 'PHYSICAL' && b.officeAddress && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 inline-flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs text-green-800">{b.officeAddress}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-neutral-900">Rs. {b.totalAmount.toLocaleString()}</p>
                    <p className="text-[10px] text-neutral-400">Total paid</p>
                    <div className="flex gap-1.5 mt-3 justify-end flex-wrap">
                      {b.status === 'PENDING_PAYMENT' && (
                        <Button size="sm" onClick={() => setPaymentModal(b.id)} className="bg-blue-600 text-white hover:bg-blue-700 rounded-none h-7 text-[10px] px-2.5 font-bold border-none">
                          <CreditCard className="w-3 h-3 mr-1" /> Submit Payment
                        </Button>
                      )}
                      {['PENDING_PAYMENT', 'CONFIRMED', 'AWAITING_BANK_TRANSFER_VERIFICATION'].includes(b.status) && (
                        <Button size="sm" variant="outline" onClick={() => setCancelModal(b.id)} className="rounded-none h-7 text-[10px] px-2.5 font-bold text-red-600 border-red-300">
                          <XCircle className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      )}
                      {b.status === 'COMPLETED' && !b.clientRating && (
                        <Button size="sm" onClick={() => setRateModal(b.id)} className="bg-amber-500 text-white hover:bg-amber-600 rounded-none h-7 text-[10px] px-2.5 font-bold">
                          <Star className="w-3 h-3 mr-1" /> Rate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-none h-8"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-xs font-semibold text-neutral-600">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-none h-8"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCancelModal(null)}>
          <div className="bg-white max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b"><h2 className="text-lg font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Cancel Booking</h2></div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <p className="font-semibold mb-1">Cancellation Policy</p>
                <p>• 24+ hours before: Full refund</p>
                <p>• Less than 24 hours: 50% refund</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Reason for cancellation *</label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="Please explain why..." className="w-full border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setCancelModal(null)} variant="outline" className="flex-1 rounded-none h-10 font-bold text-xs">Keep Booking</Button>
                <Button onClick={cancelBooking} disabled={actionLoading} className="flex-1 bg-red-600 text-white hover:bg-red-700 rounded-none h-10 font-bold text-xs">{actionLoading ? 'Cancelling...' : 'Confirm Cancel'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Modal */}
      {rateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRateModal(null)}>
          <div className="bg-white max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b"><h2 className="text-lg font-bold flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> Rate Consultation</h2></div>
            <div className="p-6 space-y-4">
              <div className="flex justify-center gap-2">
                {[1,2,3,4,5].map((v) => (
                  <button key={v} onClick={() => setRating(v)} className={`text-3xl transition-transform hover:scale-110 ${v <= rating ? 'text-amber-400' : 'text-neutral-200'}`}>★</button>
                ))}
              </div>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Share your experience (optional)" className="w-full border border-neutral-200 px-3 py-2 text-sm" />
              <Button onClick={submitRating} disabled={actionLoading} className="w-full bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 font-bold text-xs uppercase tracking-wide">{actionLoading ? 'Submitting...' : 'Submit Rating'}</Button>
            </div>
          </div>
        </div>
      )}
      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPaymentModal(null)}>
          <div className="bg-white max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2"><Building2 className="w-5 h-5 text-neutral-900" /> Submit Bank Transfer</h2>
              <button onClick={() => setPaymentModal(null)} className="text-neutral-400 hover:text-neutral-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <p className="font-bold mb-1">Bank Transfer Instructions:</p>
                <p>Please transfer the exact amount to the account below, then enter the transaction reference.</p>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  <li>Bank: Commercial Bank</li>
                  <li>Account Name: FindLawyer Platform</li>
                  <li>Account No: 1234567890</li>
                  <li>Branch: Colombo 01</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Your Bank Name</label>
                  <input value={bankName} onChange={e => setBankName(e.target.value)} className="w-full h-9 border border-neutral-300 px-3 text-sm focus:outline-none focus:border-black" placeholder="e.g. HNB" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Account Holder</label>
                  <input value={accountHolder} onChange={e => setAccountHolder(e.target.value)} className="w-full h-9 border border-neutral-300 px-3 text-sm focus:outline-none focus:border-black" placeholder="e.g. John Doe" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Transaction Reference Number</label>
                <input value={transactionRef} onChange={e => setTransactionRef(e.target.value)} className="w-full h-9 border border-neutral-300 px-3 text-sm focus:outline-none focus:border-black" />
              </div>

              <Button onClick={submitPaymentDetails} disabled={actionLoading} className="w-full bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 font-bold text-xs uppercase tracking-wide">
                {actionLoading ? 'Submitting...' : 'Submit Payment Details'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
