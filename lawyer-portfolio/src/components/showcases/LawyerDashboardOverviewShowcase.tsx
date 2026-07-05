import { useState } from 'react';
import {
  Inbox, FileText, Star, ShieldCheck,
  Eye, CheckCircle, AlertTriangle
} from 'lucide-react';
import MockDashboardSidebar from '../MockDashboardSidebar';
import MockDashboardHeader from '../MockDashboardHeader';

export default function LawyerDashboardOverviewShowcase() {
  const [subscriptionActive, setSubscriptionActive] = useState(true);

  return (
    <div className="w-full bg-[#fbf9f6] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none">

      {/* Lawyer Dashboard Top bar */}
      <MockDashboardHeader title="Lawyer Portal" />

      {/* Main dashboard splits */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-grow min-h-[500px]">

        {/* LEFT COLUMN: Sidebar */}
        <div className="hidden md:block md:col-span-3">
          <MockDashboardSidebar activeTab="Dashboard" />
        </div>

        {/* RIGHT COLUMN: Dashboard Overview Content */}
        <div className="col-span-1 md:col-span-9 p-5 bg-neutral-50 flex flex-col gap-4 max-h-[520px] overflow-y-auto">

          {/* Welcome Header */}
          <div className="flex items-center justify-between border-b border-neutral-250 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-normal tracking-tight text-neutral-900 leading-none">Welcome back, Dr. Lakmal Perera</h1>
                <span className="inline-flex items-center gap-1 rounded bg-[#0a0a0a] text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Verified
                </span>
              </div>
              <p className="text-[10px] text-neutral-455 mt-1 font-light">BASL Registration: BASL/8821/COL</p>
            </div>
          </div>

          {/* Subscription Status Card */}
          <div className={`bg-white border p-4 shadow-sm border-l-4 ${subscriptionActive ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center ${subscriptionActive ? 'bg-green-100 text-green-755' : 'bg-red-100 text-red-755'}`}>
                  {subscriptionActive ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-xs">Pro Chambers Plan</p>
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded ${subscriptionActive ? 'bg-green-105 text-green-800' : 'bg-red-105 text-red-800'}`}>
                      {subscriptionActive ? 'Active' : 'Expired'}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Monthly billing cycle · {subscriptionActive ? '24 days remaining' : 'Please renew your account'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSubscriptionActive(!subscriptionActive)}
                className="text-[9px] font-bold uppercase tracking-wider border border-neutral-250 px-3 py-1.5 hover:bg-neutral-50 transition-colors"
              >
                {subscriptionActive ? 'Simulate Expire' : 'Renew Subscription'}
              </button>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-neutral-200 p-4 shadow-xs flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-100 flex items-center justify-center text-neutral-605">
                <Inbox className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-neutral-900 leading-none">3</p>
                <p className="text-[9px] text-neutral-450 font-bold uppercase tracking-wider mt-0.5">Pending Inquiries</p>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-4 shadow-xs flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-100 flex items-center justify-center text-neutral-605">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-neutral-900 leading-none">14</p>
                <p className="text-[9px] text-neutral-450 font-bold uppercase tracking-wider mt-0.5">Published Articles</p>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-4 shadow-xs flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-100 flex items-center justify-center text-[#bfa37a]">
                <Star className="h-4 w-4 fill-amber-400 text-amber-405" />
              </div>
              <div>
                <p className="text-lg font-bold text-neutral-900 leading-none">25</p>
                <p className="text-[9px] text-neutral-455 font-bold uppercase tracking-wider mt-0.5">Approved Reviews</p>
              </div>
            </div>
          </div>

          {/* Recent Inquiries Section */}
          <div className="bg-white border border-neutral-200 p-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-3 flex items-center gap-1.5">
              <Inbox className="h-3.5 w-3.5 text-neutral-400" />
              Recent Inquiries
            </h2>
            <div className="space-y-2">
              {[
                {
                  id: 'inq-1',
                  clientName: 'Sandamal Silva',
                  clientEmail: 'sandamal@gmail.com',
                  message: 'Hello, my landlord disconnected the water supply yesterday because I did not agree to a rent increase. I need legal help to stop this.',
                  date: 'Just now'
                },
                {
                  id: 'inq-2',
                  clientName: 'Sashini Fonseka',
                  clientEmail: 'sashini.f@yahoo.com',
                  message: 'I have a land dispute regarding boundary lines in Kotte. Do you handle boundary demarcation cases?',
                  date: 'Yesterday'
                }
              ].map((inq) => (
                <div key={inq.id} className="border border-neutral-100 p-3 bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-900">{inq.clientName}</span>
                        <span className="text-[8px] border border-neutral-250 bg-white px-1.5 py-0.2 rounded font-mono text-neutral-450">PENDING</span>
                      </div>
                      <p className="text-[9px] text-neutral-450 font-light mt-0.5">{inq.clientEmail}</p>
                      <p className="text-xs text-neutral-600 font-light mt-1.5 line-clamp-2 leading-relaxed">{inq.message}</p>
                    </div>
                    <span className="text-[9px] text-neutral-450 whitespace-nowrap">{inq.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Profile Preview Summary */}
          <div className="bg-white border border-neutral-200 p-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-3 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-neutral-400" />
              Profile Summary Preview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-light">
              <div className="space-y-1">
                <p className="text-neutral-450 font-bold uppercase tracking-wider text-[8px]">Practice Location</p>
                <p className="font-bold text-neutral-800">Colombo District, Sri Lanka</p>
              </div>
              <div className="space-y-1">
                <p className="text-neutral-450 font-bold uppercase tracking-wider text-[8px]">Languages Spoken</p>
                <div className="flex gap-1 flex-wrap">
                  {['Sinhala', 'English'].map(lang => (
                    <span key={lang} className="text-[8px] bg-neutral-100 text-neutral-500 font-bold uppercase px-1.5 py-0.5">{lang}</span>
                  ))}
                </div>
              </div>
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <p className="text-neutral-450 font-bold uppercase tracking-wider text-[8px]">Specialization Practice Areas</p>
                <div className="flex gap-1 flex-wrap">
                  {['Family Law', 'Tenancy Disputes', 'Property Disputes', 'Civil Litigation'].map(area => (
                    <span key={area} className="text-[8px] bg-neutral-100 text-neutral-500 font-bold uppercase px-1.5 py-0.5">{area}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
