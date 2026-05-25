'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Shield, Users, Inbox, FileText, Star,
  LayoutDashboard, TrendingUp, UserPlus, Scale,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
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
        <div className="h-8 w-48 bg-neutral-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-neutral-100 rounded-2xl animate-pulse" />
          ))}
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

  const tooltipStyle = { backgroundColor: '#0d1017', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: '600' };

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center bg-[#0d1017] text-white rounded-2xl shadow-lg">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 font-medium">Platform overview and analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white border border-neutral-100 p-5 rounded-2xl hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-neutral-50 flex items-center justify-center rounded-xl">
                <stat.icon className="h-4 w-4 text-neutral-600" />
              </div>
              <span className={`text-[11px] font-semibold flex items-center gap-0.5 px-2 py-1 rounded-full ${stat.up ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
                {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-neutral-900 tracking-tight">{stat.value}</p>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5 uppercase tracking-wide">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-100 p-6 rounded-2xl">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Lawyers Registered</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Monthly registrations (last 12 months)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="lawyers" fill="#0d1017" name="Lawyers" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-neutral-100 p-6 rounded-2xl">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Clients Registered</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Monthly registrations (last 12 months)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="clients" stroke="#ffb84f" fill="#ffb84f" fillOpacity={0.1} name="Clients" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-neutral-100 p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#ffb84f]" /> Pending Verifications
          </h3>
          {data.pendingLawyers.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4 text-center">No pending verifications</p>
          ) : (
            <div className="space-y-2">
              {data.pendingLawyers.slice(0, 3).map((lawyer: any) => (
                <div key={lawyer.id} className="flex items-center justify-between border border-neutral-100 p-3 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{lawyer.fullName}</p>
                    <p className="text-[11px] text-neutral-500">{lawyer.baslNumber}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">PENDING</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-neutral-100 p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-[#ffb84f]" /> Pending Reviews
          </h3>
          {data.pendingReviews.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4 text-center">No pending reviews</p>
          ) : (
            <div className="space-y-2">
              {data.pendingReviews.slice(0, 3).map((review: any) => (
                <div key={review.id} className="flex items-center justify-between border border-neutral-100 p-3 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{review.reviewerName}</p>
                    <p className="text-[11px] text-neutral-500">For: {review.lawyer.fullName}</p>
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

        <div className="bg-[#0d1017] text-white p-6 rounded-2xl">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#ffb84f]" /> System Overview
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Lawyers Registered', value: data.stats.totalLawyers },
              { label: 'Active Clients', value: data.stats.totalClients },
              { label: 'Total Inquiries', value: data.stats.totalInquiries },
              { label: 'Articles Published', value: data.stats.totalArticles },
            ].map((item, i, arr) => (
              <div key={item.label} className={`flex items-center justify-between py-2 ${i < arr.length - 1 ? 'border-b border-white/10' : ''}`}>
                <span className="text-xs text-neutral-400 uppercase tracking-wide">{item.label}</span>
                <span className="text-lg font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
