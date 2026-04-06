'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

export default function PaymentTemplatePage() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.print(); // Instruct user to save as PDF in print dialog
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto min-h-screen bg-gray-50 flex gap-8 flex-col xl:flex-row">
      <div className="flex-1 bg-white shadow-sm p-12 overflow-x-auto print:p-0 print:shadow-none print:m-0 border border-gray-200">
        <div 
          ref={printRef} 
          className="print-area min-w-[800px] text-gray-900 font-sans"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-24">
            <h1 className="text-4xl tracking-widest font-light text-gray-800">INVOICE</h1>
            <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center font-serif italic text-3xl font-light">
              d.
            </div>
          </div>

          {/* Addresses & Meta */}
          <div className="flex justify-between items-start mb-16 text-[15px] font-medium text-gray-600">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">LawyerAI Promo System</h2>
              <div className="grid grid-cols-[50px_1fr] gap-y-2 text-sm max-w-[200px]">
                <span className="text-gray-400">Nr:</span>
                <span>19-10XX</span>
                <span className="text-gray-400">From:</span>
                <span>04. Sep 2026</span>
              </div>
            </div>
            <div className="text-right text-sm leading-relaxed text-gray-500">
              LawyerAI Inc.<br/>
              Musterstraße 12<br/>
              80335 München<br/>
              Deutschland
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left mb-16 mt-8">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-400 font-normal">
                <th className="pb-4 font-normal">Description</th>
                <th className="pb-4 font-normal text-right w-32">Rate (LKR)</th>
                <th className="pb-4 font-normal text-right w-24">Quantity</th>
                <th className="pb-4 font-normal text-right w-40">Subtotal</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-medium text-gray-700 bg-[#f7f7f7] border-t border-white border-[10px]">
              <tr className="">
                <td className="py-6 px-4">Premium Lawyer Promotion</td>
                <td className="py-6 px-4 text-right">2500.00</td>
                <td className="py-6 px-4 text-right">12</td>
                <td className="py-6 px-4 text-right">30,000.00</td>
              </tr>
              <tr className="border-t-[4px] border-white bg-[#ececec]">
                <td className="py-6 px-4">Featured Directory Placement</td>
                <td className="py-6 px-4 text-right">2500.00</td>
                <td className="py-6 px-4 text-right">35</td>
                <td className="py-6 px-4 text-right">87,500.00</td>
              </tr>
            </tbody>
          </table>

          {/* Total & Bank Details */}
          <div className="flex justify-between items-end mb-24 bg-[#e8e8e8]">
            <div className="p-8 text-sm text-gray-500 max-w-[60%] leading-relaxed">
              <span className="font-semibold text-gray-700 block mb-3">Bank Details</span>
              <div className="grid grid-cols-[50px_1fr] gap-y-1">
                <span>IBAN:</span>
                <span className="font-medium text-gray-800">DE01 1234 0000 1234 5678 90</span>
                <span>BIC:</span>
                <span className="font-medium text-gray-800">SSXXEAMXXX</span>
              </div>
            </div>
            
            <div className="bg-black text-white p-8 min-w-[300px] text-right flex flex-col justify-end">
                <span className="text-gray-400 text-sm mb-2 block">Total Amount</span>
                <span className="text-3xl font-light">117,500.00 LKR</span>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center text-xs text-gray-400 mt-20 pt-8 border-t border-gray-200 pb-12 flex justify-between">
              <div className="grid grid-cols-[30px_1fr] text-left gap-y-2">
                 <span>A.</span><span>Musterstraße 12, 80335 München</span>
                 <span>T.</span><span>+49 123 4567 89 01</span>
                 <span>M.</span><span>hello@dominiktampe.de</span>
                 <span>W.</span><span>dominiktampe.de</span>
              </div>

              <div className="text-left leading-relaxed">
                 <span className="font-bold text-gray-700">Bank Details</span><br/>
                 Dominik Tampe<br/>
                 DE01 1234 0000 1234 5678 90<br/>
                 SSXXEAMXXX
              </div>

               <div className="text-right leading-relaxed">
                 <span className="font-bold text-gray-700">Tax Number</span><br/>
                 123/456/78910<br/>
                 Finanzamt München
              </div>
          </div>
        </div>
      </div>

      {/* Control Panel (Hidden on Print) */}
      <div className="w-full xl:w-72 shrink-0 print:hidden space-y-4">
        <div className="bg-white p-6 border border-gray-200 sticky top-10">
          <h3 className="font-semibold text-gray-800 mb-4 uppercase tracking-wider text-sm">Actions</h3>
          <p className="text-xs text-gray-500 mb-6">Print or save this invoice as a PDF document.</p>
          
          <Button 
            onClick={handlePrint}
            className="w-full flex items-center gap-2 mb-3 bg-black text-white rounded-none hover:bg-gray-800 h-12"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </Button>
          
          <Button 
            onClick={handleDownload}
            variant="outline"
            className="w-full flex items-center gap-2 rounded-none border-gray-300 h-12"
          >
            <Download className="w-4 h-4" />
            Save as PDF
          </Button>
          
          <div className="mt-6 pt-6 border-t border-gray-100 text-[11px] text-gray-400">
             * To download as PDF, click "Save as PDF" and select "Save as PDF" as the destination printer in the browser dialog.
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background-color: white;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, nav, aside { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print-area {
            width: 100% !important;
            max-width: none !important;
            min-w: auto;
          }
           @page {
            size: A4 portrait;
            margin: 1cm;
          }
        }
      `}} />
    </div>
  );
}
