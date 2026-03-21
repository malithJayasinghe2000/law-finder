'use client';

import { useTranslations } from 'next-intl';

export default function AdminDashboard() {
  const t = useTranslations('Navigation');
  
  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8 w-full">
      <div className="flex items-center justify-between border-b pb-6">
        <h1 className="text-4xl font-black tracking-tight text-blue-900">{t('dashboard')} - Admin Panel</h1>
        <div className="flex gap-4">
          <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold border border-red-200 uppercase tracking-widest">Master Admin</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat Cards */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-medium mb-1 underline decoration-blue-500/30">Total Verified Lawyers</p>
          <p className="text-3xl font-black">24</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-medium mb-1 underline decoration-green-500/30">Pending Approvals</p>
          <p className="text-3xl font-black text-blue-600">07</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-medium mb-1 underline decoration-gray-500/30">Total Active Inquiries</p>
          <p className="text-3xl font-black">156</p>
        </div>
      </div>

      <div className="bg-white p-8 shadow-xl shadow-blue-900/5 rounded-3xl border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          Lawyers Pending Verification
        </h2>
        
        <div className="flex flex-col gap-4">
           {/* Table Header Placeholder */}
           <div className="grid grid-cols-4 bg-gray-50 p-4 rounded-xl font-bold text-gray-700">
             <span>Full Name</span>
             <span>BASL Number</span>
             <span>Date Joined</span>
             <span className="text-right">Action</span>
           </div>
           
           <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50">
             <span className="text-gray-400 font-medium italic">
                Scanning PostgreSQL for pending registrations...
             </span>
           </div>
        </div>
      </div>
    </div>
  );
}
