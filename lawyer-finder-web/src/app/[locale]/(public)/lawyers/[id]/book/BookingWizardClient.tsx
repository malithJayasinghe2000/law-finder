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
  pricing: {
    pricingType: string;
    physicalPrice: number;
    onlinePrice: number;
    commissionRate: number;
  };
}

import { CreateBookingSchema, BankTransferPaymentSchema } from '@/schemas/consultation.schema';

const step3Schema = CreateBookingSchema.pick({ subject: true, description: true });

export default function BookingWizardClient({ lawyerId, lawyerName, lawyerImage, lawyerDistrict, locale, pricing }: Props) {
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

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER_NOW' | 'BANK_TRANSFER_LATER' | 'PAYHERE'>('PAYHERE');
  
  // Bank Transfer Form
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionRef, setTransactionRef] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUploading, setReceiptUploading] = useState(false);

  // Call to Book Modal
  const [callToBookSlot, setCallToBookSlot] = useState<any>(null);

  // Pay Later 48h Notice Modal
  const [payLaterNoticeModal, setPayLaterNoticeModal] = useState(false);

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
          (s.isAvailable || s.isCallToBook) && (s.mode === 'BOTH' || s.mode === mode)
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
    if (paymentMethod === 'BANK_TRANSFER_NOW') {
      const result = BankTransferPaymentSchema.safeParse({ bankName, accountHolder, accountNumber, transactionDate, transactionRef, notes, receiptImageUrl });
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

    if (paymentMethod === 'BANK_TRANSFER_LATER') {
      const slotDateTime = new Date(`${selectedDate}T${selectedSlot.startTime}:00+05:30`);
      const now = new Date();
      const minNotice = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      
      if (slotDateTime < minNotice) {
        setPayLaterNoticeModal(true);
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Create Booking
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
          paymentMethod: paymentMethod === 'PAYHERE' ? 'PAYHERE' : 'BANK_TRANSFER',
          isPayLater: paymentMethod === 'BANK_TRANSFER_LATER',
        }),
      });

      const bookingData = await bookingRes.json();
      if (!bookingRes.ok) {
        throw new Error(bookingData.error || 'Failed to create booking');
      }

      const bookingId = bookingData.booking.id;

      // 2. Submit Payment (If not PAY LATER)
      if (paymentMethod !== 'BANK_TRANSFER_LATER') {
        const paymentPayload = paymentMethod === 'BANK_TRANSFER_NOW' 
          ? { method: 'BANK_TRANSFER', bankName, accountHolder, accountNumber, transactionDate, transactionRef, receiptImageUrl, notes }
          : { method: 'PAYHERE' };

        const paymentRes = await fetch(`/api/consultations/bookings/${bookingId}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentPayload),
        });

        const paymentData = await paymentRes.json();
        if (!paymentRes.ok) {
          throw new Error(paymentData.error || 'Payment initialization failed');
        }

        if (paymentMethod === 'PAYHERE' && paymentData.payhere) {
          // Redirect to PayHere Sandbox (for dev)
          const p = paymentData.payhere;
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = 'https://sandbox.payhere.lk/pay/checkout'; // USE SANDBOX FOR TESTING
          
          const params: Record<string, string> = {
            merchant_id: p.merchantId,
            return_url: p.returnUrl,
            cancel_url: p.cancelUrl,
            notify_url: p.notifyUrl,
            order_id: p.orderId,
            items: p.items,
            currency: p.currency,
            amount: p.amount,
            first_name: 'Client',
            last_name: 'Name',
            email: 'client@example.com',
            phone: '0771234567',
            address: 'Colombo',
            city: 'Colombo',
            country: 'Sri Lanka'
          };

          Object.entries(params).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
          });

          document.body.appendChild(form);
          form.submit();
          return;
        }
      }

      // Success fallback (for BANK_TRANSFER_NOW and BANK_TRANSFER_LATER)
      toast.success(paymentMethod === 'BANK_TRANSFER_NOW' 
        ? 'Booking submitted successfully! Awaiting admin verification.' 
        : 'Booking created! Please submit your payment details within 24 hours.'
      );
      router.push(`/${locale}/dashboard/client/consultations`);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const currentFee = mode === 'PHYSICAL' ? pricing.physicalPrice : pricing.onlinePrice;
  const platformFee = Math.round(currentFee * pricing.commissionRate);
  const totalAmount = currentFee + platformFee;

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
                    <p className="text-sm font-bold">LKR {pricing.physicalPrice.toLocaleString()} <span className="text-[10px] font-normal text-neutral-400">+ platform fee</span></p>
                  </button>

                  <button
                    onClick={() => { setMode('ONLINE'); setErrors({}); }}
                    className={`p-6 border-2 text-left transition-all relative ${mode === 'ONLINE' ? 'border-[#0a0a0a] bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                  >
                    {mode === 'ONLINE' && <div className="absolute top-4 right-4"><CheckCircle className="w-5 h-5 text-[#0a0a0a]" /></div>}
                    <Video className="w-8 h-8 text-[#0a0a0a] mb-4" />
                    <h3 className="font-bold text-[#0a0a0a] mb-1">Online Video</h3>
                    <p className="text-xs text-neutral-500 mb-4">Meet virtually via Google Meet from anywhere</p>
                    <p className="text-sm font-bold">LKR {pricing.onlinePrice.toLocaleString()} <span className="text-[10px] font-normal text-neutral-400">+ platform fee</span></p>
                  </button>
                </div>
                {errors.mode && <p className="text-sm text-red-500 mt-3 font-medium">{errors.mode}</p>}
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-lg font-bold text-[#0a0a0a] uppercase tracking-wide">2. Select Date & Time</h2>
                
                <div className="bg-blue-50 border border-blue-200 p-4 flex gap-3 text-sm text-blue-800">
                  <Info className="w-5 h-5 shrink-0" />
                  <p>Select an available slot. Slots marked with a phone icon require short notice and must be booked over the phone.</p>
                </div>

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
                                if (slot.isCallToBook) {
                                  setCallToBookSlot(slot);
                                } else {
                                  setSelectedSlot(slot);
                                }
                              }}
                              className={`px-4 py-3 text-sm font-semibold border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                                selectedSlot?.startTime === slot.startTime 
                                ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' 
                                : slot.isCallToBook 
                                  ? 'border-neutral-200 bg-neutral-100 text-neutral-600 hover:border-neutral-300'
                                  : 'border-neutral-200 text-neutral-700 hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                              }`}
                            >
                              <span>{slot.startTime} - {slot.endTime}</span>
                              {slot.isCallToBook && (
                                <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-neutral-500">
                                  <Phone className="w-3 h-3" /> Call to Book
                                </div>
                              )}
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
                <h2 className="text-lg font-bold text-[#0a0a0a] uppercase tracking-wide">4. Review & Payment</h2>

                {/* Summary Box */}
                <div className="bg-neutral-50 border border-neutral-200 p-6 space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-neutral-200">
                    <div>
                      <h3 className="font-bold text-[#0a0a0a]">{mode === 'PHYSICAL' ? 'Physical Consultation' : 'Online Video Consultation'}</h3>
                      <p className="text-sm text-neutral-500">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {selectedSlot?.startTime} – {selectedSlot?.endTime}</p>
                    </div>
                    <Button variant="link" onClick={() => setStep(1)} className="text-[#0a0a0a] px-0">Edit</Button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-neutral-600">
                      <span>Lawyer Fee</span>
                      <span className="font-bold text-[#0a0a0a]">LKR {currentFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Platform Service Fee</span>
                      <span className="font-bold text-[#0a0a0a]">LKR {platformFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-[#0a0a0a] pt-3 border-t border-neutral-200">
                      <span>Total Amount</span>
                      <span>LKR {totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-4">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Select Payment Method</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => setPaymentMethod('PAYHERE')}
                      className={`p-4 border-2 flex items-center gap-3 transition-all ${paymentMethod === 'PAYHERE' ? 'border-[#0a0a0a] bg-neutral-50' : 'border-neutral-200'}`}
                    >
                      <CreditCard className={`w-6 h-6 ${paymentMethod === 'PAYHERE' ? 'text-[#0a0a0a]' : 'text-neutral-400'}`} />
                      <div className="text-left">
                        <p className="text-sm font-bold text-[#0a0a0a]">Pay Online</p>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Instant</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('BANK_TRANSFER_NOW')}
                      className={`p-4 border-2 flex items-center gap-3 transition-all ${paymentMethod === 'BANK_TRANSFER_NOW' ? 'border-[#0a0a0a] bg-neutral-50' : 'border-neutral-200'}`}
                    >
                      <Building2 className={`w-6 h-6 ${paymentMethod === 'BANK_TRANSFER_NOW' ? 'text-[#0a0a0a]' : 'text-neutral-400'}`} />
                      <div className="text-left">
                        <p className="text-sm font-bold text-[#0a0a0a]">Bank Transfer</p>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Submit Details Now</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('BANK_TRANSFER_LATER')}
                      className={`p-4 border-2 flex items-center gap-3 transition-all ${paymentMethod === 'BANK_TRANSFER_LATER' ? 'border-[#0a0a0a] bg-neutral-50' : 'border-neutral-200'}`}
                    >
                      <Clock className={`w-6 h-6 ${paymentMethod === 'BANK_TRANSFER_LATER' ? 'text-[#0a0a0a]' : 'text-neutral-400'}`} />
                      <div className="text-left">
                        <p className="text-sm font-bold text-[#0a0a0a]">Pay Later</p>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Within 24 Hours</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Bank Transfer Details */}
                {paymentMethod === 'BANK_TRANSFER_NOW' && (
                  <div className="p-6 bg-neutral-50 border border-neutral-200 space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mb-4">
                      <p className="font-bold mb-1">Bank Transfer Instructions:</p>
                      <p>Please transfer <strong>LKR {totalAmount.toLocaleString()}</strong> to the account below, then upload the receipt or enter the transaction reference. Manual verification takes up to 24 hours.</p>
                      <ul className="mt-2 space-y-1 font-mono text-[11px]">
                        <li>Bank: Commercial Bank</li>
                        <li>Account Name: FindLawyer Platform</li>
                        <li>Account No: 1234567890</li>
                        <li>Branch: Colombo 01</li>
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase">Your Bank Name <span className="text-red-500">*</span></label>
                        <Input value={bankName} onChange={e => { setBankName(e.target.value); setErrors(prev => ({ ...prev, bankName: '' })); }} className={`h-9 rounded-none text-xs ${errors.bankName ? 'border-red-500' : 'border-neutral-200'}`} placeholder="e.g. HNB" />
                        {errors.bankName && <p className="text-[10px] text-red-500">{errors.bankName}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase">Account Holder <span className="text-red-500">*</span></label>
                        <Input value={accountHolder} onChange={e => { setAccountHolder(e.target.value); setErrors(prev => ({ ...prev, accountHolder: '' })); }} className={`h-9 rounded-none text-xs ${errors.accountHolder ? 'border-red-500' : 'border-neutral-200'}`} placeholder="e.g. John Doe" />
                        {errors.accountHolder && <p className="text-[10px] text-red-500">{errors.accountHolder}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase">Account Number <span className="text-red-500">*</span></label>
                        <Input value={accountNumber} onChange={e => { setAccountNumber(e.target.value); setErrors(prev => ({ ...prev, accountNumber: '' })); }} className={`h-9 rounded-none text-xs ${errors.accountNumber ? 'border-red-500' : 'border-neutral-200'}`} placeholder="e.g. 123456789" />
                        {errors.accountNumber && <p className="text-[10px] text-red-500">{errors.accountNumber}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase">Transaction Date <span className="text-red-500">*</span></label>
                        <Input type="date" value={transactionDate} onChange={e => { setTransactionDate(e.target.value); setErrors(prev => ({ ...prev, transactionDate: '' })); }} className={`h-9 rounded-none text-xs ${errors.transactionDate ? 'border-red-500' : 'border-neutral-200'}`} />
                        {errors.transactionDate && <p className="text-[10px] text-red-500">{errors.transactionDate}</p>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Transaction Reference Number <span className="text-red-500">*</span></label>
                      <Input value={transactionRef} onChange={e => { setTransactionRef(e.target.value); setErrors(prev => ({ ...prev, transactionRef: '' })); }} className={`h-9 rounded-none text-xs ${errors.transactionRef ? 'border-red-500' : 'border-neutral-200'}`} />
                      {errors.transactionRef && <p className="text-[10px] text-red-500">{errors.transactionRef}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase">Notes (Optional)</label>
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px] rounded-none text-xs border-neutral-200" placeholder="Any additional information..." />
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
                          className="flex items-center gap-2 w-full p-4 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
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
                  </div>
                )}
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
                  {loading ? 'Processing...' : (paymentMethod === 'BANK_TRANSFER_LATER' ? `Book Now & Pay Later` : `Pay LKR ${totalAmount.toLocaleString()} & Book`)}
                </Button>
              )}
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Call to Book Modal */}
      {callToBookSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full p-8 relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setCallToBookSlot(null)} className="absolute top-4 right-4 text-neutral-400 hover:text-black">
              <XCircle className="w-6 h-6" />
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#0a0a0a]">Short Notice Booking</h2>
              <p className="text-sm text-neutral-500 mt-2">
                This time slot ({callToBookSlot.startTime}) is available, but it falls within the lawyer's required advance notice period. We need to confirm it with the lawyer first.
              </p>
            </div>
            
            <div className="bg-neutral-50 p-6 border border-neutral-200 text-center mb-6">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Please call our support line to arrange</p>
              <p className="text-2xl font-bold text-[#0a0a0a] tracking-wider">011 234 5678</p>
            </div>
            
            <Button onClick={() => setCallToBookSlot(null)} className="w-full h-12 rounded-none bg-[#0a0a0a] hover:bg-neutral-800 text-white font-bold uppercase text-xs tracking-widest">
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Pay Later Notice Modal */}
      {payLaterNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full p-8 relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setPayLaterNoticeModal(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-black">
              <XCircle className="w-6 h-6" />
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#0a0a0a]">Insufficient Time for Pay Later</h2>
              <p className="text-sm text-neutral-500 mt-2">
                This consultation is less than 48 hours away. The "Pay Later" option requires at least 48 hours advance notice to allow our admin team to verify your payment.
              </p>
            </div>
            
            <div className="bg-neutral-50 p-6 border border-neutral-200 text-center mb-6">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Please choose</p>
              <p className="text-lg font-bold text-[#0a0a0a] mt-2">Pay Online</p>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest my-2">or</p>
              <p className="text-lg font-bold text-[#0a0a0a]">Bank Transfer (Submit Now)</p>
            </div>
            
            <Button onClick={() => setPayLaterNoticeModal(false)} className="w-full h-12 rounded-none bg-[#0a0a0a] hover:bg-neutral-800 text-white font-bold uppercase text-xs tracking-widest">
              Change Payment Method
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
