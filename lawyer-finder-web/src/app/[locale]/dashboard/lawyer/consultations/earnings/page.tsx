'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Banknote, CheckCircle2, Clock, Info, Building2, User } from 'lucide-react';
import { formatDateOnlyString } from '@/lib/utils';

interface IncomeStats {
  totalReceived: number;
  totalAwaiting: number;
  totalProposed: number;
  completedConsultations: number;
}

interface ConsultationRecord {
  id: string;
  bookingNumber: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: string;
  lawyerFee: number;
  paidAt: string | null;
  status: string;
  stage: 'PROPOSED' | 'AWAITING' | 'RECEIVED';
  client: { fullName: string | null };
  lawyer: { fullName: string } | null;
}

export default function LawyerIncomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IncomeStats>({
    totalReceived: 0,
    totalAwaiting: 0,
    totalProposed: 0,
    completedConsultations: 0,
  });
  const [scope, setScope] = useState<'PRACTICE' | 'ATTORNEY'>('ATTORNEY');
  const [refused, setRefused] = useState<string | null>(null);
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/lawyer/consultations/income');
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setScope(data.scope);
        setConsultations(data.consultations || []);
      } else if (res.status === 403) {
        setRefused(data.error || 'You cannot see fees.');
      } else {
        toast.error(data.error || 'Failed to load the fee record');
      }
    } catch {
      toast.error('Failed to load the fee record');
    } finally {
      setLoading(false);
    }
  }

  if (refused) {
    return (
      <div className="max-w-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">{refused}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-tight text-neutral-900 sm:text-4xl">
              Fees
            </h1>
            <p className="text-sm font-medium text-neutral-500">
              {scope === 'PRACTICE'
                ? 'Fees proposed to and paid by your practice’s clients'
                : 'Fees on the requests assigned to you'}
            </p>
          </div>
        </div>
      </div>

      {/* How payment works */}
      <div
        role="note"
        className="flex items-start gap-3 border border-blue-200 bg-blue-50 p-4"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-blue-900">Clients pay your practice directly</p>
          <p className="text-blue-800">
            The platform does not hold fees and takes no share of them. Your fee proposal
            carries your practice&apos;s bank details, and the client pays the practice into
            that account. This page is a record for your bookkeeping — there is no balance
            here to withdraw.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Received"
          value={loading ? null : `LKR ${stats.totalReceived.toLocaleString()}`}
          hint="Payment confirmed by the practice"
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />}
          valueClass="text-green-600"
        />
        <StatCard
          label="Awaiting payment"
          value={loading ? null : `LKR ${stats.totalAwaiting.toLocaleString()}`}
          hint="Client accepted, payment not confirmed"
          icon={<Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />}
          valueClass="text-amber-600"
        />
        <StatCard
          label="Proposed"
          value={loading ? null : `LKR ${stats.totalProposed.toLocaleString()}`}
          hint="Fee proposal sent, client has not answered"
          icon={<User className="h-4 w-4 text-neutral-500" aria-hidden="true" />}
        />
        <StatCard
          label="Completed"
          value={loading ? null : String(stats.completedConsultations)}
          hint="Consultation delivered"
          icon={<Building2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />}
        />
      </div>

      {/* Consultation list */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">
          Records
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-none" />
            ))}
          </div>
        ) : consultations.length === 0 ? (
          <Card className="rounded-none border border-neutral-200 shadow-sm">
            <CardContent className="p-10 text-center">
              <Banknote className="mx-auto mb-3 h-8 w-8 text-neutral-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-neutral-900">No fees yet</p>
              <p className="mt-1 text-xs text-neutral-500">
                A fee appears here once a fee proposal has been sent.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div>
            <div className="space-y-3">
              {consultations.map((c) => (
                <Card key={c.id} className="rounded-none border border-neutral-200 shadow-sm">
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-[180px]">
                      <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                        {c.bookingNumber}
                      </p>
                      <p className="font-semibold text-neutral-900">
                        {c.client?.fullName || 'Client'}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {c.date ? `${formatDateOnlyString(c.date)} · ${c.startTime}–${c.endTime}` : 'No appointment yet'}
                        {scope === 'PRACTICE' && ` · ${c.lawyer?.fullName ?? 'Unassigned'}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-neutral-900">
                        LKR {c.lawyerFee.toLocaleString()}
                      </p>
                      {c.stage === 'RECEIVED' ? (
                        <Badge className="mt-1 bg-green-100 text-green-800 hover:bg-green-100">
                          Received
                        </Badge>
                      ) : c.stage === 'AWAITING' ? (
                        <Badge className="mt-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Awaiting payment
                        </Badge>
                      ) : (
                        <Badge className="mt-1 bg-neutral-100 text-neutral-700 hover:bg-neutral-100">
                          Proposed
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  valueClass = 'text-neutral-900',
}: {
  label: string;
  value: string | null;
  hint: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <Card className="rounded-none border border-neutral-200 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            {label}
          </p>
          {icon}
        </div>
        {value === null ? (
          <Skeleton className="h-8 w-28 rounded-none" />
        ) : (
          <p className={`text-lg sm:text-2xl font-bold ${valueClass}`}>{value}</p>
        )}
        <p className="mt-1 text-[11px] text-neutral-500">{hint}</p>
      </CardContent>
    </Card>
  );
}
