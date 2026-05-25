'use client';

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitPaymentSchema, type SubmitPayment } from '@/schemas/subscription.schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FieldError } from '@/components/ui/FieldError';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Banknote, ShieldCheck, CheckCircle2, Clock, Calendar, Hash, CreditCard, Info, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface OfflinePaymentClientProps {
  locale: string;
  invoice: any;
}

export default function OfflinePaymentClient({ locale, invoice }: OfflinePaymentClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isReadonly = invoice.status !== 'PENDING' && invoice.status !== 'RESUBMIT';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SubmitPayment>({
    resolver: zodResolver(SubmitPaymentSchema),
    defaultValues: {
      invoiceId: invoice.id,
      amount: invoice.amount,
      bankName: invoice.paymentDetails?.bankName || '',
      accountHolder: invoice.paymentDetails?.accountHolder || '',
      accountNumber: invoice.paymentDetails?.accountNumber || '',
      transactionId: invoice.paymentDetails?.transactionId || '',
      notes: invoice.paymentDetails?.notes || '',
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadonly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'invoices');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to upload image');
    }
  };

  const onSubmit = async (data: SubmitPayment) => {
    setIsSubmitting(true);
    try {
      let receiptImageUrl = data.receiptImageUrl;

      // Upload image if selected
      if (selectedFile) {
        setUploadProgress(30);
        receiptImageUrl = await uploadImage(selectedFile);
        setUploadProgress(70);
      }

      setUploadProgress(80);
      const response = await fetch('/api/invoices/submit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          receiptImageUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit payment',
          variant: 'destructive',
        });
        setUploadProgress(0);
        return;
      }

      setUploadProgress(100);
      toast({
        title: 'Success',
        description: 'Payment details submitted successfully. Awaiting admin approval.',
      });

      reset();
      setSelectedFile(null);
      setUploadProgress(0);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/${locale}/dashboard/lawyer/payments/invoices`);
      }, 2000);
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred while submitting payment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="pb-20">
      {/* Page Header - Clean style matching other dashboard pages */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 text-neutral-500 hover:text-black px-0 hover:bg-transparent"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoice
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Offline Payment Submission</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Provide your bank transfer details. Our team will verify within 24–48 hours.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 px-5 py-3 rounded-3xl">
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Payable Amount</p>
              <p className="text-xl font-bold tracking-tight text-[#0a0a0a]">LKR {invoice.amount.toLocaleString()}.00</p>
            </div>
            <div className="text-[9px] text-neutral-400 font-medium">
              #{invoice.id.substring(0, 8).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Form */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            <Card className="rounded-3xl border-none shadow-2xl overflow-hidden bg-white">
              <div className="h-2 bg-black w-full" />
              <CardHeader className="bg-white pb-8 pt-10 border-b border-neutral-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight text-black">Submission Form</CardTitle>
                    <CardDescription className="text-neutral-500 mt-1 font-medium">
                      Enter accurate transaction details for faster verification
                    </CardDescription>
                  </div>
                  <ShieldCheck className="w-10 h-10 text-neutral-100" />
                </div>
              </CardHeader>
              <CardContent className="p-8 lg:p-12">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                  
                  {/* Section 1: Bank Information */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-black">01</div>
                      <h3 className="font-black text-sm uppercase tracking-widest text-black">Sender's Bank Information</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="bankName" className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Your Bank Name *</Label>
                        <Input
                          id="bankName"
                          {...register('bankName')}
                          placeholder="e.g. Commercial Bank, BOC, Sampath"
                          disabled={isSubmitting || isReadonly}
                          className="rounded-3xl h-12 border-neutral-200 focus:ring-black focus:border-black"
                        />
                        {errors.bankName && <FieldError message={errors.bankName.message} />}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="accountHolder" className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Account Holder Name *</Label>
                        <Input
                          id="accountHolder"
                          {...register('accountHolder')}
                          placeholder="Name as on deposit slip"
                          disabled={isSubmitting || isReadonly}
                          className="rounded-3xl h-12 border-neutral-200 focus:ring-black focus:border-black"
                        />
                        {errors.accountHolder && <FieldError message={errors.accountHolder.message} />}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accountNumber" className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Your Account Number *</Label>
                      <Input
                        id="accountNumber"
                        {...register('accountNumber')}
                        placeholder="Enter the account number from which payment was made"
                        disabled={isSubmitting || isReadonly}
                        className="rounded-3xl h-12 border-neutral-200 focus:ring-black focus:border-black"
                      />
                      {errors.accountNumber && <FieldError message={errors.accountNumber.message} />}
                    </div>
                  </div>

                  <Separator className="bg-neutral-100" />

                  {/* Section 2: Transaction Details */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-black">02</div>
                      <h3 className="font-black text-sm uppercase tracking-widest text-black">Transaction Data</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="transactionDate" className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Date & Time of Transfer *</Label>
                        <Input
                          id="transactionDate"
                          type="datetime-local"
                          {...register('transactionDate')}
                          disabled={isSubmitting || isReadonly}
                          className="rounded-3xl h-12 border-neutral-200 focus:ring-black focus:border-black"
                        />
                        {errors.transactionDate && <FieldError message={errors.transactionDate.message} />}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="transactionId" className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Bank Reference / ID *</Label>
                        <Input
                          id="transactionId"
                          {...register('transactionId')}
                          placeholder="e.g. TX-2938491"
                          disabled={isSubmitting || isReadonly}
                          className="rounded-3xl h-12 border-neutral-200 focus:ring-black focus:border-black font-mono"
                        />
                        {errors.transactionId && <FieldError message={errors.transactionId.message} />}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Actual Amount Paid (LKR) *</Label>
                      <div className="relative">
                        <Input
                          id="amount"
                          type="number"
                          {...register('amount', { valueAsNumber: true })}
                          placeholder={invoice.amount.toString()}
                          disabled={isSubmitting || isReadonly}
                          className="rounded-3xl h-12 border-neutral-200 focus:ring-black focus:border-black pl-12 font-black text-lg"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-xs">LKR</div>
                      </div>
                      {errors.amount && <FieldError message={errors.amount.message} />}
                    </div>
                  </div>

                  <Separator className="bg-neutral-100" />

                  {/* Section 3: Receipt Upload */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-black">03</div>
                      <h3 className="font-black text-sm uppercase tracking-widest text-black">Payment Verification</h3>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Upload Receipt Image / Screenshot *</Label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`group relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${
                          selectedFile 
                            ? 'border-green-500 bg-green-50/30' 
                            : 'border-neutral-200 hover:border-black hover:bg-neutral-50 cursor-pointer'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          disabled={isSubmitting || isReadonly}
                          className="hidden"
                        />
                        
                        <div className="flex flex-col items-center">
                          {selectedFile ? (
                            <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                          ) : (
                            <Upload className="w-12 h-12 text-neutral-300 mb-4 group-hover:text-black transition-colors" />
                          )}
                          
                          <p className="text-sm font-black text-black">
                            {selectedFile ? selectedFile.name : 'CLICK TO UPLOAD RECEIPT'}
                          </p>
                          <p className="text-[10px] text-neutral-400 uppercase font-bold mt-2 tracking-widest">
                            {selectedFile 
                              ? `(${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)` 
                              : 'JPG, PNG OR PDF (MAX 5MB)'}
                          </p>
                        </div>

                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="absolute bottom-0 left-0 w-full h-1 bg-neutral-100 overflow-hidden">
                            <div
                              className="bg-black h-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Additional Notes</Label>
                      <Textarea
                        id="notes"
                        {...register('notes')}
                        placeholder="Optional details for our accounts team..."
                        rows={3}
                        disabled={isSubmitting || isReadonly}
                        className="rounded-3xl border-neutral-200 focus:ring-black focus:border-black"
                      />
                    </div>
                  </div>

                  {/* Submission Action */}
                  {!isReadonly && (
                    <div className="pt-6">
                      <Button
                        type="submit"
                        disabled={isSubmitting || isReadonly}
                        className="w-full h-16 bg-[#ffb84f] text-black hover:bg-[#e5a443] rounded-full uppercase font-black tracking-[0.2em] transition-all shadow-xl disabled:bg-neutral-400 group relative overflow-hidden"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                          {isSubmitting ? (
                            <>
                              <Clock className="w-5 h-5 animate-spin text-black" />
                              Processing Submission...
                            </>
                          ) : (
                            <>
                              Submit Payment for Review
                              <ArrowLeft className="w-5 h-5 rotate-180 transition-transform group-hover:translate-x-2 text-black" />
                            </>
                          )}
                        </span>
                      </Button>
                      <p className="text-center text-[10px] text-neutral-400 mt-6 uppercase font-bold tracking-widest">
                        By submitting, you confirm that the information provided is accurate and authentic.
                      </p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Sidebar Info */}
          <div className="lg:col-span-4 space-y-8">
                        {/* Remarks History */}
            {invoice.remarks && invoice.remarks.length > 0 && (
              <Card className="rounded-3xl border-none shadow-xl bg-yellow-50 overflow-hidden relative">
                <div className="h-1 bg-yellow-400" />
                <CardHeader className="pb-4">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-yellow-800 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Admin Notice
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-6">
                  {invoice.remarks.slice(0, 3).map((remark: any) => (
                    <div key={remark.id} className="bg-white border text-sm font-medium border-yellow-200 p-4 relative shadow-sm rounded-2xl">
                      <p className="text-yellow-900 whitespace-pre-wrap">{remark.remark}</p>
                      <p className="text-[9px] text-yellow-600 font-bold uppercase mt-2 tracking-widest">
                        {new Date(remark.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {/* Our Bank Details */}
            <Card className="rounded-3xl border-none shadow-xl bg-[#0d1017] text-white p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck className="w-32 h-32 text-white" />
              </div>
              <div className="relative z-10 space-y-8">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ffb84f] mb-6 underline decoration-primary decoration-2 underline-offset-8">Deposit To</h3>
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Bank Name</p>
                      <p className="text-lg font-black tracking-tight">COMMERCIAL BANK OF CEYLON</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Account Number</p>
                      <p className="text-2xl font-black tracking-[4px] text-white">0103 2492 4920 001</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Account Holder</p>
                      <p className="font-bold tracking-tight">FIVENEURALS (PVT) LTD</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-neutral-400 uppercase mb-1">Branch</p>
                      <p className="font-bold tracking-tight uppercase">COLOMBO 07 - MAIN BRANCH</p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/10 space-y-4">
                  <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                    <Info className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-red-300 mb-1">Critical Requirement</p>
                      <p className="text-[11px] text-neutral-400 font-medium leading-relaxed uppercase">
                        Reference Number <span className="text-[#ffb84f] font-bold tracking-widest">#{invoice.id.substring(0, 8).toUpperCase()}</span> must be mentioned on the deposit slip or transaction description.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Verification Process Card */}
            <Card className="rounded-3xl border border-neutral-200/50 shadow-lg bg-white p-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-6">Verification Process</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center shrink-0 border border-neutral-100">
                    <CheckCircle2 className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase mb-1">Submission</h4>
                    <p className="text-[11px] text-neutral-500 font-medium">Your data is securely uploaded to our admin portal.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center shrink-0 border border-neutral-100">
                    <Clock className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase mb-1">Reviewing</h4>
                    <p className="text-[11px] text-neutral-500 font-medium">Accounting team verifies the transfer with our bank.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center shrink-0 border border-neutral-100">
                    <Calendar className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase mb-1">Activation</h4>
                    <p className="text-[11px] text-neutral-500 font-medium">Once verified, your subscription will be activated automatically.</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Subscription Detail Sidebar */}
            <Card className="rounded-3xl border border-neutral-200/50 shadow-lg bg-white p-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-4">{invoice.plan ? 'Subscription Plan' : 'Invoice Details'}</h4>
              <div className="bg-neutral-50 p-4 border border-neutral-100 text-center rounded-2xl">
                <div className="text-black font-black text-xl uppercase tracking-tighter">{invoice.plan?.name || invoice.paymentReason || 'Invoice Payment'}</div>
                <Badge variant="outline" className="mt-2 bg-white text-[10px] font-black uppercase tracking-widest border-black/5 rounded-full">
                  {invoice.plan ? 'Professional Subscription' : 'Ad Campaign'}
                </Badge>
              </div>
              <div className="mt-6 space-y-3">
                 <div className="flex justify-between text-[11px] text-neutral-500 uppercase font-black">
                    <span>Duration</span>
                    <span className="text-black">{invoice.plan ? '30 Days' : 'Custom'}</span>
                 </div>
                 <div className="flex justify-between text-[11px] text-neutral-500 uppercase font-black">
                    <span>Billing cycle</span>
                    <span className="text-black">{invoice.plan ? 'Monthly' : 'One-time'}</span>
                 </div>
                 <Separator className="bg-neutral-100 my-2" />
                 <div className="flex justify-between text-sm font-black text-black">
                    <span className="uppercase tracking-widest">Total cost</span>
                    <span>LKR {invoice.amount}</span>
                 </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    
  );
}
