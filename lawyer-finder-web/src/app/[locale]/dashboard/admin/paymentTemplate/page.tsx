'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function PaymentTemplatePage() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto min-h-screen bg-neutral-50 flex gap-6 flex-col xl:flex-row print:p-0 print:m-0 print:border-none print:w-full print:max-w-none print:bg-white print:block">
      <title>Invoice Management | Lawyer.ai Admin</title>
      
      {/* Invoice Document Wrapper */}
      <div className="flex-1 bg-white shadow-xl p-4 sm:p-8 md:p-10 overflow-x-auto print:p-0 print:shadow-none print:m-0 border border-neutral-200 print:border-none rounded-none relative print:overflow-visible print:block print:w-full print:max-w-none">
        <div 
          ref={printRef} 
          className="print-area mx-auto text-[#0a0a0a] font-sans w-full max-w-[850px] min-w-[320px] flex flex-col print:max-w-none print:w-full print:min-w-0"
        >
          {/* Header Section */}
          <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <img src="/logo.png" alt="TheLawyr Logo" className="h-10 w-auto object-contain" />
                <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase text-black">Lawyer.ai</h1>
              </div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-400">
                FiveNeurals (PVT) Ltd · Legal Tech Division
              </p>
            </div>
            
            <div className="text-right">
              <h2 className="text-2xl sm:text-3xl font-light tracking-tighter mb-0 text-neutral-900 uppercase">Invoice</h2>
              <p className="text-[9px] sm:text-[10px] font-mono text-neutral-500 uppercase tracking-wider">#LAI-2026-10492</p>
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
                <p className="font-bold text-black border-l-2 sm:border-l-0 sm:border-r-2 print:border-l-0 print:border-r-2 border-black pl-3 sm:pl-0 pr-0 sm:pr-3 print:pl-0 print:pr-3 mb-1">Upali Bandara, Attorney-at-Law</p>
                <div className="pl-3 sm:pl-0 pr-0 sm:pr-3 print:pl-0 print:pr-3 opacity-80 leading-snug text-[12px]">
                  <p>Kandy Chambers, Suite 04, Kandy</p>
                  <p>upali@lawyers.lk | Client: LAI-USR-9302</p>
                </div>
              </div>
            </div>
          </div>

          {/* Date & Meta Info Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 bg-neutral-50 border-y border-neutral-100 py-3 px-3 sm:px-4 print:bg-neutral-50" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div>
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5 uppercase">Date</span>
              <span className="text-[10px] sm:text-xs font-bold text-neutral-900 tracking-tight">April 06, 2026</span>
            </div>
            <div>
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5 uppercase">Terms</span>
              <span className="text-[10px] sm:text-xs font-bold text-neutral-900 tracking-tight">Net 15 Days</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5 uppercase">Due</span>
              <span className="text-[10px] sm:text-xs font-bold text-red-600 tracking-tight">April 21, 2026</span>
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
                    <p className="font-bold text-black mb-0.5">Premium Lawyer Profile Promotion (Monthly)</p>
                    <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium leading-relaxed italic">Featured placement in results.</p>
                  </td>
                  <td className="py-4 text-center font-medium">8,500.00</td>
                  <td className="py-4 text-center font-medium text-neutral-400">1</td>
                  <td className="py-4 text-right font-bold tracking-tight">8,500.00</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-4 pr-4 align-top">
                    <p className="font-bold text-black mb-0.5">Featured Directory Ad Slots</p>
                    <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium leading-relaxed italic">Sidebar advertising placement.</p>
                  </td>
                  <td className="py-4 text-center font-medium">2,500.00</td>
                  <td className="py-4 text-center font-medium text-neutral-400">12</td>
                  <td className="py-4 text-right font-bold tracking-tight">30,000.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Section - Forced Table Layout for and Print Reliability */}
          <div className="w-full mb-8">
            <div className="flex flex-col md:flex-row justify-between gap-6 md:gap-10 items-start print:flex-row print:gap-10 print:flex-nowrap">
              {/* Payment Details */}
              <div className="bg-neutral-50 p-5 border-l-4 border-black print:bg-neutral-50 w-full md:w-[320px] print:w-[320px] shrink-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <h5 className="text-[10px] font-bold text-black uppercase tracking-widest mb-3 uppercase">Payment Details</h5>
                <div className="grid grid-cols-[80px_1fr] text-[11px] gap-y-1.5 gap-x-2">
                  <span className="text-neutral-400 uppercase font-bold text-[8px]">Bank:</span>
                  <span className="font-bold text-neutral-900 uppercase">Commercial Bank</span>
                  <span className="text-neutral-400 uppercase font-bold text-[8px]">Account:</span>
                  <span className="font-bold text-neutral-900 tracking-wider">0103 2492 4920 492</span>
                  <span className="text-neutral-400 uppercase font-bold text-[8px]">Ref:</span>
                  <span className="font-black text-black underline uppercase tracking-tight">#LAI-10492</span>
                </div>
              </div>

              {/* Totals Table */}
              <div className="w-full md:w-[320px] print:w-[320px] ml-auto shrink-0 mt-4 md:mt-0 print:mt-0">
                 <table className="w-full">
                   <tbody>
                     <tr className="text-[11px] font-semibold text-neutral-500">
                       <td className="py-1 uppercase tracking-wider text-[9px]">Sub-Total</td>
                       <td className="py-1 text-right text-neutral-900 font-bold">38,500.00 LKR</td>
                     </tr>
                     <tr className="text-[11px] font-semibold text-neutral-500">
                       <td className="py-1 uppercase tracking-wider text-[9px]">Tax (VAT 0%)</td>
                       <td className="py-1 text-right text-neutral-900 font-bold">0.00 LKR</td>
                     </tr>
                     <tr>
                       <td colSpan={2} className="py-2">
                         <div className="grand-total-box w-full bg-black text-white p-4 flex justify-between items-center sm:p-5 print:bg-black print:text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', backgroundColor: '#000000', color: '#ffffff' }}>
                            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.2em] text-white/70">Grand Total</span>
                            <span className="text-xl sm:text-2xl font-black text-white tracking-tight">38,500.00 LKR</span>
                         </div>
                       </td>
                     </tr>
                   </tbody>
                 </table>
              </div>
            </div>
          </div>

          {/* Signature/Footer Notice */}
          <div className="mt-6 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0 print:flex-row print:items-end print:gap-0 pt-6">
            <div className="space-y-2 w-full sm:max-w-[400px] print:max-w-[400px]">
              <div className="p-3 border border-dashed border-neutral-200">
                <p className="text-[10px] sm:text-[11px] text-neutral-500 font-medium leading-relaxed italic">
                  Note: This is a computer generated invoice and does not require a physical signature.
                </p>
              </div>
              <p className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                © 2026 FiveNeurals (PVT) Ltd
              </p>
            </div>
            <div className="text-left sm:text-right print:text-right w-full sm:w-auto print:w-auto">
               <div className="mb-2 inline-block w-32 border-b border-black py-4 opacity-10"></div>
               <p className="text-[9px] font-bold text-black uppercase tracking-widest">Authorized Head</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Control Panel */}
      <div className="w-full xl:w-[320px] shrink-0 print:hidden">
        <div className="bg-white p-6 md:p-8 border border-neutral-200 sticky top-10 shadow-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-neutral-900 flex items-center justify-center border border-neutral-100">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-black uppercase tracking-tighter text-lg leading-none">Invoice Actions</h3>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Management Console</p>
            </div>
          </div>
          <div className="space-y-3">
            <Button 
              onClick={handlePrint}
              className="w-full flex items-center justify-between gap-2 bg-[#0a0a0a] text-white rounded-none hover:bg-neutral-800 h-14 px-6 group"
            >
              <div className="flex items-center gap-3">
                <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="uppercase text-xs font-bold tracking-widest">Save Invoice</span>
              </div>
              <ArrowLeft className="w-4 h-4 rotate-180 opacity-20" />
            </Button>
          </div>

        </div>
      </div>

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
          /* Override layout wrappers */
          #__next, .sidebar-root, main, .flex-1, .min-h-screen {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
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

