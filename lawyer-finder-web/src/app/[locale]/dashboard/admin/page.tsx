'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Shield, Users, Inbox, FileText, Star,
  LayoutDashboard, TrendingUp, UserPlus, Scale,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';

interface AdminData {
  stats: {
    totalVerified: number;
    pendingApprovals: number;
    totalInquiries: number;
    totalArticles: number;
    pendingReviewCount: number;
    totalUsers: number;
    totalLawyers: number;
    totalClients: number;
  };
  monthlyData: { month: string; lawyers: number; clients: number }[];
  pendingLawyers: any[];
  pendingReviews: any[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin')
      .then((res) => res.json())
      .then(setData)
      .catch(() => toast.error('Failed to load admin data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="h-8 w-48 bg-neutral-200 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-white border border-neutral-200 animate-pulse" />
          <div className="h-80 bg-white border border-neutral-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const statCards = [
    { label: 'Total Users', value: data.stats.totalUsers, icon: Users, trend: '+12%', up: true },
    { label: 'Verified Lawyers', value: data.stats.totalVerified, icon: Shield, trend: '+5%', up: true },
    { label: 'Pending Approvals', value: data.stats.pendingApprovals, icon: UserPlus, trend: data.stats.pendingApprovals > 0 ? 'Action needed' : 'Clear', up: false },
    { label: 'Total Clients', value: data.stats.totalClients, icon: Scale, trend: '+8%', up: true },
    { label: 'Total Inquiries', value: data.stats.totalInquiries, icon: Inbox, trend: '+3%', up: true },
    { label: 'Published Articles', value: data.stats.totalArticles, icon: FileText, trend: 'Active', up: true },
    { label: 'Pending Reviews', value: data.stats.pendingReviewCount, icon: Star, trend: data.stats.pendingReviewCount > 0 ? 'Needs review' : 'Clear', up: false },
    { label: 'Platform Health', value: '99%', icon: TrendingUp, trend: 'Stable', up: true },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#efeae0] pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#faf8f6] border border-[#efeae0] text-[#bfa37a]">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-serif text-neutral-900">Dashboard</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-450 mt-1">Platform overview and analytics</p>
          </div>
        </div>
      </div>
 
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-md transition-all duration-300 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 bg-[#faf8f6] border border-[#efeae0] flex items-center justify-center rounded-xl text-[#bfa37a]">
                <stat.icon className="h-5 w-5" />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 border ${
                stat.up 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-150' 
                  : 'bg-amber-50 text-amber-800 border-amber-150'
              }`}>
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">{stat.value}</p>
              <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
 
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lawyers Monthly Chart */}
        <div className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-sm">
          <div className="mb-6 border-b border-[#efeae0] pb-4">
            <h3 className="text-base font-bold uppercase tracking-widest text-neutral-800 font-serif">Lawyers Registered</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-1.5">Monthly lawyer registrations (last 12 months)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f0eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8c8c8c', fontFamily: 'Outfit' }} stroke="#efeae0" />
                <YAxis tick={{ fontSize: 10, fill: '#8c8c8c', fontFamily: 'Outfit' }} stroke="#efeae0" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #efeae0',
                    borderRadius: '12px',
                    color: '#161616',
                    fontSize: '11px',
                    fontFamily: 'Outfit, sans-serif',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                />
                <Bar dataKey="lawyers" fill="#bfa37a" name="Lawyers" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
 
        {/* Clients Monthly Chart */}
        <div className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-sm">
          <div className="mb-6 border-b border-[#efeae0] pb-4">
            <h3 className="text-base font-bold uppercase tracking-widest text-neutral-800 font-serif">Clients Registered</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-1.5">Monthly client registrations (last 12 months)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyData}>
                <defs>
                  <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#bfa37a" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#bfa37a" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f0eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8c8c8c', fontFamily: 'Outfit' }} stroke="#efeae0" />
                <YAxis tick={{ fontSize: 10, fill: '#8c8c8c', fontFamily: 'Outfit' }} stroke="#efeae0" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #efeae0',
                    borderRadius: '12px',
                    color: '#161616',
                    fontSize: '11px',
                    fontFamily: 'Outfit, sans-serif',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                />
                <Area type="monotone" dataKey="clients" stroke="#bfa37a" fill="url(#colorClients)" name="Clients" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
 
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Approvals Summary */}
        <div className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-sm">
          <h3 className="text-base font-bold uppercase tracking-widest text-neutral-800 mb-6 flex items-center gap-2 font-serif border-b border-[#efeae0] pb-4">
            <Shield className="w-4.5 h-4.5 text-[#bfa37a]" />
            Pending Verifications
          </h3>
          {data.pendingLawyers.length === 0 ? (
            <p className="text-xs text-neutral-400 py-12 text-center font-light">No pending verifications</p>
          ) : (
            <div className="space-y-3">
              {data.pendingLawyers.slice(0, 3).map((lawyer: any) => (
                <div key={lawyer.id} className="flex items-center justify-between border border-[#efeae0]/60 p-4 rounded-xl hover:border-[#bfa37a]/30 hover:shadow-md transition-all duration-300">
                  <div>
                    <p className="text-sm font-bold font-serif text-neutral-900">{lawyer.fullName}</p>
                    <p className="text-[10px] text-neutral-450 uppercase tracking-widest mt-0.5">BASL: {lawyer.baslNumber}</p>
                  </div>
                  <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">PENDING</span>
                </div>
              ))}
              {data.pendingLawyers.length > 3 && (
                <p className="text-xs text-[#bfa37a] font-semibold text-center pt-2 cursor-pointer hover:underline">+{data.pendingLawyers.length - 3} more records</p>
              )}
            </div>
          )}
        </div>
 
        {/* Pending Reviews Summary */}
        <div className="bg-white border border-[#efeae0] p-6 rounded-2xl shadow-sm">
          <h3 className="text-base font-bold uppercase tracking-widest text-neutral-800 mb-6 flex items-center gap-2 font-serif border-b border-[#efeae0] pb-4">
            <Star className="w-4.5 h-4.5 text-[#bfa37a]" />
            Pending Reviews
          </h3>
          {data.pendingReviews.length === 0 ? (
            <p className="text-xs text-neutral-400 py-12 text-center font-light">No pending reviews</p>
          ) : (
            <div className="space-y-3">
              {data.pendingReviews.slice(0, 3).map((review: any) => (
                <div key={review.id} className="flex items-center justify-between border border-[#efeae0]/60 p-4 rounded-xl hover:border-[#bfa37a]/30 hover:shadow-md transition-all duration-300">
                  <div>
                    <p className="text-sm font-bold font-serif text-neutral-900">{review.reviewerName}</p>
                    <p className="text-[10px] text-neutral-450 uppercase tracking-widest mt-0.5">For: {review.lawyer.fullName}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
 
        {/* System Overview */}
        <div className="bg-[#161616] text-white p-6 rounded-2xl flex flex-col shadow-md">
          <h3 className="text-base font-bold uppercase tracking-widest mb-6 flex items-center gap-2 font-serif text-white border-b border-neutral-800 pb-4">
            <TrendingUp className="w-4.5 h-4.5 text-[#bfa37a]" />
            System Overview
          </h3>
          <div className="space-y-4 flex-1 justify-center flex flex-col">
            <div className="flex items-center justify-between py-3.5 border-b border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Lawyers Registered</span>
              <span className="text-lg font-bold text-[#bfa37a] font-serif">{data.stats.totalLawyers}</span>
            </div>
            <div className="flex items-center justify-between py-3.5 border-b border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Active Clients</span>
              <span className="text-lg font-bold text-[#bfa37a] font-serif">{data.stats.totalClients}</span>
            </div>
            <div className="flex items-center justify-between py-3.5 border-b border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Total Inquiries</span>
              <span className="text-lg font-bold text-[#bfa37a] font-serif">{data.stats.totalInquiries}</span>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Articles Published</span>
              <span className="text-lg font-bold text-[#bfa37a] font-serif">{data.stats.totalArticles}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
