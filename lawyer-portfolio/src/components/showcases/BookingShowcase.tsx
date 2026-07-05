import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { 
  CalendarDays, Clock, MapPin, Video, User, CheckCircle, 
  XCircle, Eye, RefreshCw, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import MockDashboardSidebar from '../MockDashboardSidebar';
import MockDashboardHeader from '../MockDashboardHeader';

interface Booking {
  id: string;
  bookingNumber: string;
  subject: string;
  clientName: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: 'PHYSICAL' | 'ONLINE';
  lawyerFee: number;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED_BY_CLIENT';
}

export default function BookingShowcase() {
  const initialBookings: Booking[] = [
    {
      id: 'bk-1',
      bookingNumber: 'BK-8824-A',
      subject: 'Tenancy Lease Clause 12 Eviction Violation Review',
      clientName: 'Sandamal Silva',
      date: 'July 10, 2026',
      startTime: '10:00 AM',
      endTime: '10:45 AM',
      mode: 'ONLINE',
      lawyerFee: 12000,
      status: 'PENDING_PAYMENT' // Will animate to CONFIRMED
    },
    {
      id: 'bk-2',
      bookingNumber: 'BK-8819-F',
      subject: 'Property Deed Execution & Boundary Survey Dispute',
      clientName: 'Sashini Fonseka',
      date: 'July 08, 2026',
      startTime: '02:00 PM',
      endTime: '03:00 PM',
      mode: 'PHYSICAL',
      lawyerFee: 15000,
      status: 'COMPLETED'
    },
    {
      id: 'bk-3',
      bookingNumber: 'BK-8812-C',
      subject: 'Corporate Compliance Board Retainer Audit',
      clientName: 'Devinda Alwis',
      date: 'July 05, 2026',
      startTime: '04:00 PM',
      endTime: '04:30 PM',
      mode: 'ONLINE',
      lawyerFee: 8000,
      status: 'CANCELLED_BY_CLIENT'
    }
  ];

  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [activeTab, setActiveTab] = useState<string>('All'); // Set default to All to view multiple items easily
  const [key, setKey] = useState(0);

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 6, 1)); // Default to July 2026 for showcase
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Date Parsing Helpers
  const getFormattedDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getBookingDateString = (dateStr: string) => {
    const months: Record<string, string> = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    const parts = dateStr.replace(',', '').split(' ');
    if (parts.length < 3) return '';
    const month = months[parts[0]] || '07';
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  };

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatDateLabelShort = (dateStr: string) => {
    // 'July 10, 2026' -> 'Jul 10, 2026'
    return dateStr.replace('July', 'Jul');
  };

  // Calendar Navigation Handlers
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

  const bookingsByDate = bookings.reduce((acc: Record<string, Booking[]>, booking) => {
    const dateStr = getBookingDateString(booking.date);
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(booking);
    return acc;
  }, {});

  const handleStatusChange = (bookingId: string, newStatus: Booking['status']) => {
    setBookings(prev => 
      prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
    );
  };


  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!isInView) return;

    let active = true;
    setBookings(initialBookings);

    const runSimulation = async () => {
      // 1. Wait 2.0s
      await new Promise(r => setTimeout(r, 2000));
      if (!active) return;

      // 2. Simulate incoming payment confirmation -> change status of bk-1 to CONFIRMED
      await new Promise(r => setTimeout(r, 800));
      if (!active) return;
      
      setBookings(prev => 
        prev.map(b => b.id === 'bk-1' ? { ...b, status: 'CONFIRMED' } : b)
      );
    };

    runSimulation();

    return () => {
      active = false;
    };
  }, [isInView, key]);

  const getStatusBadgeStyle = (status: Booking['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      case 'PENDING_PAYMENT':
        return 'bg-amber-50 text-amber-600 border border-amber-100';
      case 'COMPLETED':
        return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
      case 'CANCELLED_BY_CLIENT':
        return 'bg-red-50 text-red-600 border border-red-100';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  const getStatusLabel = (status: Booking['status']) => {
    switch (status) {
      case 'CONFIRMED': return 'Upcoming';
      case 'PENDING_PAYMENT': return 'Pending';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED_BY_CLIENT': return 'Cancelled by Client';
      default: return status;
    }
  };

  const filteredBookings = bookings.filter(b => {
    const statusMatch = activeTab === 'All' || b.status === activeTab || (activeTab === 'CONFIRMED' && b.status === 'PENDING_PAYMENT');
    if (selectedDate) {
      const selDateStr = getFormattedDateString(selectedDate);
      const bookingDateStr = getBookingDateString(b.date);
      return statusMatch && bookingDateStr === selDateStr;
    }
    return statusMatch;
  });

  return (
    <div 
      ref={containerRef}
      className="w-full bg-[#fbf9f6] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none"
    >
      
      {/* Lawyer Dashboard Top bar */}
      <MockDashboardHeader title="Lawyer Portal" />

      {/* Main dashboard splits */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-grow min-h-[500px]">
        
        {/* LEFT COLUMN: Sidebar */}
        <div className="md:col-span-3">
          <MockDashboardSidebar activeTab="Bookings" />
        </div>

        {/* RIGHT COLUMN: Bookings manager */}
        <div className="md:col-span-9 p-4 bg-neutral-50 flex flex-col gap-4 max-h-[520px] overflow-y-auto">
          
          {/* Header section matching exact dashboard style */}
          <div className="flex items-center justify-between border-b border-neutral-250 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center bg-[#0a0a0a] text-white shrink-0">
                <CalendarDays className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-normal tracking-tight text-neutral-900 leading-none">Consultation Bookings</h1>
                <p className="text-[11px] text-neutral-455 mt-1 font-light">Manage your client consultation appointments</p>
              </div>
            </div>

            <button 
              onClick={() => {
                setKey(prev => prev + 1);
                setSelectedDate(null);
                setSelectedBooking(null);
              }}
              className="p-1.5 rounded bg-white border border-neutral-200 hover:border-gold/30 text-neutral-450 hover:bg-[#030303] hover:text-white transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider shadow-sm"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Replay</span>
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-1 border-b border-neutral-200 shrink-0">
            {['All', 'CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED'].map((tabValue) => {
              const label = tabValue === 'All' ? 'All' : tabValue === 'CONFIRMED' ? 'Upcoming' : tabValue === 'PENDING_PAYMENT' ? 'Pending' : 'Completed';
              const isActive = activeTab === tabValue || (tabValue === 'All' && activeTab === '');
              return (
                <button
                  key={tabValue}
                  onClick={() => setActiveTab(tabValue)}
                  className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                    isActive 
                      ? 'border-[#0a0a0a] text-neutral-900' 
                      : 'border-transparent text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Sub-grid split for List & Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow items-start">
            
            {/* BOOKINGS LIST (Left Column) */}
            <div className="lg:col-span-8 space-y-3">
              
              {/* Active Date Filter Alert */}
              {selectedDate && (
                <div className="flex items-center justify-between bg-[#bfa37a]/5 border border-[#bfa37a]/20 text-[#8c6d3f] p-3 text-[11px] font-semibold rounded-none shrink-0 mb-2">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-[#bfa37a]" />
                    Viewing: {formatDateLabel(selectedDate)}
                  </span>
                  <button 
                    onClick={() => setSelectedDate(null)} 
                    className="text-[9px] font-bold uppercase tracking-widest bg-[#0a0a0a] text-white px-1.5 py-0.5 hover:bg-neutral-800 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Bookings List Content */}
              <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {filteredBookings.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-neutral-200 bg-white/50">
                      <CalendarDays className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-neutral-900">No bookings found</p>
                      <p className="text-[10px] text-neutral-450 mt-0.5">Try changing your filters or choosing another date</p>
                    </div>
                  ) : (
                    filteredBookings.map((booking) => (
                      <motion.div 
                        key={booking.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white border border-neutral-150 p-3.5 rounded-none shadow-xs hover:shadow-sm transition-shadow relative"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          
                          <div className="flex-grow space-y-1.5 min-w-0">
                            {/* Meta tags top */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-mono text-neutral-400">{booking.bookingNumber}</span>
                              <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold ${getStatusBadgeStyle(booking.status)}`}>
                                {getStatusLabel(booking.status)}
                              </span>
                              <span className="inline-flex items-center text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-neutral-200 bg-neutral-50 text-neutral-600 font-bold">
                                {booking.mode === 'PHYSICAL' ? 'Physical' : 'Online'}
                              </span>
                            </div>

                            {/* Subject */}
                            <h3 className="text-xs font-bold text-neutral-900 truncate leading-snug">
                              {booking.subject}
                            </h3>

                            {/* Detail parameters bottom */}
                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-500 font-light">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-neutral-400" />
                                {booking.clientName}
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3 h-3 text-neutral-400" />
                                {formatDateLabelShort(booking.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-neutral-400" />
                                {booking.startTime} – {booking.endTime}
                              </span>
                            </div>
                          </div>

                          {/* Right fees parameters and action triggers */}
                          <div className="text-left sm:text-right shrink-0">
                            <p className="text-sm font-bold text-neutral-900 leading-none">
                              Rs. {booking.lawyerFee.toLocaleString('en-US')}
                            </p>
                            <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">Your fee</p>

                            <div className="flex gap-1 mt-2.5 flex-wrap sm:justify-end">
                              {booking.status === 'PENDING_PAYMENT' && (
                                <button 
                                  onClick={() => handleStatusChange(booking.id, 'CANCELLED_BY_CLIENT')}
                                  className="h-6 border border-red-200 text-red-600 hover:bg-red-50 text-[9px] font-bold uppercase tracking-wider px-2 rounded-none transition-colors flex items-center gap-1"
                                >
                                  <XCircle className="w-2.5 h-2.5 text-red-500" /> Cancel
                                </button>
                              )}
                              {booking.status === 'CONFIRMED' && (
                                <>
                                  <button 
                                    onClick={() => handleStatusChange(booking.id, 'COMPLETED')}
                                    className="h-6 bg-[#bfa37a] hover:bg-[#bfa37a]/90 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 rounded-none transition-all flex items-center gap-1 shadow-sm"
                                  >
                                    <CheckCircle className="w-2.5 h-2.5 text-white" /> Complete
                                  </button>
                                  <button 
                                    onClick={() => handleStatusChange(booking.id, 'CANCELLED_BY_CLIENT')}
                                    className="h-6 border border-red-200 text-red-600 hover:bg-red-50 text-[9px] font-bold uppercase tracking-wider px-2 rounded-none transition-colors flex items-center gap-1"
                                  >
                                    <XCircle className="w-2.5 h-2.5 text-red-500" /> Cancel
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={() => setSelectedBooking(booking)}
                                className="h-6 border border-neutral-250 hover:bg-neutral-50 text-neutral-700 text-[9px] font-bold uppercase tracking-wider px-2 rounded-none transition-all flex items-center gap-1"
                              >
                                <Eye className="w-2.5 h-2.5 text-neutral-400" /> Details
                              </button>
                            </div>
                          </div>

                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* CALENDAR & SCHEDULE TIMELINE (Right Column) */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Calendar Container */}
              <div className="bg-white border border-neutral-200 shadow-sm p-4 text-left">
                {/* Month Selector Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100">
                  <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-widest">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex gap-1">
                    <button 
                      onClick={handlePrevMonth} 
                      className="h-7 w-7 rounded-none border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4 text-neutral-600" />
                    </button>
                    <button 
                      onClick={handleNextMonth} 
                      className="h-7 w-7 rounded-none border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 text-neutral-600" />
                    </button>
                  </div>
                </div>

                {/* Week Header */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider py-1">
                      {d.slice(0, 1)}
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
                          }
                        }}
                        disabled={!day.isCurrentMonth}
                        className={`aspect-square w-full flex flex-col items-center justify-between py-1 text-[10px] font-bold transition-all duration-200 ${
                          !day.isCurrentMonth 
                            ? 'text-neutral-200 cursor-default opacity-30' 
                            : active 
                              ? 'bg-[#0a0a0a] text-white hover:bg-neutral-800' 
                              : today 
                                ? 'border border-[#bfa37a] bg-[#bfa37a]/5 text-neutral-900 hover:bg-neutral-50' 
                                : 'text-neutral-800 hover:bg-neutral-100'
                        }`}
                      >
                        <span className="mt-0.5">{day.date.getDate()}</span>
                        <span className={`w-1 h-1 rounded-full shrink-0 ${
                          day.isCurrentMonth && dayBookings.length > 0 ? 'bg-[#bfa37a]' : 'bg-transparent'
                        }`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day Timeline / Schedule */}
              {selectedDate && (
                <div className="bg-white border border-neutral-200 shadow-sm p-4 text-left">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5 mb-3">
                    <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest">
                      Schedule: {formatDateLabelShort(getFormattedDateString(selectedDate))}
                    </h3>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="text-[9px] font-bold uppercase tracking-widest text-[#bfa37a] hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-none">
                    {bookingsByDate[getFormattedDateString(selectedDate)]?.length > 0 ? (
                      bookingsByDate[getFormattedDateString(selectedDate)]
                        .sort((a, b) => a.startTime.localeCompare(b.startTime))
                        .map((booking) => (
                          <div 
                            key={booking.id} 
                            onClick={() => setSelectedBooking(booking)}
                            className="p-2.5 border border-neutral-100 hover:bg-neutral-50 hover:border-neutral-200 transition-all flex items-start justify-between gap-2 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-neutral-900 truncate">{booking.subject}</p>
                              <p className="text-[9px] text-neutral-500 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#bfa37a]" />
                                {booking.startTime} - {booking.endTime}
                              </p>
                              <p className="text-[9px] text-neutral-400 mt-0.5 truncate">
                                Client: {booking.clientName}
                              </p>
                            </div>
                            <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold shrink-0 ${getStatusBadgeStyle(booking.status)}`}>
                              {getStatusLabel(booking.status)}
                            </span>
                          </div>
                        ))
                    ) : (
                      <p className="text-[10px] text-neutral-450 text-center py-4">No appointments scheduled</p>
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div 
          className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4" 
          onClick={() => setSelectedBooking(null)}
        >
          <div 
            className="bg-white border border-neutral-200 max-w-md w-full shadow-2xl overflow-hidden text-left" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-neutral-200 flex items-center justify-between bg-[#fbf9f6]">
              <div>
                <span className="text-[10px] font-mono text-neutral-400">{selectedBooking.bookingNumber}</span>
                <h2 className="text-base font-serif font-bold text-neutral-900 mt-0.5">Booking Details</h2>
              </div>
              <button 
                onClick={() => setSelectedBooking(null)} 
                className="text-neutral-400 hover:text-neutral-600 p-1 bg-white border border-neutral-200 rounded-none shadow-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Client</p>
                  <p className="font-bold text-neutral-800 mt-0.5">{selectedBooking.clientName}</p>
                </div>
                <div>
                  <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Status</p>
                  <span className={`inline-block text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold mt-1 ${getStatusBadgeStyle(selectedBooking.status)}`}>
                    {getStatusLabel(selectedBooking.status)}
                  </span>
                </div>
                <div>
                  <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Date</p>
                  <p className="font-bold text-neutral-800 mt-0.5">{selectedBooking.date}</p>
                </div>
                <div>
                  <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Time</p>
                  <p className="font-bold text-neutral-800 mt-0.5">{selectedBooking.startTime} – {selectedBooking.endTime}</p>
                </div>
                <div>
                  <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Mode</p>
                  <span className="inline-flex items-center text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm border border-neutral-200 bg-neutral-50 text-neutral-600 font-bold mt-1">
                    {selectedBooking.mode === 'PHYSICAL' ? 'Physical' : 'Online'}
                  </span>
                </div>
                <div>
                  <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Lawyer Fee</p>
                  <p className="font-bold text-neutral-900 mt-0.5">Rs. {selectedBooking.lawyerFee.toLocaleString('en-US')}</p>
                </div>
              </div>
              
              <div className="pt-3 border-t border-neutral-100">
                <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Subject</p>
                <p className="font-bold text-neutral-800 mt-0.5 leading-snug">{selectedBooking.subject}</p>
              </div>

              {selectedBooking.mode === 'ONLINE' && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 flex flex-col gap-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#bfa37a]">Meeting Connection</p>
                  <p className="text-[11px] font-light text-neutral-500">A protected digital consultation link will be available prior to meeting schedule.</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button 
                onClick={() => setSelectedBooking(null)} 
                className="bg-[#0a0a0a] hover:bg-neutral-800 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
