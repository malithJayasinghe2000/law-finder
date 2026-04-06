'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Printer, ArrowLeft, CreditCard, Banknote, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';

interface InvoiceClientProps {
  locale: string;
  plan: any;
  user: any;
  billingCycle: string;
}

export default function InvoiceClient({ locale, plan, user, billingCycle }: InvoiceClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const amount = billingCycle === 'monthly' ? plan.monthlyAmount : plan.yearlyAmount;
  const date = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric'
  });
  const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric'
  });

  const invoiceNumber = `LAI-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto min-h-screen bg-neutral-50 flex gap-6 flex-col xl:flex-row print:p-0 print:m-0 print:border-none print:w-full print:max-w-none print:bg-white print:block">
      <title>Your Invoice | Lawyer.ai</title>
      
      {/* Invoice Document Wrapper */}
      <div className="flex-1 bg-white shadow-xl p-4 sm:p-8 md:p-10 overflow-x-auto print:p-0 print:shadow-none print:m-0 border border-neutral-200 print:border-none rounded-none relative print:overflow-visible print:block print:w-full print:max-w-none">
        <div className="print-area mx-auto text-[#0a0a0a] font-sans w-full max-w-[850px] min-w-[320px] flex flex-col print:max-w-none print:w-full print:min-w-0">
          {/* Header Section */}
          <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-black text-white p-2 print:bg-black print:text-white shrink-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase text-black">Lawyer.ai</h1>
              </div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-400">
                FiveNeurals (PVT) Ltd · Legal Tech Division
              </p>
            </div>
            
            <div className="text-right">
              <h2 className="text-2xl sm:text-3xl font-light tracking-tighter mb-0 text-neutral-900 uppercase">Invoice</h2>
              <p className="text-[9px] sm:text-[10px] font-mono text-neutral-500 uppercase tracking-wider">#{invoiceNumber}</p>
            </div>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 text-[13px] print:grid-cols-2">
            <div>
              <h4 className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-3 uppercase">Issued By</h4>
              <div className="font-medium text-neutral-800">
                <p className="font-bold text-black border-l-2 border-black pl-3 mb-1">FiveNeurals (PVT) LTD</p>
                <div className="pl-3 opacity-80 leading-snug text-[12px]">
                  <p>No 12, Flower Road, Colombo 07</p>
                  <p>contact@lawyer.ai | +94 11 234 5678</p>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right print:text-right">
              <h4 className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-3 uppercase">Bill To</h4>
              <div className="font-medium text-neutral-800">
                <p className="font-bold text-black border-l-2 sm:border-l-0 sm:border-r-2 print:border-l-0 print:border-r-2 border-black pl-3 sm:pl-0 pr-0 sm:pr-3 print:pl-0 print:pr-3 mb-1">
                  {user?.fullName || 'Valued Lawyer'}
                </p>
                <div className="pl-3 sm:pl-0 pr-0 sm:pr-3 print:pl-0 print:pr-3 opacity-80 leading-snug text-[12px]">
                  <p>{user?.email}</p>
                  <p>Client ID: LAI-USR-{user?.userId?.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Date & Meta Info Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 bg-neutral-50 border-y border-neutral-100 py-3 px-3 sm:px-4 print:bg-neutral-50" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div>
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5 uppercase">Date</span>
              <span className="text-[10px] sm:text-xs font-bold text-neutral-900 tracking-tight">{date}</span>
            </div>
            <div>
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5 uppercase">Terms</span>
              <span className="text-[10px] sm:text-xs font-bold text-neutral-900 tracking-tight">Net 15 Days</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5 uppercase">Due</span>
              <span className="text-[10px] sm:text-xs font-bold text-red-600 tracking-tight">{dueDate}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8 overflow-x-auto print:overflow-visible">
            <table className="w-full text-left min-w-[500px] print:min-w-0">
              <thead>
                <tr className="border-b-2 border-black text-[10px] text-black font-extrabold uppercase tracking-widest">
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 text-center w-24 sm:w-28">Rate (LKR)</th>
                  <th className="py-3 text-center w-16 sm:w-20">Qty</th>
                  <th className="py-3 text-right w-28 sm:w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="text-[12px] sm:text-[13px]">
                <tr className="border-b border-neutral-100">
                  <td className="py-4 pr-4 align-top">
                    <p className="font-bold text-black mb-0.5">{plan.name} Subscription ({billingCycle})</p>
                    <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium leading-relaxed italic">Access to professional legal platform features.</p>
                  </td>
                  <td className="py-4 text-center font-medium">{amount.toLocaleString()}</td>
                  <td className="py-4 text-center font-medium text-neutral-400">1</td>
                  <td className="py-4 text-right font-bold tracking-tight">{amount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="w-full mb-8">
            <div className="flex flex-col md:flex-row justify-between gap-6 md:gap-10 items-start print:flex-row print:gap-10 print:flex-nowrap">
              {/* Payment Details */}
              <div className="bg-neutral-50 p-5 border-l-4 border-black print:bg-neutral-50 w-full md:w-[320px] print:w-[320px] shrink-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <h5 className="text-[10px] font-bold text-black uppercase tracking-widest mb-3 uppercase">Bank Information</h5>
                <div className="grid grid-cols-[80px_1fr] text-[11px] gap-y-1.5 gap-x-2">
                  <span className="text-neutral-400 uppercase font-bold text-[8px]">Bank:</span>
                  <span className="font-bold text-neutral-900 uppercase">Commercial Bank</span>
                  <span className="text-neutral-400 uppercase font-bold text-[8px]">Account:</span>
                  <span className="font-bold text-neutral-900 tracking-wider">0103 2492 4920 492</span>
                  <span className="text-neutral-400 uppercase font-bold text-[8px]">Ref:</span>
                  <span className="font-black text-black underline uppercase tracking-tight">#{invoiceNumber}</span>
                </div>
              </div>

              {/* Totals Table */}
              <div className="w-full md:w-[320px] print:w-[320px] ml-auto shrink-0 mt-4 md:mt-0 print:mt-0">
                 <table className="w-full">
                   <tbody>
                     <tr className="text-[11px] font-semibold text-neutral-500">
                       <td className="py-1 uppercase tracking-wider text-[9px]">Sub-Total</td>
                       <td className="py-1 text-right text-neutral-900 font-bold">{amount.toLocaleString()} LKR</td>
                     </tr>
                     <tr className="text-[11px] font-semibold text-neutral-500">
                       <td className="py-1 uppercase tracking-wider text-[9px]">Tax (VAT 0%)</td>
                       <td className="py-1 text-right text-neutral-900 font-bold">0.00 LKR</td>
                     </tr>
                     <tr>
                       <td colSpan={2} className="py-2">
                         <div className="grand-total-box w-full bg-black text-white p-4 flex justify-between items-center sm:p-5 print:bg-black print:text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', backgroundColor: '#000000', color: '#ffffff' }}>
                            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.2em] text-white/70">Grand Total</span>
                            <span className="text-xl sm:text-2xl font-black text-white tracking-tight">{amount.toLocaleString()} LKR</span>
                         </div>
                       </td>
                     </tr>
                   </tbody>
                 </table>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="mt-6 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0 print:flex-row print:items-end print:gap-0 pt-6">
            <div className="space-y-2 w-full sm:max-w-[400px] print:max-w-[400px]">
              <div className="p-3 border border-dashed border-neutral-200">
                <p className="text-[10px] sm:text-[11px] text-neutral-500 font-medium leading-relaxed italic">
                  Note: This is an unpaid invoice. Please complete the payment to activate your subscription.
                </p>
              </div>
              <p className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                © 2026 FiveNeurals (PVT) Ltd
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-full xl:w-[320px] shrink-0 print:hidden">
        <div className="bg-white p-6 md:p-8 border border-neutral-200 sticky top-10 shadow-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-neutral-900 flex items-center justify-center border border-neutral-100">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-black uppercase tracking-tighter text-lg leading-none">Invoice Actions</h3>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Payment Status: UNPAID</p>
            </div>
          </div>
          
          <div className="space-y-3">
             <Button 
                onClick={() => setIsModalOpen(true)}
                className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-none hover:bg-primary/90 h-14 px-6 group shadow-lg shadow-primary/20"
              >
                <CreditCard className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="uppercase text-xs font-bold tracking-widest">Pay Now</span>
              </Button>

            <Button 
              onClick={handlePrint}
              variant="outline"
              className="w-full flex items-center justify-between gap-2 border-neutral-200 text-neutral-900 rounded-none hover:bg-neutral-50 h-14 px-6 group"
            >
              <div className="flex items-center gap-3">
                <Printer className="w-4 h-4" />
                <span className="uppercase text-xs font-bold tracking-widest">Print / Save</span>
              </div>
            </Button>
            
            <Button 
              onClick={() => router.back()}
              variant="ghost"
              className="w-full flex items-center justify-center gap-2 text-neutral-500 hover:text-black rounded-none h-12"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Back to Pricing</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Selection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-none border-t-4 border-t-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Choose Payment Method</DialogTitle>
            <DialogDescription className="text-neutral-500 font-medium pt-2">
              Select how you would like to pay for your subscription.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-6">
            {/* Online Payment Option */}
            <div className="relative group grayscale">
              <Button 
                disabled
                className="w-full h-24 bg-white border border-neutral-200 text-neutral-400 flex flex-col items-center justify-center gap-2 hover:bg-neutral-50 rounded-none transition-all"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6" />
                  <span className="text-lg font-bold uppercase tracking-tight">Online Payment</span>
                </div>
                <Badge variant="secondary" className="bg-neutral-100 text-[10px] tracking-widest uppercase py-0">Coming Soon</Badge>
              </Button>
              <p className="text-[10px] text-center mt-2 font-bold text-neutral-400 uppercase tracking-widest">Credit / Debit Card, KOKO, Mintpay</p>
            </div>

            <div className="relative">
               <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-neutral-200" />
               </div>
               <div className="relative flex justify-center text-[10px] uppercase font-black">
                  <span className="bg-white px-4 text-neutral-400 tracking-[0.2em]">OR</span>
               </div>
            </div>

            {/* Offline Payment Option */}
            <Button 
              onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/offline/${plan.id}?cycle=${billingCycle}&amount=${amount}&invoice=${invoiceNumber}`)}
              className="w-full h-24 bg-neutral-900 text-white flex flex-col items-center justify-center gap-2 hover:bg-neutral-800 rounded-none transition-all shadow-xl group"
            >
              <div className="flex items-center gap-3">
                <Banknote className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-lg font-bold uppercase tracking-tight">Offline Payment</span>
              </div>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-medium">Bank Transfer / Cash Deposit</p>
            </Button>
          </div>
          
          <DialogFooter className="sm:justify-start">
             <div className="flex items-center gap-2 text-neutral-400 py-2 border-t border-dotted border-neutral-200 w-full">
                <HelpCircle className="w-3 h-3" />
                <span className="text-[10px] font-medium italic">Need help with payments? Contact support at +94 11 234 5678</span>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          aside, nav, header, footer, .print\\:hidden, div[class*="Sidebar"], button {
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
          .grand-total-box {
            background-color: black !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
