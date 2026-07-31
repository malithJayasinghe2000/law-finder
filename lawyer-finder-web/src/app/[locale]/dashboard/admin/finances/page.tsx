'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Banknote, TrendingUp, ShieldCheck, HeartHandshake, Landmark, ArrowDownWideNarrow, ListFilter } from 'lucide-react';

export default function AdminFinancesPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalSubscriptionIncome: 0,
    totalAdIncome: 0,
    platformTotalIncome: 0,
    totalConsultationFeesToLawyers: 0,
    consultationCount: 0,
  });
  const [lawyerBreakdowns, setLawyerBreakdowns] = useState<any[]>([]);

  useEffect(() => {
    loadFinances();
  }, []);

  async function loadFinances() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/finances');
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary);
        setLawyerBreakdowns(data.lawyerBreakdowns || []);
      } else {
        toast.error(data.error || 'Failed to load finances');
      }
    } catch {
      toast.error('Failed to load finances');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Financial Reports</h1>
          <p className="text-sm text-neutral-500 font-medium">Platform revenue from subscriptions and advertising. Consultation fees are paid client-to-lawyer and are not platform income.</p>
        </div>
      </div>

      {/* Platform revenue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-none border-neutral-200 shadow-sm bg-[#0a0a0a] text-white">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Total Platform Revenue</p>
            <p className="text-3xl font-bold">LKR {summary.platformTotalIncome.toLocaleString()}</p>
            <span className="text-[10px] text-neutral-400 block mt-1">Subscriptions + Advertising</span>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Subscription Income</p>
            <p className="text-3xl font-bold text-neutral-900">LKR {summary.totalSubscriptionIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Advertisement Income</p>
            <p className="text-3xl font-bold text-neutral-900">LKR {summary.totalAdIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Consultation activity — explicitly NOT platform revenue */}
      <Card className="rounded-none border-blue-200 bg-blue-50 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900 mb-1">
                Consultation Activity — not platform revenue
              </p>
              <p className="text-xs text-blue-800">
                Clients pay lawyers directly and the platform takes no share of any
                legal fee. These figures are shown for visibility only and are
                deliberately excluded from platform revenue above.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-900">
                LKR {summary.totalConsultationFeesToLawyers.toLocaleString()}
              </p>
              <p className="text-[10px] text-blue-700 mt-0.5">
                across {summary.consultationCount.toLocaleString()} consultations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lawyer Breakdown Table */}
      <Card className="rounded-none border-neutral-200 shadow-sm">
        <CardHeader className="border-b border-neutral-100 p-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold uppercase tracking-wider">Per-Lawyer Breakdown</CardTitle>
            <CardDescription className="text-xs">What each lawyer paid the platform, and their consultation activity</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-none w-full" />)}
            </div>
          ) : lawyerBreakdowns.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm">No lawyers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-neutral-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-4 pl-6 text-[#0a0a0a]">Lawyer</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right text-[#0a0a0a]">Subscriptions</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right text-[#0a0a0a]">Ads</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right text-[#0a0a0a]">Consultations</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6 text-[#0a0a0a]">Fees Collected Directly</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lawyerBreakdowns.map((lb) => (
                    <TableRow key={lb.lawyerId} className="hover:bg-neutral-50/50">
                      <TableCell className="py-4 pl-6 font-semibold">
                        <div className="font-bold text-neutral-900">{lb.fullName}</div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{lb.baslNumber}</div>
                      </TableCell>
                      <TableCell className="text-right">LKR {lb.subscriptionsPaid.toLocaleString()}</TableCell>
                      <TableCell className="text-right">LKR {lb.adsPaid.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{lb.consultationCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right pr-6 text-neutral-600">LKR {lb.consultationFeesCollected.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
