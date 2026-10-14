'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Shield, Users, Inbox, Star,
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
    totalFirms: number;
    totalUsers: number;
    totalLawyers: number;
    totalClients: number;
  };
  monthlyData: { month: string; lawyers: number; clients: number }[];
  pendingLawyers: any[];
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
    { label: 'Law Firms', value: data.stats.totalFirms, icon: Inbox, trend: '', up: true },
    { label: 'Platform Health', value: '99%', icon: TrendingUp, trend: 'Stable', up: true },
  ];

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 font-medium">Platform overview and analytics</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white border border-neutral-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-neutral-100 flex items-center justify-center">
                  <stat.icon className="h-4 w-4 text-neutral-600" />
                </div>
              </div>
              <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${stat.up ? 'text-emerald-600' : 'text-amber-600'}`}>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lawyers Monthly Chart */}
        <div className="bg-white border border-neutral-200 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Lawyers Registered</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Monthly lawyer registrations (last 12 months)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: 'none',
                    borderRadius: '0',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                />
                <Bar dataKey="lawyers" fill="#0a0a0a" name="Lawyers" radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Clients Monthly Chart */}
        <div className="bg-white border border-neutral-200 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">Clients Registered</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Monthly client registrations (last 12 months)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: 'none',
                    borderRadius: '0',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                />
                <Area type="monotone" dataKey="clients" stroke="#0a0a0a" fill="#0a0a0a" fillOpacity={0.08} name="Clients" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Approvals Summary */}
        <div className="bg-white border border-neutral-200 p-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Pending Verifications
          </h3>
          {data.pendingLawyers.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4 text-center">No pending verifications</p>
          ) : (
            <div className="space-y-2">
              {data.pendingLawyers.slice(0, 3).map((lawyer: any) => (
                <div key={lawyer.id} className="flex items-center justify-between border border-neutral-100 p-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{lawyer.fullName}</p>
                    <p className="text-[11px] text-neutral-500">{lawyer.baslNumber}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1">PENDING</span>
                </div>
              ))}
              {data.pendingLawyers.length > 3 && (
                <p className="text-xs text-neutral-500 text-center pt-1">+{data.pendingLawyers.length - 3} more</p>
              )}
            </div>
          )}
        </div>

        {/* System Overview */}
        <div className="bg-[#0a0a0a] text-white p-6">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            System Overview
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-neutral-800">
              <span className="text-xs text-neutral-400 uppercase tracking-wide">Lawyers Registered</span>
              <span className="text-lg font-bold">{data.stats.totalLawyers}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-neutral-800">
              <span className="text-xs text-neutral-400 uppercase tracking-wide">Active Clients</span>
              <span className="text-lg font-bold">{data.stats.totalClients}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-neutral-400 uppercase tracking-wide">Law Firms</span>
              <span className="text-lg font-bold">{data.stats.totalFirms}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
