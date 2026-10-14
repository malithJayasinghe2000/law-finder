'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
import { BOOKING_STATUS_COLORS, FIRM_STATUS_LABELS } from '@/schemas/consultation.schema';
import { ShieldCheck, Banknote, UserX, UserCheck, Receipt, UserPlus, MessageSquare } from 'lucide-react';
import { firmMayMessageClient } from '@/lib/consultations/bookingStatus';
import type { BookingStatus } from '@prisma/client';
import { AssignMatterDialog } from '@/components/firms/AssignMatterDialog';
import { formatDateOnlyString } from '@/lib/utils';
import ConflictCheckDialog from '@/components/consultations/ConflictCheckDialog';
import QuoteComposerDialog from '@/components/consultations/QuoteComposerDialog';
import FeeNoteDialog from '@/components/consultations/FeeNoteDialog';
import PaymentReviewDialog from '@/components/consultations/PaymentReviewDialog';

// How a consultation would take place. BOTH used to show as "Online".
const MODE_LABELS: Record<string, string> = {
  PHYSICAL: 'In person',
  ONLINE: 'Online',
  BOTH: 'In person or online',
};

interface Booking {
  id: string;
  bookingNumber: string;
  /**
   * Null until an appointment exists. A matter that arrived through firm-first
   * intake has no slot: the client engaged the firm, and the attorney proposes a
   * time when quoting.
   */
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  lawyerId: string | null;
  mode: string;
  meetingLink: string | null;
  officeAddress: string | null;
  lawyerFee: number;
  totalAmount: number;
  subject: string;
  description: string;
  practiceArea: string | null;
  status: string;
  createdAt: string;
  client: { id: string; fullName: string | null; email: string; profileImageUrl: string | null };
  lawyer?: { fullName: string } | null;
  /** Firm side only: the last conflict-check outcome, if one was recorded. */
  conflictOutcome?: 'CLEAR' | 'CONFLICT_FOUND' | 'NEEDS_REVIEW' | null;
  payment: any;
  /**
   * What this member of the firm may do with this matter, decided server-side in
   * src/lib/firms/access.ts. Never re-derive it here — the UI hides what a
   * member cannot do, but the server is what actually refuses.
   */
  access?: {
    canReadMatterDetail: boolean;
    canAct: boolean;
    canAssign: boolean;
    basis: string;
  };
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

  // Accept Modal states
  const [conflictTarget, setConflictTarget] = useState<Booking | null>(null);
  const [paymentReview, setPaymentReview] = useState<Booking | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<Booking | null>(null);
  const [assignTarget, setAssignTarget] = useState<Booking | null>(null);
  const [feeNoteBooking, setFeeNoteBooking] = useState<Booking | null>(null);

  // Principals and practice managers can open a request for a client who came
  // to the practice directly. From membership, not role — see /api/firms/me.
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [canManageFirm, setCanManageFirm] = useState(false);
  const [openingChat, setOpeningChat] = useState<string | null>(null);

