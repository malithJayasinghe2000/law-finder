'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  CalendarDays, Clock, MapPin, Video, User, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Eye, FileText,
} from 'lucide-react';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/schemas/consultation.schema';
import { formatDateOnlyString } from '@/lib/utils';

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
  practiceArea: string | null;
  status: string;
  clientRating: number | null;
  clientFeedback: string | null;
  createdAt: string;
  client: { id: string; fullName: string | null; email: string; profileImageUrl: string | null };
  payment: any;
}

export default function LawyerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelBookingTarget, setCancelBookingTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadBookings(); }, [page, statusFilter]);

  async function loadBookings() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/consultations/bookings?${params}`);
      const data = await res.json();
      setBookings(data.bookings || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(bookingId: string, action: string, extra?: any) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Booking updated successfully');
        setSelectedBooking(null);
        if (action === 'cancel') {
          setCancelBookingTarget(null);
          setCancelReason('');
        }
        loadBookings();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelBooking() {
    if (!cancelBookingTarget) return;
    if (cancelReason.trim().length < 5) {
      toast.error('Please provide a cancellation reason of at least 5 characters.');
      return;
    }

    await handleAction(cancelBookingTarget.id, 'cancel', { reason: cancelReason });
  }

  const statusTabs = [
    { value: '', label: 'All' },
    { value: 'CONFIRMED', label: 'Upcoming' },
    { value: 'PENDING_PAYMENT', label: 'Pending' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED_BY_CLIENT', label: 'Cancelled by Client' },
    { value: 'CANCELLED_BY_LAWYER', label: 'Cancelled by Me' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Consultation Bookings</h1>
          <p className="text-sm text-neutral-500 font-medium">Manage your client consultation appointments</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px ${statusFilter === tab.value ? 'border-[#0a0a0a] text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-none" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-200 bg-neutral-50/50">
          <CalendarDays className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-900">No bookings found</p>
          <p className="text-xs text-neutral-500 mt-1">Bookings from clients will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <Card key={booking.id} className="rounded-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-neutral-400">{booking.bookingNumber}</span>
                      <Badge className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${BOOKING_STATUS_COLORS[booking.status] || 'bg-neutral-100 text-neutral-700'}`}>
                        {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] rounded-sm">
                        {booking.mode === 'PHYSICAL' ? <><MapPin className="w-3 h-3 mr-1" /> Physical</> : <><Video className="w-3 h-3 mr-1" /> Online</>}
                      </Badge>
                    </div>

                    <h3 className="text-sm font-bold text-neutral-900 truncate">{booking.subject}</h3>

                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {booking.client?.fullName || booking.client?.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {formatDateOnlyString(booking.date, 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {booking.startTime} – {booking.endTime}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-neutral-900">Rs. {booking.lawyerFee.toLocaleString()}</p>
                    <p className="text-[10px] text-neutral-400">Your fee</p>

                    <div className="flex gap-1.5 mt-3">
                      {booking.status === 'PENDING_PAYMENT' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCancelBookingTarget(booking);
                            setCancelReason('Cancelled due to non-payment');
                          }}
                          disabled={actionLoading}
                          className="rounded-none h-7 text-[10px] px-2.5 font-bold text-red-600 border-red-300"
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      )}
                      {booking.status === 'CONFIRMED' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleAction(booking.id, 'complete')}
                            disabled={actionLoading}
                            className="bg-green-600 text-white hover:bg-green-700 rounded-none h-7 text-[10px] px-2.5 font-bold"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCancelBookingTarget(booking);
                              setCancelReason('Unavailable');
                            }}
                            disabled={actionLoading}
                            className="rounded-none h-7 text-[10px] px-2.5 font-bold text-red-600 border-red-300"
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Cancel
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedBooking(booking)}
                        className="rounded-none h-7 text-[10px] px-2.5 font-bold"
                      >
                        <Eye className="w-3 h-3 mr-1" /> Details
                      </Button>
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
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-none h-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-semibold text-neutral-600">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-none h-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{selectedBooking.bookingNumber}</h2>
                <button onClick={() => setSelectedBooking(null)} className="text-neutral-400 hover:text-neutral-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-neutral-500 text-xs">Client</p><p className="font-semibold">{selectedBooking.client?.fullName || selectedBooking.client?.email}</p></div>
                <div><p className="text-neutral-500 text-xs">Status</p><Badge className={`text-[10px] ${BOOKING_STATUS_COLORS[selectedBooking.status]}`}>{BOOKING_STATUS_LABELS[selectedBooking.status]}</Badge></div>
                <div><p className="text-neutral-500 text-xs">Date</p><p className="font-semibold">{formatDateOnlyString(selectedBooking.date, 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
                <div><p className="text-neutral-500 text-xs">Time</p><p className="font-semibold">{selectedBooking.startTime} – {selectedBooking.endTime} ({selectedBooking.duration} min)</p></div>
                <div><p className="text-neutral-500 text-xs">Mode</p><p className="font-semibold">{selectedBooking.mode}</p></div>
                <div><p className="text-neutral-500 text-xs">Your Fee</p><p className="font-semibold">Rs. {selectedBooking.lawyerFee.toLocaleString()}</p></div>
              </div>
              {selectedBooking.meetingLink && (
                <div className="p-3 bg-blue-50 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Meeting Link</p>
                  <a href={selectedBooking.meetingLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline break-all">{selectedBooking.meetingLink}</a>
                </div>
              )}
              <div>
                <p className="text-neutral-500 text-xs mb-1">Subject</p>
                <p className="text-sm font-semibold">{selectedBooking.subject}</p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs mb-1">Description</p>
                <p className="text-sm text-neutral-700">{selectedBooking.description}</p>
              </div>
              {selectedBooking.clientRating && (
                <div className="p-3 bg-amber-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-800">Client Rating: {'⭐'.repeat(selectedBooking.clientRating)}</p>
                  {selectedBooking.clientFeedback && <p className="text-sm text-amber-700 mt-1">{selectedBooking.clientFeedback}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(cancelBookingTarget)} onOpenChange={(open) => { if (!open) { setCancelBookingTarget(null); setCancelReason(''); } }}>
        <DialogContent>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            Provide a clear cancellation reason for this booking. The client will be notified and the refund policy will be applied if the booking has already been paid.
          </DialogDescription>

          {cancelBookingTarget && (
            <div className="space-y-4 mt-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                <p className="font-semibold">Booking</p>
                <p>{cancelBookingTarget.bookingNumber} • {cancelBookingTarget.subject}</p>
                <p>{formatDateOnlyString(cancelBookingTarget.date, 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} • {cancelBookingTarget.startTime} – {cancelBookingTarget.endTime}</p>
                <p className="text-xs text-neutral-500 mt-1">Client: {cancelBookingTarget.client?.fullName || cancelBookingTarget.client?.email}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-[0.2em]">Reason for cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={4}
                  className="w-full mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a]"
                  placeholder="Tell the client why this appointment is being cancelled"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="rounded-none h-10 text-xs font-bold" onClick={() => { setCancelBookingTarget(null); setCancelReason(''); }}>
              Close
            </Button>
            <Button
              className="rounded-none h-10 text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              onClick={handleCancelBooking}
              disabled={actionLoading || !cancelReason.trim()}
            >
              {actionLoading ? 'Cancelling...' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
