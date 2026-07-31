'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  CalendarDays, Clock, MapPin, Video, Star, XCircle, ChevronLeft, ChevronRight, AlertTriangle, CreditCard, Building2, Loader2, ImagePlus, FileText, ScrollText
} from 'lucide-react';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/schemas/consultation.schema';
import { formatDateOnlyString } from '@/lib/utils';
import Link from 'next/link';
import QuoteReviewDialog from '@/components/consultations/QuoteReviewDialog';
import EngagementLetterDialog from '@/components/consultations/EngagementLetterDialog';

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
  totalAmount: number;
  refundAmount: number | null;
  subject: string;
  description: string;
  status: string;
  // Bank details the lawyer supplies when quoting. The client pays the lawyer
  // directly using these; the platform never receives the funds.
  paymentInstructions: string | null;
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
  const [quoteReview, setQuoteReview] = useState<Booking | null>(null);
  const [letterBookingId, setLetterBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transactionRef, setTransactionRef] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [receiptUploading, setReceiptUploading] = useState(false);
  
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

  const uploadReceiptImage = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'receipts');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload receipt image');
    }

    const data = await response.json();
    return data.url as string;
  };

  const handleReceiptUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file for the receipt.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5MB.');
        return;
      }

      setReceiptUploading(true);
      try {
        const url = await uploadReceiptImage(file);
        setReceiptImageUrl(url);
        toast.success('Receipt uploaded successfully.');
      } catch (uploadError: any) {
        toast.error(uploadError?.message || 'Receipt upload failed.');
      } finally {
        setReceiptUploading(false);
      }
    };

    input.click();
  };

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


  const handleOpenPaymentModal = (booking: any) => {
    if (booking.payment) {
      setBankName(booking.payment.bankName || '');
      setAccountHolder(booking.payment.accountHolder || '');
      setAccountNumber(booking.payment.accountNumber || '');
      setTransactionDate(booking.payment.transactionDate || new Date().toISOString().split('T')[0]);
      setTransactionRef(booking.payment.transactionRef || '');
      setReceiptImageUrl(booking.payment.receiptImageUrl || '');
    } else {
      setBankName('');
      setAccountHolder('');
      setAccountNumber('');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setTransactionRef('');
      setReceiptImageUrl('');
    }
    setPaymentModal(booking.id);
  };

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
          accountNumber,
          transactionDate,
          transactionRef,
          receiptImageUrl
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Payment recorded. The firm will confirm once it reaches their account.');
        setPaymentModal(null);
        setBankName('');
        setAccountHolder('');
        setAccountNumber('');
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setTransactionRef('');
        setReceiptImageUrl('');
        loadBookings();
      } else {
        toast.error(typeof data.error === 'string' ? data.error : 'Validation error, please check the fields');
      }
    } catch { toast.error('Failed to submit'); }
    finally { setActionLoading(false); }
  }

  const statusTabs = [
    { value: '', label: 'All' },
    { value: 'REQUESTED', label: 'Submitted' },
    { value: 'QUOTED', label: 'Awaiting your response' },
    { value: 'CONFIRMED', label: 'Upcoming' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'DECLINED', label: 'Not accepted' },
    { value: 'CANCELLED_BY_CLIENT', label: 'Cancelled' },
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
                    {b.status === 'SCHEDULED' && b.mode !== 'PHYSICAL' && b.meetingLink && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 inline-flex items-center gap-2">
                        <Video className="w-3.5 h-3.5 text-blue-600" />
                        <a href={b.meetingLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-semibold underline">Join Meeting</a>
                      </div>
                    )}
                    {b.status === 'SCHEDULED' && b.mode === 'PHYSICAL' && b.officeAddress && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 inline-flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs text-green-800">{b.officeAddress}</span>
                      </div>
                    )}
                    {b.status === 'ACCEPTED' && b.paymentInstructions && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200">
                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest mb-1">Pay the firm directly</p>
                        <p className="text-xs text-amber-900 whitespace-pre-wrap">{b.paymentInstructions}</p>
                        <p className="text-[10px] text-amber-700 mt-1.5">
                          The platform never handles this payment and takes no share of it.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {b.status === 'REQUESTED' && (
                      <p className="mb-2 text-xs italic text-neutral-500">Waiting for the firm to review your request…</p>
                    )}
                    {b.status === 'CONFLICT_CHECK' && (
                      <p className="mb-2 text-xs italic text-neutral-500">The firm is checking for conflicts of interest…</p>
                    )}
                    {b.status === 'QUOTED' && (
                      <p className="mb-2 text-xs font-semibold text-amber-700">A fee proposal is waiting for your response.</p>
                    )}
                    {b.status === 'ACCEPTED' && (
                      <div className="mb-3 text-right">
                        <p className="mb-1 text-xs text-neutral-500">Agreed fee, payable to the firm:</p>
                        <p className="text-sm font-bold text-[#0a0a0a]">Rs. {b.totalAmount?.toLocaleString()}</p>
                      </div>
                    )}
                    {b.status === 'CANCELLED_BY_CLIENT' && b.refundAmount !== null && b.refundAmount > 0 && (
                      <div className="mt-2 text-right bg-red-50 p-1.5 border border-red-100">
                        {b.refundAmount < b.totalAmount && (
                          <p className="text-[10px] text-red-600 font-bold">- Rs. {(b.totalAmount - b.refundAmount).toLocaleString()} (Late Cancel Penalty)</p>
                        )}
                        <p className="text-xs text-green-600 font-bold">Refund: Rs. {b.refundAmount.toLocaleString()}</p>
                      </div>
                    )}
                    <div className="flex gap-1.5 mt-3 justify-end flex-wrap">
                      {['REQUESTED', 'CONFLICT_CHECK', 'QUOTED', 'ACCEPTED', 'SCHEDULED'].includes(b.status) && (
                        <Button size="sm" variant="outline" onClick={() => setCancelModal(b.id)} className="rounded-none h-7 text-[10px] px-2.5 font-bold text-red-600 border-red-300">
                          <XCircle className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      )}
                      {b.status === 'QUOTED' && (
                        <Button size="sm" onClick={() => setQuoteReview(b)} className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-7 text-[10px] px-2.5 font-bold">
                          <FileText className="w-3 h-3 mr-1" /> Review proposal
                        </Button>
                      )}
                      {['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) && (
                        <Button size="sm" variant="outline" onClick={() => setLetterBookingId(b.id)} className="rounded-none h-7 text-[10px] px-2.5 font-bold">
                          <ScrollText className="w-3 h-3 mr-1" /> Engagement letter
                        </Button>
                      )}
                      {b.status === 'ACCEPTED' && (
                        <Button size="sm" onClick={() => handleOpenPaymentModal(b)} className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-7 text-[10px] px-2.5 font-bold">
                          I have paid
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

      {quoteReview && (
        <QuoteReviewDialog
          bookingId={quoteReview.id}
          bookingNumber={quoteReview.bookingNumber}
          firmName={quoteReview.lawyer.fullName}
          open={Boolean(quoteReview)}
          onOpenChange={(o) => { if (!o) setQuoteReview(null); }}
          onResponded={loadBookings}
        />
      )}

      {letterBookingId && (
        <EngagementLetterDialog
          bookingId={letterBookingId}
          open={Boolean(letterBookingId)}
          onOpenChange={(o) => { if (!o) setLetterBookingId(null); }}
        />
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

      {/* Payment Modal */}
      {paymentModal && (() => {
        const bookingBeingPaid = bookings.find(b => b.id === paymentModal);
        const isOnlineOnly = bookingBeingPaid?.mode === 'ONLINE';

        let parsedInstructions: any = null;
        if (bookingBeingPaid?.paymentInstructions) {
          try {
            parsedInstructions = JSON.parse(bookingBeingPaid.paymentInstructions);
          } catch (e) {
            // Not JSON, fallback to raw string
          }
        }
        
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPaymentModal(null)}>
            <div className="bg-white max-w-md w-full max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold flex items-center gap-2"><Building2 className="w-5 h-5 text-neutral-900" /> Submit Bank Transfer</h2>
                <button onClick={() => setPaymentModal(null)} className="text-neutral-400 hover:text-neutral-600"><XCircle className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <p className="font-bold mb-1">Bank Transfer Instructions:</p>
                  <p>Please transfer the exact amount to the account below, then enter the transaction reference.</p>
                  
                  {(parsedInstructions && parsedInstructions.bankName) ? (
                    <div className="mt-2 space-y-1.5 bg-amber-100 border border-amber-200 rounded p-3 text-[11px]">
                      <div className="grid grid-cols-3 gap-2 border-b border-amber-200 pb-1.5">
                        <span className="font-semibold text-amber-900 uppercase tracking-wide">Bank:</span>
                        <span className="col-span-2">{parsedInstructions.bankName}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-b border-amber-200 pb-1.5">
                        <span className="font-semibold text-amber-900 uppercase tracking-wide">Branch:</span>
                        <span className="col-span-2">{parsedInstructions.bankBranch}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-b border-amber-200 pb-1.5">
                        <span className="font-semibold text-amber-900 uppercase tracking-wide">Acc Name:</span>
                        <span className="col-span-2">{parsedInstructions.accountName}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="font-semibold text-amber-900 uppercase tracking-wide">Acc No:</span>
                        <span className="col-span-2 font-mono text-xs font-bold">{parsedInstructions.accountNumber}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 bg-amber-100 border border-amber-200 rounded whitespace-pre-wrap font-mono text-[11px]">
                      {bookingBeingPaid?.paymentInstructions || 'No instructions provided.'}
                    </div>
                  )}
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
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Account Number</label>
                  <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full h-9 border border-neutral-300 px-3 text-sm focus:outline-none focus:border-black" placeholder="e.g. 123456789" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase">Transaction Date</label>
                  <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className="w-full h-9 border border-neutral-300 px-3 text-sm focus:outline-none focus:border-black" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Transaction Reference Number</label>
                <input value={transactionRef} onChange={e => setTransactionRef(e.target.value)} className="w-full h-9 border border-neutral-300 px-3 text-sm focus:outline-none focus:border-black" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-2">Receipt Photo (optional)</label>
                {receiptImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-neutral-200">
                    <img src={receiptImageUrl} alt="Receipt preview" className="w-full h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => setReceiptImageUrl('')}
                      className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 text-[10px] rounded-md hover:bg-black/80"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleReceiptUpload}
                    disabled={receiptUploading}
                    className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    {receiptUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                    {receiptUploading ? 'Uploading receipt...' : 'Click to upload receipt image'}
                  </button>
                )}
              </div>

                <Button 
                  onClick={submitPaymentDetails} 
                  className="w-full bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 font-bold text-xs uppercase tracking-wide"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Submitting...' : 'Submit Payment Details'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
