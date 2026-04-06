'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ArrowLeft, Upload, Loader2, Banknote, HelpCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FieldError } from '@/components/ui/FieldError';

const paymentSchema = z.object({
  bankName: z.string().min(1, 'Bank Name is required'),
  referenceNumber: z.string().min(1, 'Reference Number is required'),
  paymentMethod: z.string().min(1, 'Payment Method is required'),
  accountName: z.string().min(1, 'Account Name is required'),
  bankSlip: z.any().refine((files) => files?.length > 0, 'Bank Slip is required'),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface OfflinePaymentClientProps {
  locale: string;
  plan: any;
  amount: string;
  invoice: string;
  cycle: string;
}

export default function OfflinePaymentClient({ locale, plan, amount, invoice, cycle }: OfflinePaymentClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
  });

  const onSubmit = async (data: PaymentFormValues) => {
    setIsSubmitting(true);
    try {
      // Simulate form submission or actual API call
      // In a real scenario, you'd upload the bank slip to a storage service (S3/Cloudinary/etc)
      // and then save the details to the database.
      
      const formData = new FormData();
      formData.append('bankName', data.bankName);
      formData.append('referenceNumber', data.referenceNumber);
      formData.append('accountName', data.accountName);
      formData.append('bankSlip', data.bankSlip[0]);
      formData.append('planId', plan.id);
      formData.append('amount', amount);
      formData.append('invoiceNumber', invoice);
      formData.append('billingCycle', cycle);

      const res = await fetch('/api/payments/offline', {
         method: 'POST',
         body: formData,
      });

      if (!res.ok) throw new Error('Failed to submit payment details');

      setIsSuccess(true);
      toast.success('Payment submission successful! Our team will verify it shortly.');
      
      setTimeout(() => {
        router.push(`/${locale}/dashboard/lawyer/payments/history`);
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-none border-t-8 border-t-green-500 shadow-2xl p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-green-100 p-4 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tighter">Submission Received</h2>
            <p className="text-neutral-500 font-medium">Your offline payment details have been submitted successfully. We will verify your payment and activate your subscription within 24-48 hours.</p>
          </div>
          <div className="bg-neutral-50 p-4 border border-dashed border-neutral-200 text-sm font-bold uppercase tracking-wider text-neutral-400">
            Redirecting to payment history...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-6">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
      
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Main Form Section */}
          <div className="md:col-span-2">
            <Card className="rounded-none border-t-4 border-t-black shadow-xl h-full">
              <CardHeader className="pb-8">
                <div className="flex items-center gap-4 mb-2">
                   <div className="bg-black p-2">
                      <Banknote className="w-5 h-5 text-white" />
                   </div>
                   <CardTitle className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Payment Submission</CardTitle>
                </div>
                <CardDescription className="text-neutral-500 font-medium pt-2">
                  Please provide the details of your bank transfer or cash deposit as shown on your receipt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="accountName" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Sender's Account Name</Label>
                    <Input 
                      id="accountName"
                      {...register('accountName')}
                      placeholder="Name as on account or deposit slip" 
                      className="rounded-none h-12 border-neutral-200 focus:ring-black placeholder:text-neutral-300"
                    />
                    {errors.accountName && <FieldError message={errors.accountName.message} />}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="bankName" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Bank Name</Label>
                      <Input 
                        id="bankName"
                        {...register('bankName')}
                        placeholder="e.g. Commercial Bank" 
                        className="rounded-none h-12 border-neutral-200 focus:ring-black placeholder:text-neutral-300"
                      />
                      {errors.bankName && <FieldError message={errors.bankName.message} />}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="referenceNumber" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Reference / Slip Number</Label>
                      <Input 
                        id="referenceNumber"
                        {...register('referenceNumber')}
                        placeholder="Transaction ID" 
                        className="rounded-none h-12 border-neutral-200 focus:ring-black placeholder:text-neutral-300 font-mono"
                      />
                      {errors.referenceNumber && <FieldError message={errors.referenceNumber.message} />}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="paymentMethod" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Payment Method</Label>
                      <select 
                        id="paymentMethod"
                        {...register('paymentMethod')}
                        className="w-full bg-white px-3 rounded-none h-12 border border-neutral-200 focus:ring-black focus:border-black outline-none placeholder:text-neutral-300 transition-all text-sm appearance-none cursor-pointer"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
                      >
                        <option value="" disabled>Select Payment Method</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash_deposit">Cash Deposit</option>
                      </select>
                      {errors.paymentMethod && <FieldError message={errors.paymentMethod.message} />}
                    </div>
                    <div></div>
                  </div>

                  

                  <div className="space-y-2">
                    <Label htmlFor="bankSlip" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Upload Bank Slip (Photo or PDF)</Label>
                    <div className="relative group">
                       <Input 
                        id="bankSlip"
                        type="file"
                        accept="image/*,application/pdf"
                        {...register('bankSlip')}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                      />
                      <div className={`border-2 border-dashed rounded-none transition-all duration-300 p-8 flex flex-col items-center justify-center gap-3 ${watch('bankSlip')?.length > 0 ? 'bg-green-50 border-green-500' : 'border-neutral-200 group-hover:border-black group-hover:bg-neutral-50'}`}>
                         <Upload className={`w-8 h-8 ${watch('bankSlip')?.length > 0 ? 'text-green-600' : 'text-neutral-300 group-hover:text-black'}`} />
                         <div className="text-center">
                            <p className="text-sm font-bold mb-1">
                              {watch('bankSlip')?.length > 0 ? watch('bankSlip')[0].name : 'Click or drop file to upload'}
                            </p>
                            <p className="text-[10px] text-neutral-400 uppercase font-black">Max size: 5MB (JPG, PNG, PDF)</p>
                         </div>
                      </div>
                    </div>
                    {errors.bankSlip && <FieldError message={errors.bankSlip.message as string} />}
                  </div>
                </form>
              </CardContent>
              <CardFooter className="pt-6 pb-10 border-t border-neutral-100 flex-col gap-4">
                 <Button 
                    type="submit"
                    form="payment-form"
                    disabled={isSubmitting}
                    className="w-full bg-[#0a0a0a] text-white py-8 rounded-none uppercase font-black tracking-widest hover:bg-neutral-800 transition-all shadow-xl group"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-3">
                        Submit Payment Details
                        <ArrowLeft className="w-4 h-4 rotate-180 opacity-40 group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                 </Button>
                 <div className="flex items-center gap-2 text-neutral-400">
                    <HelpCircle className="w-3 h-3" />
                    <span className="text-[10px] font-medium italic">By submitting, you agree that providing false info may result in account suspension.</span>
                 </div>
              </CardFooter>
            </Card>
          </div>

          {/* Side Info Section */}
          <div className="space-y-6">
             <Card className="rounded-none border-l-4 border-l-black shadow-lg">
                <CardHeader>
                   <CardTitle className="text-md font-bold text-neutral-500 uppercase tracking-widest">Subscription Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex justify-between items-start">
                      <div>
                         <p className="text-xs font-bold text-neutral-400 uppercase">Plan</p>
                         <p className="font-medium text-lg leading-tight">{plan.name}</p>
                         <p className="text-[10px] font-bold text-primary uppercase mt-1 italic">{cycle} billing</p>
                      </div>
                   </div>
                   <div className="pt-4 border-t border-neutral-100 space-y-2">
                       <div className="flex justify-between text-sm">
                          <span className="text-neutral-500 font-medium">Invoice:</span>
                          <span className="font-bold font-mono">#{invoice}</span>
                       </div>
                       <div className="flex justify-between text-lg pt-2">
                          <span className="font-black uppercase tracking-tighter">Amount:</span>
                          <span className="font-black text-black">LKR {parseFloat(amount).toLocaleString()}</span>
                       </div>
                   </div>
                </CardContent>
             </Card>

             <Card className="rounded-none border border-neutral-200 bg-neutral-900 text-white shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <Banknote className="w-24 h-24" />
                </div>
                <CardHeader>
                   <CardTitle className="text-xs font-bold uppercase tracking-widest text-neutral-400">Bank Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 relative z-10">
                   <div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase">Bank</p>
                      <p className="font-bold text-sm tracking-wide">COMMERCIAL BANK</p>
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase">Account Number</p>
                      <p className="font-black text-lg tracking-[3px] text-primary">0103 2492 4920 492</p>
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase">Branch</p>
                      <p className="font-bold text-sm tracking-wide uppercase">Colombo 07 - Main</p>
                   </div>
                   <div className="pt-4 mt-4 border-t border-white/10">
                      <p className="text-[10px] font-bold text-red-400 uppercase mb-2">Important Instructions:</p>
                      <ul className="text-[10px] space-y-1.5 font-medium text-neutral-300 leading-tight">
                         <li className="flex gap-2"><span>1.</span><span>Use invoice #{invoice} as reference.</span></li>
                         <li className="flex gap-2"><span>2.</span><span>Upload a clear photo of the deposit slip.</span></li>
                         <li className="flex gap-2"><span>3.</span><span>Verification takes up to 2 working days.</span></li>
                      </ul>
                   </div>
                </CardContent>
             </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
