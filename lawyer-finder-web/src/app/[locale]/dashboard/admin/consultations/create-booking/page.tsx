'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Phone, CalendarDays, Clock, MapPin, Video, CheckCircle, Search, UserPlus, Loader2, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Lawyer {
  id: string;
  fullName: string;
  district: string | null;
  contactPhone: string | null;
}

interface Slot {
  startTime: string;
  endTime: string;
  duration: number;
  mode: string;
  isAvailable: boolean;
  isCallToBook: boolean;
}

export default function AdminCreateBookingPage() {
  const params = useParams();
  const locale = params?.locale || 'en';

  // Step state
  const [step, setStep] = useState(1); // 1: Select Lawyer, 2: Select Client, 3: Select Slot, 4: Booking Details, 5: Confirm

  // Lawyer
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [lawyerSearch, setLawyerSearch] = useState('');
  const [selectedLawyer, setSelectedLawyer] = useState<Lawyer | null>(null);
  const [lawyersLoading, setLawyersLoading] = useState(true);

  // Client
  const [clientEmail, setClientEmail] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientSearching, setClientSearching] = useState(false);

  // Slot
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Booking Details
  const [mode, setMode] = useState<'PHYSICAL' | 'ONLINE'>('PHYSICAL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [practiceArea, setPracticeArea] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'CONFIRMED' | 'PENDING_PAYMENT'>('CONFIRMED');
  const [adminNotes, setAdminNotes] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<any>(null);

  // Load lawyers on mount
  useEffect(() => {
    loadLawyers();
  }, []);

  // Search clients when typing
  useEffect(() => {
    if (clientSearch.length >= 3) {
      searchClients(clientSearch);
    } else {
      setClientResults([]);
    }
  }, [clientSearch]);

  // Load slots when date or lawyer changes
  useEffect(() => {
    if (selectedDate && selectedLawyer) {
      loadSlots();
    }
  }, [selectedDate, selectedLawyer]);

  async function loadLawyers() {
    try {
      const res = await fetch('/api/admin/bookings?action=lawyers');
      const data = await res.json();
      setLawyers(data.lawyers || []);
    } catch {
      toast.error('Failed to load lawyers');
    } finally {
      setLawyersLoading(false);
    }
  }

  async function searchClients(search: string) {
    setClientSearching(true);
    try {
      const res = await fetch(`/api/admin/bookings?action=clients&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setClientResults(data.clients || []);
    } catch {
      toast.error('Failed to search clients');
    } finally {
      setClientSearching(false);
    }
  }

  async function loadSlots() {
    if (!selectedLawyer) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const res = await fetch(`/api/consultations/availability?lawyerId=${selectedLawyer.id}&date=${selectedDate}`);
      const data = await res.json();
      if (res.ok) {
        // Admin can book ANY free slot (including call-to-book ones)
        const allFree = (data.slots || []).filter((s: Slot) =>
          (s.isAvailable || s.isCallToBook) && (s.mode === 'BOTH' || s.mode === mode)
        );
        setAvailableSlots(allFree);
      } else {
        setAvailableSlots([]);
      }
    } catch {
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedLawyer || !selectedSlot || !clientEmail) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          lawyerId: selectedLawyer.id,
          date: selectedDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          mode,
          subject,
          description,
          practiceArea: practiceArea || undefined,
          status: bookingStatus,
          adminNotes: adminNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = typeof data.error === 'string' ? data.error : 'Failed to create booking';
        throw new Error(errorMsg);
      }

      setCreatedBooking(data.booking);
      setStep(6); // Success step
      toast.success('Booking created successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  }

  const getMinDate = () => new Date().toISOString().split('T')[0];

  const filteredLawyers = lawyers.filter(l =>
    l.fullName.toLowerCase().includes(lawyerSearch.toLowerCase()) ||
    (l.district && l.district.toLowerCase().includes(lawyerSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/${locale}/dashboard/admin/consultations`}>
          <Button variant="outline" size="icon" className="rounded-none border-2 h-11 w-11">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Create Booking (Call-to-Book)</h1>
            <p className="text-sm text-neutral-500 font-medium">Manually create a booking on behalf of a client</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {['Lawyer', 'Client', 'Date & Slot', 'Details', 'Confirm'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
              step > i + 1 ? 'bg-green-600 border-green-600 text-white' :
              step === i + 1 ? 'bg-[#0a0a0a] border-[#0a0a0a] text-white' :
              'bg-white border-neutral-300 text-neutral-400'
            }`}>
              {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden md:inline ${step >= i + 1 ? 'text-neutral-900' : 'text-neutral-400'}`}>
              {label}
            </span>
            {i < 4 && <div className={`w-8 h-0.5 ${step > i + 1 ? 'bg-green-600' : 'bg-neutral-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Lawyer */}
      {step === 1 && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Select Lawyer</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                value={lawyerSearch}
                onChange={(e) => setLawyerSearch(e.target.value)}
                placeholder="Search by name or district..."
                className="pl-10 h-11 rounded-none border-2"
              />
            </div>

            {lawyersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredLawyers.map((lawyer) => (
                  <button
                    key={lawyer.id}
                    onClick={() => {
                      setSelectedLawyer(lawyer);
                      setStep(2);
                    }}
                    className={`w-full p-4 border-2 text-left transition-all hover:border-[#0a0a0a] ${
                      selectedLawyer?.id === lawyer.id ? 'border-[#0a0a0a] bg-neutral-50' : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-neutral-900">{lawyer.fullName}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{lawyer.district || 'No district'}</p>
                        {lawyer.contactPhone && (
                          <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" /> {lawyer.contactPhone}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-neutral-500">{lawyer.district || 'District not set'}</p>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredLawyers.length === 0 && (
                  <p className="text-center text-sm text-neutral-500 py-8">No lawyers found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Client */}
      {step === 2 && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Client Email</h2>
            <p className="text-xs text-neutral-500">Enter the email of the client who called to book.</p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientEmail(e.target.value);
                }}
                placeholder="Search client email..."
                className="pl-10 h-11 rounded-none border-2"
              />
            </div>

            {clientSearching && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="w-3 h-3 animate-spin" /> Searching...
              </div>
            )}

            {clientResults.length > 0 && (
              <div className="space-y-1 border border-neutral-200 max-h-48 overflow-y-auto">
                {clientResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setClientEmail(c.email);
                      setClientSearch(c.email);
                      setClientResults([]);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-neutral-50 text-sm border-b border-neutral-100 last:border-0"
                  >
                    <span className="font-medium text-neutral-900">{c.email}</span>
                  </button>
                ))}
              </div>
            )}

            {clientEmail && clientEmail.includes('@') && (
              <div className="bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Client email: <strong>{clientEmail}</strong>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Date & Slot */}
      {step === 3 && selectedLawyer && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Select Date & Time Slot</h2>

            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Date
                </label>
                <input
                  type="date"
                  min={getMinDate()}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border-2 border-neutral-200 px-4 py-3 outline-none focus:border-[#0a0a0a]"
                />
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                  Consultation Mode
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMode('PHYSICAL'); setSelectedSlot(null); }}
                    className={`flex-1 px-4 py-3 border-2 text-xs font-bold uppercase ${mode === 'PHYSICAL' ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-neutral-200 text-neutral-600'}`}
                  >
                    <MapPin className="w-4 h-4 mx-auto mb-1" /> Physical
                  </button>
                  <button
                    onClick={() => { setMode('ONLINE'); setSelectedSlot(null); }}
                    className={`flex-1 px-4 py-3 border-2 text-xs font-bold uppercase ${mode === 'ONLINE' ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-neutral-200 text-neutral-600'}`}
                  >
                    <Video className="w-4 h-4 mx-auto mb-1" /> Online
                  </button>
                </div>
              </div>
            </div>

            {selectedDate && (
              <div className="space-y-3 pt-4 border-t border-neutral-100">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Available Slots
                </label>

                {slotsLoading ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {[1,2,3,4].map(i => <div key={i} className="h-12 bg-neutral-100 animate-pulse" />)}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center p-6 bg-neutral-50 border border-neutral-200 text-sm text-neutral-500">
                    No available slots for this date. Try another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {availableSlots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSlot(slot)}
                        className={`px-3 py-3 text-sm font-semibold border-2 transition-all flex flex-col items-center gap-0.5 ${
                          selectedSlot?.startTime === slot.startTime
                            ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                            : slot.isCallToBook
                              ? 'border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400'
                              : 'border-neutral-200 text-neutral-700 hover:border-[#0a0a0a]'
                        }`}
                      >
                        <span>{slot.startTime} - {slot.endTime}</span>
                        {slot.isCallToBook && (
                          <span className="text-[9px] uppercase font-bold">Short Notice</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Booking Details */}
      {step === 4 && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Booking Details</h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="E.g., Property dispute consultation"
                className="h-11 border-2 rounded-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the legal issue..."
                className="min-h-[100px] border-2 rounded-none resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Practice Area (Optional)</label>
              <Input
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
                placeholder="E.g., Family Law"
                className="h-11 border-2 rounded-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Booking Status</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setBookingStatus('CONFIRMED')}
                  className={`flex-1 p-4 border-2 text-left transition-all ${
                    bookingStatus === 'CONFIRMED' ? 'border-green-600 bg-green-50' : 'border-neutral-200'
                  }`}
                >
                  <p className="text-sm font-bold text-neutral-900">Confirmed</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Booking is immediately confirmed. Use when lawyer approved over phone.</p>
                </button>
                <button
                  onClick={() => setBookingStatus('PENDING_PAYMENT')}
                  className={`flex-1 p-4 border-2 text-left transition-all ${
                    bookingStatus === 'PENDING_PAYMENT' ? 'border-amber-600 bg-amber-50' : 'border-neutral-200'
                  }`}
                >
                  <p className="text-sm font-bold text-neutral-900">Pending Payment</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Client still needs to pay. Will show on their dashboard.</p>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Admin Notes (Optional)</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes about this booking..."
                className="min-h-[60px] border-2 rounded-none resize-none"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Confirmation */}
      {step === 5 && selectedLawyer && selectedSlot && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Confirm Booking</h2>

            <div className="space-y-3 bg-neutral-50 p-5 border border-neutral-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Lawyer</p>
                  <p className="font-semibold text-neutral-900">{selectedLawyer.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Client</p>
                  <p className="font-semibold text-neutral-900">{clientEmail}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Date</p>
                  <p className="font-semibold text-neutral-900">{selectedDate}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Time</p>
                  <p className="font-semibold text-neutral-900">{selectedSlot.startTime} - {selectedSlot.endTime}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Mode</p>
                  <p className="font-semibold text-neutral-900 flex items-center gap-1">
                    {mode === 'PHYSICAL' ? <><MapPin className="w-3 h-3" /> Physical</> : <><Video className="w-3 h-3" /> Online</>}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Status</p>
                  <Badge className={bookingStatus === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                    {bookingStatus === 'CONFIRMED' ? 'Confirmed' : 'Pending Payment'}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Subject</p>
                  <p className="font-semibold text-neutral-900">{subject}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase">Fee</p>
                  <p className="font-semibold text-neutral-900">Quoted by the lawyer</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    The lawyer sets their fee when they accept this request, and the
                    client pays them directly.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Success */}
      {step === 6 && createdBooking && (
        <Card className="rounded-none shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Booking Created Successfully!</h2>
            <p className="text-sm text-neutral-500">
              Booking <strong>{createdBooking.bookingNumber}</strong> has been created and is now visible to both the client and the lawyer.
            </p>
            <div className="flex gap-3 justify-center pt-4">
              <Link href={`/${locale}/dashboard/admin/consultations`}>
                <Button className="rounded-none bg-[#0a0a0a] text-white hover:bg-neutral-800 h-11 px-6 text-xs font-bold uppercase tracking-widest">
                  View All Bookings
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setSelectedLawyer(null);
                  setClientEmail('');
                  setClientSearch('');
                  setSelectedDate('');
                  setSelectedSlot(null);
                  setSubject('');
                  setDescription('');
                  setPracticeArea('');
                  setAdminNotes('');
                  setCreatedBooking(null);
                }}
                className="rounded-none border-2 h-11 px-6 text-xs font-bold uppercase tracking-widest"
              >
                <UserPlus className="w-4 h-4 mr-2" /> Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      {step >= 2 && step <= 5 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            className="rounded-none border-2 h-11 px-6 text-xs font-bold uppercase tracking-widest"
          >
            Back
          </Button>

          {step < 5 ? (
            <Button
              onClick={() => {
                if (step === 2 && (!clientEmail || !clientEmail.includes('@'))) {
                  toast.error('Please enter a valid client email');
                  return;
                }
                if (step === 3 && !selectedSlot) {
                  toast.error('Please select a time slot');
                  return;
                }
                if (step === 4) {
                  if (!subject || subject.length < 3) {
                    toast.error('Subject must be at least 3 characters');
                    return;
                  }
                  if (!description || description.length < 10) {
                    toast.error('Description must be at least 10 characters');
                    return;
                  }
                }
                setStep(s => s + 1);
              }}
              className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-11 px-8 text-xs font-bold uppercase tracking-widest"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 text-white hover:bg-green-700 rounded-none h-11 px-8 text-xs font-bold uppercase tracking-widest"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {submitting ? 'Creating...' : 'Create Booking'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
