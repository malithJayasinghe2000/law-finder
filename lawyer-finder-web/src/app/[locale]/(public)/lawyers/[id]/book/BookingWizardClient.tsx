'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  CalendarDays, Clock, MapPin, Video, CheckCircle, CreditCard, Loader2, ArrowRight, Info, Phone, XCircle, ChevronRight,
  ChevronLeft,
  Building2, ImagePlus
} from 'lucide-react';

interface Props {
  lawyerId: string;
  lawyerName: string;
  lawyerImage: string | null;
  lawyerDistrict: string | null;
  locale: string;
}

import { CreateBookingSchema } from '@/schemas/consultation.schema';

const step3Schema = CreateBookingSchema.pick({ subject: true, description: true });

export default function BookingWizardClient({ lawyerId, lawyerName, lawyerImage, lawyerDistrict, locale }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [mode, setMode] = useState<'PHYSICAL' | 'ONLINE' | null>(null);
  
  // Date & Time State
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  // Issue Details
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Call to Book Modal
  const [callToBookSlot, setCallToBookSlot] = useState<any>(null);



  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2: Load slots when date changes
  useEffect(() => {
    if (selectedDate && step === 2) {
      loadSlots(selectedDate);
    }
  }, [selectedDate, step]);

  // Allow booking from today (slots will filter based on notice period)
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  async function loadSlots(dateStr: string) {
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const res = await fetch(`/api/consultations/availability?lawyerId=${lawyerId}&date=${dateStr}`);
      const data = await res.json();
      if (res.ok) {
        // Filter slots based on selected mode
        const filtered = data.slots.filter((s: any) => 
          s.isAvailable && (s.mode === 'BOTH' || s.mode === mode)
        );
        setAvailableSlots(filtered);
      } else {
        toast.error(data.error?.message || data.message || 'Failed to load slots');
        setAvailableSlots([]);
      }
    } catch {
      toast.error('Failed to load availability');
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }



  // Next step validation
  const nextStep = async () => {
    setErrors({});
    if (step === 1 && !mode) { 
      setErrors({ mode: 'Please select a consultation mode to continue.' });
      return; 
    }
    
    if (step === 2) {
      if (!selectedDate) {
        setErrors({ date: 'Please select a date.' });
        return;
      }
      if (!selectedSlot) { 
        setErrors({ slot: 'Please select an available time slot.' });
        return; 
      }
      
      // Try to hold the slot
      setLoading(true);
      try {
        const res = await fetch('/api/consultations/holds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lawyerId,
            date: selectedDate,
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
          }),
        });
        
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'This slot is no longer available');
          setLoading(false);
          // Reload slots to refresh availability
          loadSlots(selectedDate);
          return;
        }
        // Success: Slot held for 10 minutes
      } catch (err) {
        toast.error('Failed to reserve slot');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (step === 3) {
      const result = step3Schema.safeParse({ subject, description });
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        const formattedErrors: Record<string, string> = {};
        for (const key in fieldErrors) {
          const errorVal = fieldErrors[key as keyof typeof fieldErrors];
          if (errorVal && errorVal.length > 0) {
            formattedErrors[key] = errorVal[0];
          }
        }
        setErrors(formattedErrors);
        return;
      }
    }
    setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    await submitBooking();
  }

  const submitBooking = async () => {
    setErrors({});
    
    setLoading(true);
    try {
      // 1. Create Booking Request
      const bookingRes = await fetch('/api/consultations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lawyerId,
          date: selectedDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          mode,
          subject,
          description,
        }),
      });

      const bookingData = await bookingRes.json();
      if (!bookingRes.ok) {
        throw new Error(bookingData.error || 'Failed to create booking');
      }

      toast.success('Consultation requested successfully! The lawyer will review it shortly.');
      router.push(`/${locale}/dashboard/client/consultations`);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-neutral-50 py-10 lg:py-20">
      <div className="mx-auto max-w-3xl px-6">
        
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#0a0a0a]">Book Consultation</h1>
          <p className="text-sm text-neutral-500 mt-2">with {lawyerName}</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-neutral-200 -z-10" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#0a0a0a] -z-10 transition-all duration-300" style={{ width: `${((step - 1) / 3) * 100}%` }} />
          
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${step >= s ? 'bg-[#0a0a0a] border-[#0a0a0a] text-white' : 'bg-white border-neutral-300 text-neutral-400'}`}>
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
          ))}
        </div>

        {/* Steps */}
        <Card className="rounded-none shadow-xl border-neutral-200">
          <CardContent className="p-8">
            
            {/* Step 1: Mode */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-lg font-bold text-[#0a0a0a] uppercase tracking-wide">1. Select Consultation Mode</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => { setMode('PHYSICAL'); setErrors({}); }}
                    className={`p-6 border-2 text-left transition-all relative ${mode === 'PHYSICAL' ? 'border-[#0a0a0a] bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                  >
                    {mode === 'PHYSICAL' && <div className="absolute top-4 right-4"><CheckCircle className="w-5 h-5 text-[#0a0a0a]" /></div>}
                    <MapPin className="w-8 h-8 text-[#0a0a0a] mb-4" />
                    <h3 className="font-bold text-[#0a0a0a] mb-1">Physical Meeting</h3>
                    <p className="text-xs text-neutral-500 mb-4">Meet in-person at the lawyer's office or agreed location</p>
                  </button>

                  <button
                    onClick={() => { setMode('ONLINE'); setErrors({}); }}
                    className={`p-6 border-2 text-left transition-all relative ${mode === 'ONLINE' ? 'border-[#0a0a0a] bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                  >
                    {mode === 'ONLINE' && <div className="absolute top-4 right-4"><CheckCircle className="w-5 h-5 text-[#0a0a0a]" /></div>}
                    <Video className="w-8 h-8 text-[#0a0a0a] mb-4" />
                    <h3 className="font-bold text-[#0a0a0a] mb-1">Online Video</h3>
                    <p className="text-xs text-neutral-500 mb-4">Meet virtually via Google Meet from anywhere</p>
                  </button>
                </div>
                {errors.mode && <p className="text-sm text-red-500 mt-3 font-medium">{errors.mode}</p>}
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-lg font-bold text-[#0a0a0a] uppercase tracking-wide">2. Select Date & Time</h2>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Select Date</label>
                  <input
                    type="date"
                    min={getMinDate()}
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setErrors(prev => ({ ...prev, date: '' })); }}
                    className={`w-full border-2 px-4 py-3 outline-none transition-colors ${errors.date ? 'border-red-500 focus:border-red-500' : 'border-neutral-200 focus:border-[#0a0a0a]'}`}
                  />
                  {errors.date && <p className="text-xs text-red-500">{errors.date}</p>}
                </div>

                {selectedDate && (
                  <div className="space-y-3 pt-4 border-t border-neutral-100">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Available Slots for {selectedDate}
                    </label>
                    
                    {slotsLoading ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[1,2,3].map(i => <div key={i} className="h-12 bg-neutral-100 animate-pulse" />)}
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="text-center p-6 bg-neutral-50 border border-neutral-200 text-sm text-neutral-500">
                        No available slots for this date. Please select another date.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {availableSlots.map((slot, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setErrors(prev => ({ ...prev, slot: '' }));
                                setSelectedSlot(slot);
                              }}
                              className={`px-4 py-3 text-sm font-semibold border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                                selectedSlot?.startTime === slot.startTime 
                                ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' 
                                : 'border-neutral-200 text-neutral-700 hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                              }`}
                            >
                              <span>{slot.startTime} - {slot.endTime}</span>
                            </button>
                          ))}
                        </div>
                        {errors.slot && <p className="text-xs text-red-500 mt-2">{errors.slot}</p>}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Details */}
            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-lg font-bold text-[#0a0a0a] uppercase tracking-wide">3. Legal Issue Details</h2>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Subject <span className="text-red-500">*</span></label>
                  <Input 
                    value={subject} 
                    onChange={(e) => { setSubject(e.target.value); setErrors(prev => ({ ...prev, subject: '' })); }} 
                    placeholder="E.g., Property dispute consultation" 
                    className={`h-12 border-2 rounded-none focus-visible:ring-0 ${errors.subject ? 'border-red-500 focus-visible:border-red-500' : 'border-neutral-200 focus-visible:border-[#0a0a0a]'}`}
                  />
                  {errors.subject && <p className="text-xs text-red-500">{errors.subject}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Brief Description <span className="text-red-500">*</span></label>
                  <Textarea 
                    value={description} 
                    onChange={(e) => { setDescription(e.target.value); setErrors(prev => ({ ...prev, description: '' })); }} 
                    placeholder="Briefly describe your legal situation so the lawyer can prepare..." 
                    className={`min-h-[120px] border-2 rounded-none focus-visible:ring-0 resize-none ${errors.description ? 'border-red-500 focus-visible:border-red-500' : 'border-neutral-200 focus-visible:border-[#0a0a0a]'}`}
                  />
                  <div className="flex justify-between items-center">
                    {errors.description ? <p className="text-xs text-red-500">{errors.description}</p> : <div />}
                    <p className={`text-[10px] text-right ${description.length > 2000 ? 'text-red-500' : 'text-neutral-400'}`}>{description.length} / 2000</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Payment */}
            {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-lg font-bold text-[#0a0a0a] uppercase tracking-wide">4. Review & Submit Request</h2>

                {/* Summary Box */}
                <div className="bg-neutral-50 border border-neutral-200 p-6 space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                    <div>
                      <h3 className="font-bold text-[#0a0a0a]">{mode === 'PHYSICAL' ? 'Physical Consultation' : 'Online Video Consultation'}</h3>
                      <p className="text-sm text-neutral-500">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {selectedSlot?.startTime} – {selectedSlot?.endTime}</p>
                    </div>
                    <Button variant="link" onClick={() => setStep(1)} className="text-[#0a0a0a] px-0">Edit</Button>
                  </div>
                  <div className="text-sm text-neutral-700">
                    <p className="font-semibold text-[#0a0a0a]">Subject</p>
                    <p>{subject}</p>
                    <p className="font-semibold text-[#0a0a0a] mt-3">Description</p>
                    <p>{description}</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex gap-3">
                   <Info className="w-5 h-5 shrink-0" />
                   <p>Your consultation request will be sent to the lawyer. Once accepted, the lawyer will discuss fees directly with you.</p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-10 pt-6 border-t border-neutral-200 flex items-center justify-between">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(s => s - 1)} className="rounded-none h-12 px-6 uppercase tracking-widest text-xs font-bold">
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              ) : <div />}

              {step < 4 ? (
                <Button onClick={nextStep} className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-12 px-8 uppercase tracking-widest text-xs font-bold">
                  Next Step <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={submitBooking} disabled={loading} className="bg-green-600 text-white hover:bg-green-700 rounded-none h-12 px-8 uppercase tracking-widest text-xs font-bold w-full md:w-auto">
                  {loading ? 'Processing...' : 'Submit Consultation Request'}
                </Button>
              )}
            </div>

          </CardContent>
        </Card>
      </div>


    </div>
  );
}
