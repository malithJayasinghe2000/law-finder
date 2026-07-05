import { useState } from 'react';
import { 
  CalendarDays, Clock, MapPin, Video, Star, XCircle, 
  AlertTriangle, CreditCard, Building2, Loader2, ImagePlus
} from 'lucide-react';
import MockHeader from '../MockHeader';

interface Booking {
  id: string;
  bookingNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: 'PHYSICAL' | 'ONLINE';
  meetingLink: string | null;
  officeAddress: string | null;
  subject: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'AWAITING_BANK_TRANSFER_VERIFICATION' | 'COMPLETED' | 'CANCELLED_BY_CLIENT';
  lawyerName: string;
  hasRated?: boolean;
}

export default function ClientConsultationsShowcase() {
  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: 'cbk-1',
      bookingNumber: 'BK-8824-A',
      date: 'July 10, 2026',
      startTime: '10:00 AM',
      endTime: '10:45 AM',
      mode: 'ONLINE',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      officeAddress: null,
      subject: 'Tenancy Lease Eviction Violation Review',
      status: 'CONFIRMED',
      lawyerName: 'Dr. Lakmal Perera'
    },
    {
      id: 'cbk-2',
      bookingNumber: 'BK-8825-B',
      date: 'July 12, 2026',
      startTime: '11:00 AM',
      endTime: '12:00 PM',
      mode: 'ONLINE',
      meetingLink: 'https://meet.google.com/xyz-pdqr-wuv',
      officeAddress: null,
      subject: 'Company Incorporation & Article Drafting Review',
      status: 'PENDING_PAYMENT',
      lawyerName: 'Anjali Senanayake'
    },
    {
      id: 'cbk-3',
      bookingNumber: 'BK-8819-F',
      date: 'July 15, 2026',
      startTime: '02:00 PM',
      endTime: '03:00 PM',
      mode: 'PHYSICAL',
      meetingLink: null,
      officeAddress: 'No 45, Court Road, Galle',
      subject: 'Land Partitioning Deed Execution Dispute',
      status: 'AWAITING_BANK_TRANSFER_VERIFICATION',
      lawyerName: 'Priyantha Fernando'
    },
    {
      id: 'cbk-4',
      bookingNumber: 'BK-8812-C',
      date: 'July 05, 2026',
      startTime: '04:00 PM',
      endTime: '04:30 PM',
      mode: 'ONLINE',
      meetingLink: 'https://meet.google.com/lmn-opqr-stu',
      officeAddress: null,
      subject: 'Mutual Divorce Agreement Settlement Review',
      status: 'COMPLETED',
      lawyerName: 'Nalinda Jayasinghe'
    }
  ]);

  const [activeTab, setActiveTab] = useState<string>('');
  const [cancelModal, setCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rateModal, setRateModal] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleStatusUpdate = (id: string, status: Booking['status']) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  const handleRatingSubmit = (id: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, hasRated: true } : b));
    setRateModal(null);
    setFeedback('');
  };

  const filteredBookings = bookings.filter(b => {
    if (!activeTab) return true;
    if (activeTab === 'CONFIRMED') return b.status === 'CONFIRMED';
    if (activeTab === 'PENDING_PAYMENT') return b.status === 'PENDING_PAYMENT';
    if (activeTab === 'AWAITING_BANK_TRANSFER_VERIFICATION') return b.status === 'AWAITING_BANK_TRANSFER_VERIFICATION';
    if (activeTab === 'COMPLETED') return b.status === 'COMPLETED';
    return true;
  });

  const getStatusBadgeStyle = (status: Booking['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      case 'PENDING_PAYMENT':
        return 'bg-amber-50 text-amber-600 border border-amber-100';
      case 'AWAITING_BANK_TRANSFER_VERIFICATION':
        return 'bg-blue-50 text-blue-600 border border-blue-100';
      case 'COMPLETED':
        return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
      case 'CANCELLED_BY_CLIENT':
        return 'bg-red-50 text-red-655 border border-red-100';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  const getStatusLabel = (status: Booking['status']) => {
    switch (status) {
      case 'CONFIRMED': return 'Upcoming';
      case 'PENDING_PAYMENT': return 'Pending Payment';
      case 'AWAITING_BANK_TRANSFER_VERIFICATION': return 'Awaiting Verification';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED_BY_CLIENT': return 'Cancelled';
      default: return status;
    }
  };

  return (
    <div className="w-full bg-[#faf8f5] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none">
      
      {/* Header */}
      <MockHeader activeTab="DASHBOARD" />

      {/* Consultations Page Content */}
      <div className="p-5 sm:p-6 space-y-5 max-h-[550px] overflow-y-auto">
        
        {/* Title */}
        <div className="flex items-center gap-3 border-b border-neutral-200 pb-3">
          <div className="flex h-9 w-9 items-center justify-center bg-[#0a0a0a] text-white shrink-0">
            <CalendarDays className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-normal tracking-tight text-neutral-900 leading-none">My Consultations</h1>
            <p className="text-[10px] text-neutral-450 mt-1 font-light">Track and join your advocate booking slots</p>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-1 border-b border-[#efeae0] overflow-x-auto scrollbar-none whitespace-nowrap">
          {[
            { value: '', label: 'All' },
            { value: 'CONFIRMED', label: 'Upcoming' },
            { value: 'PENDING_PAYMENT', label: 'Pending' },
            { value: 'AWAITING_BANK_TRANSFER_VERIFICATION', label: 'Awaiting' },
            { value: 'COMPLETED', label: 'Completed' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px shrink-0 ${
                activeTab === tab.value 
                  ? 'border-[#0a0a0a] text-neutral-900' 
                  : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Booking Cards List */}
        <div className="space-y-2.5">
          {filteredBookings.map((b) => (
            <div key={b.id} className="bg-white border border-neutral-150 p-4 rounded-none shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                
                <div className="flex-grow space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-mono text-neutral-400">{b.bookingNumber}</span>
                    <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold ${getStatusBadgeStyle(b.status)}`}>
                      {getStatusLabel(b.status)}
                    </span>
                    <span className="inline-flex items-center text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-neutral-200 bg-neutral-50 text-neutral-605 font-bold">
                      {b.mode === 'PHYSICAL' ? 'Physical' : 'Online'}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-neutral-900 whitespace-normal break-words line-clamp-2 leading-snug">{b.subject}</h3>
                  
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-500 font-light">
                    <span>Advocate: <strong className="text-neutral-700 font-semibold">{b.lawyerName}</strong></span>
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {b.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {b.startTime} – {b.endTime}</span>
                  </div>

                  {b.status === 'CONFIRMED' && b.mode === 'ONLINE' && b.meetingLink && (
                    <div className="mt-2 p-2 bg-blue-50/50 border border-blue-200 inline-flex items-center gap-2">
                      <Video className="w-3 h-3 text-blue-600" />
                      <a href={b.meetingLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 font-semibold underline">Join Google Meet</a>
                    </div>
                  )}

                  {b.status === 'CONFIRMED' && b.mode === 'PHYSICAL' && b.officeAddress && (
                    <div className="mt-2 p-2 bg-green-50/50 border border-green-200 inline-flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-green-600" />
                      <span className="text-[10px] text-green-800 font-light">{b.officeAddress}</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex flex-row flex-wrap sm:flex-col gap-1.5 items-center sm:items-end justify-start sm:justify-end w-full sm:w-auto mt-2 sm:mt-0">
                  {b.status === 'PENDING_PAYMENT' && (
                    <button 
                      onClick={() => setPaymentModal(b.id)}
                      className="bg-blue-600 text-white hover:bg-blue-700 text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-none flex items-center gap-1 shadow-sm"
                    >
                      <CreditCard className="w-3 h-3" /> Submit Payment
                    </button>
                  )}
                  {['PENDING_PAYMENT', 'CONFIRMED', 'AWAITING_BANK_TRANSFER_VERIFICATION'].includes(b.status) && (
                    <button 
                      onClick={() => setCancelModal(b.id)}
                      className="border border-red-200 text-red-600 hover:bg-red-50 text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-none flex items-center gap-1"
                    >
                      <XCircle className="w-3 h-3" /> Cancel
                    </button>
                  )}
                  {b.status === 'COMPLETED' && !b.hasRated && (
                    <button 
                      onClick={() => setRateModal(b.id)}
                      className="bg-amber-500 text-white hover:bg-amber-600 text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-none flex items-center gap-1 shadow-sm"
                    >
                      <Star className="w-3 h-3" /> Rate Counsel
                    </button>
                  )}
                  {b.status === 'COMPLETED' && b.hasRated && (
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                      ★ Rating Submitted
                    </span>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full shadow-2xl p-5 border border-neutral-200">
            <h2 className="text-sm font-bold flex items-center gap-2 text-neutral-900 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Cancel Consultation Booking
            </h2>
            <div className="p-3 bg-amber-50 border border-amber-200 text-[10px] text-amber-800 space-y-1 mb-3">
              <p className="font-semibold">Cancellation Retainer Guidelines</p>
              <p>• Cancel 24+ hours before: Full deposit return</p>
              <p>• Less than 24 hours: 50% late notice fee deduction</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-neutral-450 uppercase mb-1">Reason for cancellation *</label>
                <textarea 
                  value={cancelReason} 
                  onChange={e => setCancelReason(e.target.value)}
                  rows={2} 
                  placeholder="Explain why you need to cancel..." 
                  className="w-full border border-neutral-200 px-3 py-2 text-xs focus:outline-none focus:border-black rounded-none resize-none" 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCancelModal(null)} 
                  className="flex-1 border border-neutral-250 py-2 font-bold text-[9px] uppercase tracking-wider hover:bg-neutral-50"
                >
                  Keep Booking
                </button>
                <button 
                  onClick={() => {
                    handleStatusUpdate(cancelModal, 'CANCELLED_BY_CLIENT');
                    setCancelModal(null);
                    setCancelReason('');
                  }}
                  className="flex-1 bg-red-655 text-white hover:bg-red-700 py-2 font-bold text-[9px] uppercase tracking-wider"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Modal */}
      {rateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full shadow-2xl p-5 border border-neutral-200 text-center">
            <h2 className="text-sm font-bold text-neutral-900 mb-3 flex items-center justify-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Rate Legal Counsel
            </h2>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((v) => (
                <button 
                  key={v} 
                  onClick={() => setRating(v)} 
                  className={`text-2xl transition-transform hover:scale-110 ${v <= rating ? 'text-amber-400' : 'text-neutral-200'}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea 
              value={feedback} 
              onChange={e => setFeedback(e.target.value)}
              rows={2} 
              placeholder="Share details of your experience (optional)..." 
              className="w-full border border-neutral-200 px-3 py-2 text-xs focus:outline-none focus:border-black rounded-none resize-none mb-4" 
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setRateModal(null)} 
                className="flex-1 border border-neutral-250 py-2 font-bold text-[9px] uppercase tracking-wider hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleRatingSubmit(rateModal)}
                className="flex-1 bg-[#0a0a0a] text-white hover:bg-neutral-800 py-2 font-bold text-[9px] uppercase tracking-wider"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full shadow-2xl p-5 border border-neutral-200">
            <div className="flex justify-between items-center border-b border-neutral-200 pb-2 mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-neutral-900 leading-none">
                <Building2 className="w-4.5 h-4.5 text-neutral-800" /> Submit Bank Transfer Details
              </h2>
              <button onClick={() => setPaymentModal(null)} className="text-neutral-400 hover:text-neutral-600 text-xs font-bold font-mono">X</button>
            </div>

            <div className="space-y-3.5">
              <div className="bg-amber-50 border border-amber-250 p-3 text-[10px] text-amber-850 space-y-1">
                <p className="font-bold">Instructions:</p>
                <p>Transfer deposit to the escrow account below, then input references to verify settlement.</p>
                <ul className="font-mono text-[9.5px] mt-1 space-y-0.5">
                  <li>Bank: Commercial Bank PLC</li>
                  <li>Account Name: FindLawyer Platform Trust</li>
                  <li>Account No: 1234567890</li>
                  <li>Branch: Colombo Fort (001)</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-neutral-500 uppercase">Your Bank Name</label>
                  <input 
                    value={bankName} 
                    onChange={e => setBankName(e.target.value)} 
                    className="w-full h-8 border border-neutral-300 px-2 text-xs focus:outline-none focus:border-black rounded-none" 
                    placeholder="e.g. HNB" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-neutral-500 uppercase">Account Holder Name</label>
                  <input 
                    value={accountHolder} 
                    onChange={e => setAccountHolder(e.target.value)} 
                    className="w-full h-8 border border-neutral-300 px-2 text-xs focus:outline-none focus:border-black rounded-none" 
                    placeholder="e.g. S. Silva" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-bold text-neutral-500 uppercase">Transaction Reference Number</label>
                <input 
                  value={transactionRef} 
                  onChange={e => setTransactionRef(e.target.value)} 
                  className="w-full h-8 border border-neutral-300 px-2 text-xs focus:outline-none focus:border-black rounded-none" 
                  placeholder="e.g. TXN-10023491-SL" 
                />
              </div>

              <div>
                <label className="block text-[8px] font-bold text-neutral-500 uppercase mb-1">Receipt Image Attachment (optional)</label>
                {receiptUploaded ? (
                  <div className="border border-neutral-200 p-2.5 flex items-center justify-between text-[10px] bg-neutral-50">
                    <span className="font-semibold text-neutral-700">receipt_copy.png</span>
                    <button 
                      onClick={() => setReceiptUploaded(false)}
                      className="text-red-500 hover:text-red-750 font-bold uppercase tracking-widest text-[8px]"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setUploading(true);
                      setTimeout(() => {
                        setUploading(false);
                        setReceiptUploaded(true);
                      }, 800);
                    }}
                    disabled={uploading}
                    className="flex items-center justify-center gap-1.5 w-full py-3 border border-dashed border-neutral-300 text-neutral-450 hover:border-neutral-400 hover:text-neutral-700 text-xs transition-colors rounded-none bg-white"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 text-[#bfa37a]" />}
                    <span>{uploading ? 'Attaching file...' : 'Attach copy of deposit slip'}</span>
                  </button>
                )}
              </div>

              <button 
                onClick={() => {
                  handleStatusUpdate(paymentModal, 'AWAITING_BANK_TRANSFER_VERIFICATION');
                  setPaymentModal(null);
                  setBankName('');
                  setAccountHolder('');
                  setTransactionRef('');
                  setReceiptUploaded(false);
                }}
                disabled={!bankName || !accountHolder || !transactionRef}
                className="w-full bg-[#0a0a0a] text-white hover:bg-neutral-800 disabled:opacity-50 py-2.5 font-bold text-[9px] uppercase tracking-wider"
              >
                Submit Payment Verification
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
