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
import { ArrowLeft, Upload, Banknote, ShieldCheck, CheckCircle2, Clock, Calendar, Hash, CreditCard, Info, MessageSquare, Printer, X, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

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

  const isReadonly = invoice.status === 'PAID' || 
                     invoice.status === 'CANCELLED' || 
                     (invoice.status === 'PENDING' && (!!invoice.receiptImageUrl || (invoice.paymentDetails && typeof invoice.paymentDetails === 'object' && Object.keys(invoice.paymentDetails).length > 0)));

  const [showOfflineForm, setShowOfflineForm] = useState(isReadonly);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);

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
      transactionDate: invoice.paymentDetails?.transactionDate || '',
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
    if (data.amount < invoice.amount) {
      toast({
        title: 'Amount Too Low',
        description: `The actual amount paid cannot be lower than the payable amount of LKR ${invoice.amount.toLocaleString()}.00`,
        variant: 'destructive',
      });
      return;
    }
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
      setIsOfflineModalOpen(false);

      // Refresh page to show newly submitted details
      router.refresh();
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

  // Format dates for display
  const createdDate = new Date(invoice.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
  const dueDate = new Date(new Date(invoice.createdAt).getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
  const invoiceNumber = `LAI-${new Date(invoice.createdAt).getFullYear()}-${invoice.id.substring(0, 8).toUpperCase()}`;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto min-h-screen bg-neutral-50 flex gap-6 flex-col xl:flex-row print:p-0 print:m-0 print:border-none print:w-full print:max-w-none print:bg-white print:block">
      <title>{invoice.status === 'PAID' ? 'Payment Receipt' : 'Invoice'} | TheLawyr</title>

      {/* LEFT COLUMN: Standard Invoice Sheet */}
      <div className="flex-1 bg-white shadow-xl p-6 sm:p-10 border border-neutral-200 print:border-none print:p-0 print:shadow-none print:m-0 rounded-none relative print:overflow-visible print:block print:w-full print:max-w-none">
        <div className="mx-auto text-[#0a0a0a] font-sans w-full max-w-[850px] flex flex-col print:max-w-none print:w-full">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-2 mb-8 border-b-2 border-black pb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <img src="/logo.png" alt="TheLawyr Logo" className="h-10 w-auto object-contain" />
                <h1 className="text-xl sm:text-2xl font-normal tracking-tight uppercase text-black font-serif">TheLawyr</h1>
              </div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-normal text-neutral-400">
                FiveNeurals (PVT) Ltd · Legal Tech Division
              </p>
            </div>
            
            <div className="text-left sm:text-right w-full sm:w-auto">
              <h2 className="text-2xl sm:text-3xl font-light tracking-tighter mb-0 text-neutral-900 uppercase font-serif">
                {invoice.status === 'PAID' ? 'Receipt' : 'Invoice'}
              </h2>
              <p className="text-[9px] sm:text-[10px] font-mono text-neutral-500 uppercase tracking-wider">#{invoiceNumber}</p>
              
              <div className="mt-2">
                {invoice.status === 'PAID' ? (
                  <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 uppercase tracking-widest inline-block">
                    PAID
                  </span>
                ) : invoice.status === 'PENDING' && isReadonly ? (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 uppercase tracking-widest inline-block">
                    AWAITING VERIFICATION
                  </span>
                ) : invoice.status === 'RESUBMIT' ? (
                  <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 uppercase tracking-widest inline-block">
                    RE-SUBMISSION REQUIRED
                  </span>
                ) : invoice.status === 'CANCELLED' ? (
                  <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 uppercase tracking-widest inline-block">
                    CANCELLED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-150 px-2.5 py-1 uppercase tracking-widest inline-block">
                    UNPAID
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 text-[13px] print:grid-cols-2">
            <div>
              <h4 className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-3">Issued By</h4>
              <div className="font-medium text-neutral-800">
                <p className="font-bold text-black border-l-2 border-black pl-3 mb-1">FiveNeurals (PVT) LTD</p>
                <div className="pl-3 opacity-80 leading-snug text-[12px]">
                  <p>No 12, Flower Road, Colombo 07</p>
                  <p>contact@thelawyr.lk | +94 11 234 5678</p>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right print:text-right">
              <h4 className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-3">Bill To</h4>
              <div className="font-medium text-neutral-800">
                <p className="font-bold text-black border-l-2 sm:border-l-0 sm:border-r-2 print:border-l-0 print:border-r-2 border-black pl-3 sm:pl-0 pr-0 sm:pr-3 print:pl-0 print:pr-3 mb-1">
                  {invoice.lawyer?.user?.fullName || 'Valued Lawyer'}
                </p>
                <div className="pl-3 sm:pl-0 pr-0 sm:pr-3 print:pl-0 print:pr-3 opacity-80 leading-snug text-[12px]">
                  <p>{invoice.lawyer?.user?.email}</p>
                  <p>Client ID: LAI-USR-{invoice.lawyer?.user?.id?.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Date & Meta Info Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 bg-neutral-50 border-y border-neutral-100 py-3 px-3 sm:px-4" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div>
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5">Date Issued</span>
              <span className="text-[10px] sm:text-xs font-bold text-neutral-900 tracking-tight">{createdDate}</span>
            </div>
            <div>
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5">Payment Terms</span>
              <span className="text-[10px] sm:text-xs font-bold text-neutral-900 tracking-tight">Net 15 Days</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5">Due Date</span>
              <span className="text-[10px] sm:text-xs font-bold text-red-600 tracking-tight">{dueDate}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8 overflow-x-auto print:overflow-visible">
            <table className="w-full text-left min-w-[500px] print:min-w-0">
              <thead>
                <tr className="border-b-2 border-black text-[10px] text-black font-extrabold uppercase tracking-widest">
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 text-center w-28">Rate (LKR)</th>
                  <th className="py-3 text-center w-20">Qty</th>
                  <th className="py-3 text-right w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="text-[12px] sm:text-[13px]">
                <tr className="border-b border-neutral-100">
                  <td className="py-4 pr-4 align-top">
                    <p className="font-bold text-black mb-0.5">{invoice.paymentReason || 'Subscription Payment'}</p>
                    <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium leading-relaxed italic">
                      {invoice.plan ? 'Access to professional legal platform features.' : 'Paid promotional advertisement placement services.'}
                    </p>
                  </td>
                  <td className="py-4 text-center font-medium">{invoice.amount.toLocaleString()}.00</td>
                  <td className="py-4 text-center font-medium text-neutral-400">1</td>
                  <td className="py-4 text-right font-bold tracking-tight">{invoice.amount.toLocaleString()}.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-10">
            <div className="w-full max-w-[320px] text-sm">
              <div className="flex justify-between py-2 border-b border-neutral-100 text-neutral-500">
                <span className="uppercase tracking-widest text-[10px] font-bold">Subtotal</span>
                <span className="font-medium text-neutral-800">LKR {invoice.amount.toLocaleString()}.00</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100 text-neutral-500">
                <span className="uppercase tracking-widest text-[10px] font-bold">Tax / VAT (0%)</span>
                <span className="font-medium text-neutral-800">LKR 0.00</span>
              </div>
              <div className="flex justify-between py-3 border-b-2 border-black text-black font-bold text-base" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <span className="uppercase tracking-widest text-xs font-black">Total Due</span>
                <span className="text-[#bfa37a] tracking-tight font-black">LKR {invoice.amount.toLocaleString()}.00</span>
              </div>
            </div>
          </div>

          {/* Submitted Bank Transfer Slip Information (Readonly) */}
          {isReadonly && invoice.paymentDetails && typeof invoice.paymentDetails === 'object' && (
            <div className="border border-neutral-200 p-6 bg-neutral-50/50 mt-4 rounded-none print:hidden">
              <h3 className="font-serif font-medium text-md uppercase tracking-wider text-black border-b pb-2 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#bfa37a]" /> Submitted Offline Payment Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider text-[9px] font-bold">Sender's Bank Name</span>
                  <span className="font-bold text-neutral-900">{(invoice.paymentDetails as any).bankName}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider text-[9px] font-bold">Account Holder Name</span>
                  <span className="font-bold text-neutral-900">{(invoice.paymentDetails as any).accountHolder}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider text-[9px] font-bold">Account Number</span>
                  <span className="font-bold text-neutral-900">{(invoice.paymentDetails as any).accountNumber}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider text-[9px] font-bold">Transaction Reference ID</span>
                  <span className="font-mono font-bold text-neutral-900">{(invoice.paymentDetails as any).transactionId}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider text-[9px] font-bold">Actual Amount Paid</span>
                  <span className="font-bold text-neutral-900">LKR {Number((invoice.paymentDetails as any).amount || invoice.amount).toLocaleString()}.00</span>
                </div>
                <div>
                  <span className="text-neutral-400 block mb-0.5 uppercase tracking-wider text-[9px] font-bold">Submission Date</span>
                  <span className="font-bold text-neutral-900">
                    {new Date((invoice.paymentDetails as any).submittedAt || invoice.updatedAt).toLocaleString('en-US', {
                      month: 'long',
                      day: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              
              {invoice.receiptImageUrl && (
                <div className="mt-6 border-t border-neutral-100 pt-4">
                  <span className="text-neutral-400 block mb-2 uppercase tracking-wider text-[9px] font-bold">Uploaded Deposit Slip</span>
                  <div className="relative border border-neutral-200 inline-block bg-white p-2">
                    <img 
                      src={invoice.receiptImageUrl} 
                      alt="Deposit Slip Reference" 
                      className="max-h-48 object-contain" 
                    />
                    <a 
                      href={invoice.receiptImageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute bottom-4 right-4 bg-black/70 hover:bg-black text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors"
                    >
                      View Full Size
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin Remarks Notice History */}
          {invoice.remarks && invoice.remarks.length > 0 && (
            <div className="mt-8 border border-yellow-200 bg-yellow-50/50 p-6 rounded-none print:hidden">
              <h4 className="text-yellow-800 text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Reviews & Admin Notices
              </h4>
              <div className="space-y-3">
                {invoice.remarks.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="bg-white border border-yellow-100 p-4 text-xs shadow-sm">
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">{r.remark}</p>
                    <time className="block text-[9px] text-neutral-400 uppercase font-bold mt-2">
                      {new Date(r.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms Footer */}
          <div className="border-t border-neutral-200 pt-6 mt-16 text-center text-[10px] text-neutral-400 uppercase tracking-widest print:mt-10">
            <p className="font-bold text-neutral-700">Thank you for your business with TheLawyr.</p>
            <p className="mt-1">For any queries, please email contact@thelawyr.lk</p>
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN: Action Controls Sidebar */}
      <div className="w-full xl:w-96 bg-white border border-neutral-200 shadow-md p-6 sticky top-24 self-start space-y-6 print:hidden">
        <h3 className="font-serif font-medium text-lg border-b pb-3 text-black">Payment Details</h3>
        
        <div className="space-y-4">
          <div className="flex justify-between text-xs text-neutral-500 uppercase font-bold">
            <span>Invoice Status</span>
            <span className={`font-black ${invoice.status === 'PAID' ? 'text-green-600' : 'text-[#bfa37a]'}`}>
              {invoice.status}
            </span>
          </div>
          <div className="flex justify-between text-xs text-neutral-500 uppercase font-bold">
            <span>Payment Method</span>
            <span className="text-black font-black">BANK TRANSFER</span>
          </div>
          <Separator className="bg-neutral-100" />
          <div className="flex justify-between text-sm font-black text-black">
            <span className="uppercase tracking-widest text-xs">Total due</span>
            <span>LKR {invoice.amount.toLocaleString()}.00</span>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          {!isReadonly ? (
            <>
              <Button 
                onClick={() => setIsOfflineModalOpen(true)}
                className="w-full h-14 bg-black text-white hover:bg-neutral-800 rounded-none uppercase tracking-widest text-xs font-black transition-all flex items-center justify-center gap-2 border border-black shadow-md"
              >
                <Banknote className="w-4 h-4" /> Submit Payment (Offline)
              </Button>
              <Button 
                disabled
                className="w-full h-14 border border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed rounded-none uppercase tracking-widest text-xs font-black flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" /> Pay Online (Card) [Disabled]
              </Button>
            </>
          ) : (
            <div className="bg-neutral-50 border border-neutral-200 p-4 text-center">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Payment Status</p>
              {invoice.status === 'PAID' ? (
                <p className="text-sm font-black text-green-600 uppercase tracking-wider">Verified / Approved</p>
              ) : (
                <p className="text-sm font-black text-amber-600 uppercase tracking-wider">Awaiting Verification</p>
              )}
            </div>
          )}
          
          <Button 
            onClick={() => window.print()}
            variant="outline"
            className="w-full h-12 border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 rounded-none uppercase tracking-widest text-[10px] font-black flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>

          <Button 
            onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/invoices`)}
            variant="outline"
            className="w-full h-12 border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 rounded-none uppercase tracking-widest text-[10px] font-black flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Invoices
          </Button>
        </div>
      </div>

      {/* POPUP OVERLAY MODAL: Offline Payment Submission Form */}
      {isOfflineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-none border border-neutral-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200 my-8">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsOfflineModalOpen(false)}
              disabled={isSubmitting}
              className="absolute top-5 right-5 text-neutral-400 hover:text-black transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="h-1.5 bg-[#bfa37a] w-full" />
            
            <div className="p-8 sm:p-10">
              <div className="mb-6">
                <h2 className="text-xl font-normal tracking-tight font-serif text-black uppercase">Submit Bank Transfer Slip</h2>
                <p className="text-xs text-neutral-500 mt-1">Provide your bank deposit slip details below to initiate manual payment verification.</p>
              </div>

              {/* Bank Details Panel inside Modal */}
              <div className="bg-neutral-900 text-white p-6 mb-8 rounded-none relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <ShieldCheck className="w-24 h-24" />
                </div>
                <div className="relative z-10 space-y-4">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500 mb-2">Deposit Account</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-[9px] font-black text-neutral-400 uppercase">Bank Name</p>
                      <p className="font-bold uppercase tracking-tight">Commercial Bank of Ceylon</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-neutral-400 uppercase">Account Number</p>
                      <p className="font-bold tracking-widest">0103 2492 4920 001</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-neutral-400 uppercase">Account Holder</p>
                      <p className="font-bold uppercase">FiveNeurals (Pvt) Ltd</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-neutral-400 uppercase">Reference Code (Required)</p>
                      <p className="font-mono font-bold text-yellow-400">#{invoice.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form details */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Section 1: Bank Info */}
                <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-black border-b pb-1">Sender's Bank Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="bankName" className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider">Your Bank Name *</Label>
                      <Input
                        id="bankName"
                        {...register('bankName')}
                        placeholder="e.g. Commercial Bank, BOC"
                        disabled={isSubmitting}
                        className="rounded-none h-11 border-neutral-200 focus:ring-black focus:border-black text-xs"
                      />
                      {errors.bankName && <FieldError message={errors.bankName.message} />}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="accountHolder" className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider">Account Holder Name *</Label>
                      <Input
                        id="accountHolder"
                        {...register('accountHolder')}
                        placeholder="e.g. A. B. Perera"
                        disabled={isSubmitting}
                        className="rounded-none h-11 border-neutral-200 focus:ring-black focus:border-black text-xs"
                      />
                      {errors.accountHolder && <FieldError message={errors.accountHolder.message} />}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="accountNumber" className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider">Account Number *</Label>
                    <Input
                      id="accountNumber"
                      {...register('accountNumber')}
                      placeholder="Your bank account number"
                      disabled={isSubmitting}
                      className="rounded-none h-11 border-neutral-200 focus:ring-black focus:border-black text-xs"
                    />
                    {errors.accountNumber && <FieldError message={errors.accountNumber.message} />}
                  </div>
                </div>

                {/* Section 2: Reference Details */}
                <div className="space-y-4 pt-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-black border-b pb-1">Transaction Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="transactionId" className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider">Transaction Ref / ID *</Label>
                      <Input
                        id="transactionId"
                        {...register('transactionId')}
                        placeholder="e.g. FT12345678"
                        disabled={isSubmitting}
                        className="rounded-none h-11 border-neutral-200 focus:ring-black focus:border-black text-xs"
                      />
                      {errors.transactionId && <FieldError message={errors.transactionId.message} />}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="transactionDate" className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider">Date & Time *</Label>
                      <Input
                        id="transactionDate"
                        type="datetime-local"
                        {...register('transactionDate')}
                        disabled={isSubmitting}
                        className="rounded-none h-11 border-neutral-200 focus:ring-black focus:border-black text-xs"
                      />
                      {errors.transactionDate && <FieldError message={errors.transactionDate.message} />}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="amount" className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider">Actual Amount Paid (LKR) *</Label>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        {...register('amount', { valueAsNumber: true })}
                        placeholder={invoice.amount.toString()}
                        disabled={isSubmitting}
                        className="rounded-none h-11 border-neutral-200 focus:ring-black focus:border-black pl-12 font-bold text-sm"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-xs">LKR</span>
                    </div>
                    {errors.amount && <FieldError message={errors.amount.message} />}
                  </div>
                </div>

                {/* Section 3: Receipt upload */}
                <div className="space-y-4 pt-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-black border-b pb-1">Deposit Slip / Screenshot</h4>
                  <div className="space-y-2">
                    <div 
                      onClick={isSubmitting ? undefined : () => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-none p-6 text-center cursor-pointer transition-all ${
                        selectedFile ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
                      } ${isSubmitting ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                        accept="image/*"
                        disabled={isSubmitting}
                      />
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Upload className="w-5 h-5 text-neutral-400" />
                        {selectedFile ? (
                          <div>
                            <p className="text-xs font-bold text-neutral-800">{selectedFile.name}</p>
                            <p className="text-[9px] text-neutral-400 uppercase tracking-widest mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB · Change file</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-bold text-neutral-800">Upload transaction receipt image *</p>
                            <p className="text-[9px] text-neutral-400 uppercase tracking-widest mt-0.5">PNG, JPG, JPEG (Max 5MB)</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="w-full bg-neutral-100 h-1">
                        <div className="bg-black h-1 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider">Remarks / Notes</Label>
                    <Textarea
                      id="notes"
                      {...register('notes')}
                      placeholder="Any additional information..."
                      disabled={isSubmitting}
                      rows={2}
                      className="rounded-none border-neutral-200 focus:ring-black focus:border-black text-xs resize-none"
                    />
                  </div>
                </div>

                {/* Submission Action */}
                <div className="pt-4 border-t border-neutral-100 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOfflineModalOpen(false)}
                    disabled={isSubmitting}
                    className="flex-1 h-12 rounded-none uppercase text-xs tracking-wider"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !selectedFile}
                    className="flex-1 h-12 bg-black text-white hover:bg-neutral-800 rounded-none uppercase text-xs tracking-widest font-black disabled:bg-neutral-400"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Deposit Slip'}
                  </Button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
          }
          body * {
            box-sizing: border-box !important;
          }
          aside, nav, header, footer, .print\\:hidden, div[class*="Sidebar"], button, .no-print, [class*="RightColumn"], .submit-details-panel {
             display: none !important;
             height: 0 !important;
             width: 0 !important;
             visibility: hidden !important;
             opacity: 0 !important;
          }
          .print-area {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
    </div>
  );
}
