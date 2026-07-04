import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { 
  CalendarDays, Clock, MapPin, Video, User, CheckCircle, 
  XCircle, Eye, RefreshCw
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
  const [activeTab, setActiveTab] = useState<string>('CONFIRMED'); // Defaults to showing CONFIRMED/Upcoming
  const [key, setKey] = useState(0);

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
        <div className="md:col-span-9 p-6 bg-neutral-50 flex flex-col gap-6 max-h-[520px] overflow-y-auto">
          
          {/* Header section matching exact dashboard style */}
          <div className="flex items-center justify-between border-b border-neutral-250 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white shrink-0">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-normal tracking-tight text-neutral-900 leading-none">Consultation Bookings</h1>
                <p className="text-xs text-neutral-455 mt-1 font-light">Manage your client consultation appointments</p>
              </div>
            </div>

            <button 
              onClick={() => setKey(prev => prev + 1)}
              className="p-2 rounded bg-white border border-neutral-200 hover:border-gold/30 text-neutral-450 hover:bg-[#030303] hover:text-white transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
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
                  className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
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

          {/* Bookings List */}
          <div className="space-y-3.5 flex-grow">
            <AnimatePresence mode="popLayout">
              {bookings
                .filter(b => activeTab === 'All' || b.status === activeTab || (activeTab === 'CONFIRMED' && b.status === 'PENDING_PAYMENT'))
                .map((booking) => (
                  <motion.div 
                    key={booking.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white border border-neutral-150 p-5 rounded-none shadow-sm hover:shadow-md transition-shadow relative"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      
                      <div className="flex-grow space-y-2 min-w-0">
                        {/* Meta tags top */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-neutral-400">{booking.bookingNumber}</span>
                          <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold ${getStatusBadgeStyle(booking.status)}`}>
                            {getStatusLabel(booking.status)}
                          </span>
                          <span className="inline-flex items-center text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm border border-neutral-200 bg-neutral-50 text-neutral-600 font-bold">
                            {booking.mode === 'PHYSICAL' ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-neutral-400" /> Physical
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Video className="w-2.5 h-2.5 text-neutral-400" /> Online
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Subject */}
                        <h3 className="text-sm font-bold text-neutral-900 truncate leading-snug">
                          {booking.subject}
                        </h3>

                        {/* Detail parameters bottom */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 font-light">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-neutral-400" />
                            {booking.clientName}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5 text-neutral-400" />
                            {booking.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            {booking.startTime} – {booking.endTime}
                          </span>
                        </div>
                      </div>

                      {/* Right fees parameters and action triggers */}
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-base font-bold text-neutral-900 leading-none">
                          Rs. {booking.lawyerFee.toLocaleString('en-US')}
                        </p>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider mt-1">Your fee</p>

                        <div className="flex gap-1.5 mt-4">
                          {booking.status === 'PENDING_PAYMENT' && (
                            <button className="h-7 border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-bold uppercase tracking-wider px-3 rounded-none transition-colors flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-red-500" /> Cancel
                            </button>
                          )}
                          {booking.status === 'CONFIRMED' && (
                            <>
                              <button className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 rounded-none transition-all flex items-center gap-1 shadow-sm">
                                <CheckCircle className="w-3 h-3 text-white" /> Complete
                              </button>
                              <button className="h-7 border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-bold uppercase tracking-wider px-3 rounded-none transition-colors flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-red-500" /> Cancel
                              </button>
                            </>
                          )}
                          <button className="h-7 border border-neutral-250 hover:bg-neutral-50 text-neutral-700 text-[10px] font-bold uppercase tracking-wider px-3 rounded-none transition-all flex items-center gap-1">
                            <Eye className="w-3 h-3 text-neutral-400" /> Details
                          </button>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>

        </div>

      </div>

    </div>
  );
}