  // The assigned attorney messages the client about THIS request. The server
  // refuses a thread that is not tied to a live request the client sent.
  async function messageClient(booking: Booking) {
    setOpeningChat(booking.id);
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: booking.client.id, bookingId: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open the conversation');
      router.push(`/${locale}/dashboard/lawyer/chat?conv=${data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not open the conversation');
      setOpeningChat(null);
    }
  }
  useEffect(() => {
    fetch('/api/firms/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanManageFirm(!!d?.membership?.canManageFirm))
      .catch(() => {});
  }, []);

  // Verify Modal state

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarBookings, setCalendarBookings] = useState<Booking[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const [defaultBankName, setDefaultBankName] = useState('');
  const [defaultAccountName, setDefaultAccountName] = useState('');
  const [defaultAccountNumber, setDefaultAccountNumber] = useState('');
  const [defaultBankBranch, setDefaultBankBranch] = useState('');

  // Pre-fills the quote composer with the firm's own account details. The client
  // pays the firm directly — see docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
  const defaultPaymentInstructions = [
    defaultBankName && `Bank: ${defaultBankName}`,
    defaultAccountName && `Account name: ${defaultAccountName}`,
    defaultAccountNumber && `Account number: ${defaultAccountNumber}`,
    defaultBankBranch && `Branch: ${defaultBankBranch}`,
  ].filter(Boolean).join('\n');


  useEffect(() => { loadBookings(); }, [page, statusFilter, selectedDate]);
  useEffect(() => { loadCalendarBookings(); }, [currentMonth]);
  useEffect(() => { loadPricing(); }, []);

  // The quote's payment details come from the PRACTICE's bank details (My Firm →
  // Practice), not the attorney's own Pricing page. The client engages and pays
  // the firm; a pre-fill from an attorney's personal settings could send the fee
  // to a different account from the one on the firm's fee note.
  async function loadPricing() {
    try {
      const res = await fetch('/api/firms/me');
      const data = await res.json();
      if (data.firm) {
        setDefaultBankName(data.firm.bankName || '');
        setDefaultAccountName(data.firm.accountName || '');
        setDefaultAccountNumber(data.firm.accountNumber || '');
        setDefaultBankBranch(data.firm.bankBranch || '');
      }
    } catch (e) {
      console.error('Failed to load the practice bank details', e);
    }
  }

  const getFormattedDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  async function loadBookings() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope: 'firm', page: String(page), limit: '10' });
      if (statusFilter) params.set('status', statusFilter);
      if (selectedDate) {
        const dateStr = getFormattedDateString(selectedDate);
        params.set('dateFrom', dateStr);
        params.set('dateTo', dateStr);
      }
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

  async function loadCalendarBookings() {
    setLoadingCalendar(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const dateFrom = getFormattedDateString(firstDay);
      const dateTo = getFormattedDateString(lastDay);
      
      const res = await fetch(`/api/consultations/bookings?scope=firm&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=100`);
      const data = await res.json();
      setCalendarBookings(data.bookings || []);
    } catch (e) {
      console.error('Failed to load calendar bookings', e);
    } finally {
      setLoadingCalendar(false);
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
        loadCalendarBookings();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  /**
   * A consultation can only be completed or marked as a no-show once it has
   * actually happened — otherwise a future booking could be closed off, which
   * misstates the record and invites the client to rate a meeting that never
   * occurred. Mirrors the server-side guard.
   */
  function hasTakenPlace(b: Booking): boolean {
    if (!b.date || !b.endTime) return false;
    return new Date(`${b.date}T${b.endTime}:00+05:30`).getTime() <= Date.now();
  }

  /**
   * A no-show can only be recorded once the appointment time has arrived and the
   * client has not. Mirrors the server-side guard on the `no_show` action, which
   * previously had no button at all — the state was unreachable from the UI.
   */
  function hasStarted(b: Booking): boolean {
    if (!b.date || !b.startTime) return false;
    return new Date(`${b.date}T${b.startTime}:00+05:30`).getTime() <= Date.now();
  }

  async function handleCancelBooking() {
    if (!cancelBookingTarget) return;
    if (cancelReason.trim().length < 5) {
      toast.error('Please provide a cancellation reason of at least 5 characters.');
      return;
    }

    await handleAction(cancelBookingTarget.id, 'cancel', { reason: cancelReason });
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); 
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    const days = [];
    
    // Fill the empty cells before the first day of the month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }
    
    // Fill the days of the current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Fill the remaining cells to complete the grid (42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelectedDate = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Matters with no appointment yet never appear on the calendar — there is no
  // day to put them on. They live in the list, in the firm's queue.
  const bookingsByDate = calendarBookings.reduce((acc: Record<string, Booking[]>, booking) => {
    const dateStr = booking.date;
    if (!dateStr) return acc;
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(booking);
    return acc;
  }, {});

  const statusTabs = [
    { value: '', label: 'All' },
    { value: 'REQUESTED', label: 'New requests' },
    { value: 'CONFLICT_CHECK', label: 'To quote' },
    { value: 'QUOTED', label: 'Awaiting client' },
    // Was 'CONFIRMED', which is not a status — the API refused it and the tab
    // was always empty.
    { value: 'SCHEDULED', label: 'Upcoming' },
    { value: 'ACCEPTED', label: 'Awaiting payment' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED_BY_CLIENT', label: 'Cancelled by Client' },
    { value: 'CANCELLED_BY_FIRM', label: 'Cancelled by me' },
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
        {canManageFirm && (
          <Link
            href={`/${locale}/dashboard/lawyer/consultations/new`}
            aria-label="New request"
            className="ml-auto inline-flex items-center gap-2 bg-[#0a0a0a] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors shrink-0"
          >
            <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">New request</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Bookings list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Date Filter Alert */}
          {selectedDate && (
            <div className="flex items-center justify-between bg-[#bfa37a]/5 border border-[#bfa37a]/20 text-[#8c6d3f] px-4 py-3 text-xs font-semibold rounded-none">
              <span className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#bfa37a]" />
                Viewing appointments on: {formatDateOnlyString(getFormattedDateString(selectedDate), 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <button 
                onClick={() => { setSelectedDate(null); setPage(1); }} 
                className="text-[10px] font-bold uppercase tracking-widest bg-[#0a0a0a] text-white px-2 py-1 hover:bg-neutral-800 transition-colors"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* Status Tabs */}
          <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto scrollbar-none">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors border-b-2 -mb-px shrink-0 ${statusFilter === tab.value ? 'border-[#0a0a0a] text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
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
                <Card key={booking.id} className="py-0 rounded-none shadow-sm hover:shadow-md transition-shadow border-neutral-200">
                  <CardContent className="p-5">
                    {/* Details on top, actions in their own row underneath — side by side,
                        the actions squeezed the details into one-word lines. */}
                    <div className="flex flex-col gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-neutral-400">{booking.bookingNumber}</span>
                          <Badge className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${BOOKING_STATUS_COLORS[booking.status] || 'bg-neutral-100 text-neutral-700'}`}>
                            {FIRM_STATUS_LABELS[booking.status] || booking.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] rounded-sm border-neutral-200">
                            {booking.mode === 'PHYSICAL' ? <MapPin className="w-3 h-3 mr-1" /> : <Video className="w-3 h-3 mr-1" />}
                            {MODE_LABELS[booking.mode] ?? booking.mode}
                          </Badge>
                          {!booking.lawyerId && (
                            <span className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-800">
                              Unassigned
                            </span>
                          )}
                          {booking.status === 'REQUESTED' && booking.conflictOutcome === 'NEEDS_REVIEW' && (
                            <span className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-800">
                              On hold
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-neutral-900 truncate">{booking.subject}</h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-neutral-500">
                          <span className="flex items-center gap-1 min-w-0">
                            <User className="w-3 h-3 shrink-0" />
                            <span className="truncate">{booking.client?.fullName || booking.client?.email}</span>
                          </span>
                          {booking.lawyer?.fullName && (
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <UserCheck className="w-3 h-3" />
                              {booking.lawyer.fullName}
                            </span>
                          )}
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <CalendarDays className="w-3 h-3" />
                            {booking.date
                              ? formatDateOnlyString(booking.date, 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                              : 'No appointment yet'}
                          </span>
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            {booking.startTime && booking.endTime
                              ? `${booking.startTime} – ${booking.endTime}`
                              : 'Time proposed with the quote'}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-neutral-100 pt-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {/* The conflict check and the quote are the assigned attorney's
                              own professional acts — the server refuses anyone else, so the
                              buttons are shown only to them. Until someone is assigned, the
                              principal sees a prompt to assign instead. */}
                          {!booking.lawyerId && booking.access?.canAssign &&
                            (booking.status === 'REQUESTED' || booking.status === 'CONFLICT_CHECK') && (
                            <span className="mr-auto text-[10px] font-semibold text-amber-800">
                              Assign an attorney first
                            </span>
                          )}
                          {booking.status === 'REQUESTED' && booking.access?.basis === 'ASSIGNED_ATTORNEY' && (
                            <Button
                              size="sm"
                              onClick={() => setConflictTarget(booking)}
                              disabled={actionLoading}
                              className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-7 text-[10px] px-2.5 font-bold"
                            >
                              <ShieldCheck className="w-3 h-3 mr-1" /> Review request
                            </Button>
                          )}
                          {booking.status === 'CONFLICT_CHECK' && booking.access?.basis === 'ASSIGNED_ATTORNEY' && (
                            <Button
                              size="sm"
                              onClick={() => setQuoteTarget(booking)}
                              disabled={actionLoading}
                              className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-7 text-[10px] px-2.5 font-bold"
                            >
                              <FileText className="w-3 h-3 mr-1" /> Quote a fee
                            </Button>
                          )}
                          {booking.status === 'QUOTED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setQuoteTarget(booking)}
                              disabled={actionLoading}
                              className="rounded-none h-7 text-[10px] px-2.5 font-bold"
                            >
                              <FileText className="w-3 h-3 mr-1" /> Re-quote
                            </Button>
                          )}
                          {booking.status === 'ACCEPTED' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => setPaymentReview(booking)}
                                disabled={actionLoading}
                                className="bg-green-600 text-white hover:bg-green-700 rounded-none h-7 text-[10px] px-2.5 font-bold"
                              >
                                <Banknote className="w-3 h-3 mr-1" /> Review payment
                              </Button>
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
                            </>
                          )}
                          {booking.status === 'SCHEDULED' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAction(booking.id, 'complete')}
                                disabled={actionLoading || !hasTakenPlace(booking)}
                                title={hasTakenPlace(booking) ? undefined : 'Available once the consultation has taken place'}
                                className="bg-green-600 text-white hover:bg-green-700 rounded-none h-7 text-[10px] px-2.5 font-bold disabled:opacity-40"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" /> Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(booking.id, 'no_show')}
                                disabled={actionLoading || !hasStarted(booking)}
                                title={hasStarted(booking) ? 'Record that the client did not attend' : 'Available once the appointment time has passed'}
                                className="rounded-none h-7 text-[10px] px-2.5 font-bold border-neutral-300 disabled:opacity-40"
                              >
                                <UserX className="w-3 h-3 mr-1" /> No show
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
                          {['ACCEPTED', 'AWAITING_PAYMENT', 'SCHEDULED', 'COMPLETED'].includes(booking.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setFeeNoteBooking(booking)}
                              disabled={actionLoading}
                              title="Bill this client for the work — your firm's own fee note"
                              className="rounded-none h-7 text-[10px] px-2.5 font-bold border-neutral-300"
                            >
                              <Receipt className="w-3 h-3 mr-1" /> Fee note
                            </Button>
                          )}
                          {booking.access?.basis === 'ASSIGNED_ATTORNEY' &&
                            firmMayMessageClient(booking.status as BookingStatus) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => messageClient(booking)}
                              disabled={openingChat === booking.id}
                              className="rounded-none h-7 text-[10px] px-2.5 font-bold border-neutral-300"
                            >
                              <MessageSquare className="w-3 h-3 mr-1" /> Message client
                            </Button>
                          )}
                          {booking.access?.canAssign && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAssignTarget(booking)}
                              disabled={actionLoading}
                              className="rounded-none h-7 text-[10px] px-2.5 font-bold border-neutral-300"
                            >
                              <UserCheck className="w-3 h-3 mr-1" /> Assign
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedBooking(booking)}
                            className="rounded-none h-7 text-[10px] px-2.5 font-bold border-neutral-200"
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
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-none h-8 border-neutral-200">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-semibold text-neutral-600">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-none h-8 border-neutral-200">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Right Column: Calendar & Day Schedule */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-none border border-neutral-200 shadow-sm p-5 bg-white">
            {/* Calendar Month Selector */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-widest">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrevMonth} 
                  className="rounded-none h-8 w-8 p-0 border-neutral-200 hover:bg-neutral-50"
                >
                  <ChevronLeft className="h-4 w-4 text-neutral-600" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleNextMonth} 
                  className="rounded-none h-8 w-8 p-0 border-neutral-200 hover:bg-neutral-50"
                >
                  <ChevronRight className="h-4 w-4 text-neutral-600" />
                </Button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider py-1">
                  {d.slice(0, 1)} {/* Show single letter like S, M, T for super compact look */}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentMonth).map((day, idx) => {
                const dateStr = getFormattedDateString(day.date);
                const dayBookings = bookingsByDate[dateStr] || [];
                const active = isSelectedDate(day.date);
                const today = isToday(day.date);
                
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (day.isCurrentMonth) {
                        setSelectedDate(isSelectedDate(day.date) ? null : day.date);
                        setPage(1);
                      }
                    }}
                    disabled={!day.isCurrentMonth}
                    className={`aspect-square w-full flex flex-col items-center justify-center text-xs font-semibold relative transition-all duration-200 ${
                      !day.isCurrentMonth 
                        ? 'text-neutral-200 cursor-default opacity-40' 
                        : active 
                          ? 'bg-[#0a0a0a] text-white hover:bg-neutral-800' 
                          : today 
                            ? 'border-2 border-[#bfa37a] text-neutral-900 font-bold hover:bg-neutral-50' 
                            : 'text-neutral-800 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    <span>{day.date.getDate()}</span>
                    {day.isCurrentMonth && dayBookings.length > 0 && (
                      <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${active ? 'bg-[#bfa37a]' : 'bg-[#bfa37a]'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Selected Date Timeline/Schedule */}
          {selectedDate && (
            <Card className="rounded-none border border-neutral-200 shadow-sm p-5 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-widest">
                  Schedule: {formatDateOnlyString(getFormattedDateString(selectedDate), 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-[10px] font-bold uppercase tracking-widest text-[#bfa37a] hover:underline"
                >
                  Clear
                </button>
              </div>
              
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {bookingsByDate[getFormattedDateString(selectedDate)]?.length > 0 ? (
                  bookingsByDate[getFormattedDateString(selectedDate)]
                    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                    .map((booking) => (
                      <div key={booking.id} className="p-3 border border-neutral-100 hover:bg-neutral-50 transition-all flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">{booking.subject}</p>
                          <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#bfa37a]" />
                            {booking.startTime && booking.endTime ? `${booking.startTime} - ${booking.endTime}` : 'Time TBC'}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-0.5 truncate">
                            Client: {booking.client?.fullName || booking.client?.email}
                          </p>
                        </div>
                        <Badge className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 ${BOOKING_STATUS_COLORS[booking.status] || 'bg-neutral-100 text-neutral-700'}`}>
                          {FIRM_STATUS_LABELS[booking.status] || booking.status}
                        </Badge>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-neutral-450 text-center py-6">No appointments scheduled</p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

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
                <div><p className="text-neutral-500 text-xs">Status</p><Badge className={`text-[10px] ${BOOKING_STATUS_COLORS[selectedBooking.status]}`}>{FIRM_STATUS_LABELS[selectedBooking.status]}</Badge></div>
                <div><p className="text-neutral-500 text-xs">Date</p><p className="font-semibold">{selectedBooking.date ? formatDateOnlyString(selectedBooking.date, 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Not yet arranged'}</p></div>
                <div><p className="text-neutral-500 text-xs">Time</p><p className="font-semibold">{selectedBooking.startTime && selectedBooking.endTime ? `${selectedBooking.startTime} – ${selectedBooking.endTime}${selectedBooking.duration ? ` (${selectedBooking.duration} min)` : ''}` : 'Not yet arranged'}</p></div>
                <div><p className="text-neutral-500 text-xs">Mode</p><p className="font-semibold">{MODE_LABELS[selectedBooking.mode] ?? selectedBooking.mode}</p></div>
                {/* "Rs. 0" before any proposal read as a fee of nothing. */}
                {selectedBooking.status !== 'DECLINED' && (
                  <div>
                    <p className="text-neutral-500 text-xs">Fee</p>
                    <p className="font-semibold">
                      {selectedBooking.status === 'REQUESTED' || selectedBooking.status === 'CONFLICT_CHECK'
                        ? 'Not proposed yet'
                        : `Rs. ${selectedBooking.lawyerFee.toLocaleString()}`}
                    </p>
                  </div>
                )}
                <div><p className="text-neutral-500 text-xs">Attorney</p><p className="font-semibold">{selectedBooking.lawyer?.fullName ?? 'Not assigned yet'}</p></div>
                <div><p className="text-neutral-500 text-xs">Received</p><p className="font-semibold">{new Date(selectedBooking.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' })}</p></div>
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
                <p>{cancelBookingTarget.date ? `${formatDateOnlyString(cancelBookingTarget.date, 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} • ${cancelBookingTarget.startTime} – ${cancelBookingTarget.endTime}` : 'No appointment arranged yet'}</p>
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

      {/* Assignment — only a firm principal or practice manager sees this */}
      {assignTarget && (
        <AssignMatterDialog
          bookingId={assignTarget.id}
          bookingNumber={assignTarget.bookingNumber}
          clientName={assignTarget.client?.fullName || 'the client'}
          open={Boolean(assignTarget)}
          onOpenChange={(o) => { if (!o) setAssignTarget(null); }}
          onAssigned={() => { loadBookings(); loadCalendarBookings(); }}
        />
      )}

      {/* Conflict check — the firm screens before it can quote */}
      {conflictTarget && (
        <ConflictCheckDialog
          bookingId={conflictTarget.id}
          bookingNumber={conflictTarget.bookingNumber}
          clientName={conflictTarget.client?.fullName || conflictTarget.client?.email || 'Client'}
          subject={conflictTarget.subject}
          description={conflictTarget.description}
          open={Boolean(conflictTarget)}
          onOpenChange={(o) => { if (!o) setConflictTarget(null); }}
          onCompleted={() => { loadBookings(); loadCalendarBookings(); }}
        />
      )}

      {/* Payment review — only the firm can verify money reaching its own account */}
      {paymentReview && (
        <PaymentReviewDialog
          bookingId={paymentReview.id}
          bookingNumber={paymentReview.bookingNumber}
          clientName={paymentReview.client?.fullName || 'Client'}
          amount={paymentReview.totalAmount}
          payment={paymentReview.payment || null}
          open={Boolean(paymentReview)}
          onOpenChange={(o) => { if (!o) setPaymentReview(null); }}
          onCompleted={() => { loadBookings(); loadCalendarBookings(); }}
        />
      )}

      {/* Fee notes — the firm bills its own client. We render the document and
          are not in the transaction. See LEGAL-GUARDRAILS.md (rules 1, 2, 7). */}
      {feeNoteBooking && (
        <FeeNoteDialog
          bookingId={feeNoteBooking.id}
          canManage
          open={Boolean(feeNoteBooking)}
          onOpenChange={(o) => { if (!o) setFeeNoteBooking(null); }}
        />
      )}

      {/* Quote composer */}
      {quoteTarget && (
        <QuoteComposerDialog
          bookingId={quoteTarget.id}
          bookingNumber={quoteTarget.bookingNumber}
          clientName={quoteTarget.client?.fullName || 'Client'}
          defaultPaymentInstructions={defaultPaymentInstructions}
          needsAppointment={!quoteTarget.date || !quoteTarget.startTime || !quoteTarget.endTime}
          open={Boolean(quoteTarget)}
          onOpenChange={(o) => { if (!o) setQuoteTarget(null); }}
          onCompleted={() => { loadBookings(); loadCalendarBookings(); }}
        />
      )}

    </div>
  );
}
