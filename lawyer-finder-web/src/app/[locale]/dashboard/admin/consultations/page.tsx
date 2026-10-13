'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CalendarDays, ShieldCheck, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/schemas/consultation.schema';
import { formatDateOnlyString } from '@/lib/utils';
import Link from 'next/link';
import { ADMIN_CREATE_BOOKING_ENABLED } from '@/lib/consultations/adminBooking';

import { useParams } from 'next/navigation';

export default function AdminConsultationsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadBookings(); }, [page, statusFilter]);

  async function loadBookings() {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '15' });
      if (statusFilter) p.set('status', statusFilter);
      const res = await fetch(`/api/consultations/bookings?${p}`);
      const data = await res.json();
      setBookings(data.bookings || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">All Consultations</h1>
            <p className="text-sm text-neutral-500 font-medium">Platform-wide booking overview</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Off: see src/lib/consultations/adminBooking.ts. */}
          {ADMIN_CREATE_BOOKING_ENABLED && (
            <Link href={`/${locale}/dashboard/admin/consultations/create-booking`}>
              <Button className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 px-6 text-xs font-bold uppercase tracking-wide">
                Create Booking
              </Button>
            </Link>
          )}
          <Link href={`/${locale}/dashboard/admin/consultations/payments`}>
            <Button className="bg-amber-500 text-white hover:bg-amber-600 rounded-none h-10 px-6 text-xs font-bold uppercase tracking-wide">
              Manage Payments
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-neutral-200 px-3 py-2 text-sm bg-white outline-none"
        >
          <option value="">All Statuses</option>
          {Object.keys(BOOKING_STATUS_LABELS).map(key => (
            <option key={key} value={key}>{BOOKING_STATUS_LABELS[key]}</option>
          ))}
        </select>
      </div>

      {/* Data Table */}
      <Card className="rounded-none shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-neutral-500 uppercase tracking-widest bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Booking ID</th>
                  <th className="px-6 py-4 font-bold">Date & Time</th>
                  <th className="px-6 py-4 font-bold">Lawyer</th>
                  <th className="px-6 py-4 font-bold">Client</th>
                  <th className="px-6 py-4 font-bold">Mode</th>
                  <th className="px-6 py-4 font-bold text-right">Amount</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i}>
                      <td colSpan={7} className="px-6 py-4"><Skeleton className="h-6 w-full" /></td>
                    </tr>
                  ))
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">No bookings found</td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{b.bookingNumber}</td>
                      <td className="px-6 py-4">
                        {/* A request to a practice has no appointment until the attorney
                            proposes one with the quote — date is null, not a string. */}
                        <p className="font-semibold text-neutral-900">{b.date ? formatDateOnlyString(b.date, 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No appointment yet'}</p>
                        <p className="text-xs text-neutral-500">{b.startTime}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-neutral-900">{b.lawyer?.fullName ?? 'Unassigned'}</p>
                        <p className="text-xs text-neutral-500 truncate max-w-[150px]">{b.lawyer?.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-neutral-900">{b.client?.fullName || 'Client'}</p>
                        <p className="text-xs text-neutral-500">{b.client?.email}</p>
                      </td>
                      <td className="px-6 py-4"><Badge variant="outline" className="text-[10px]">{b.mode}</Badge></td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-neutral-900">Rs. {b.totalAmount.toLocaleString()}</p>
                        <p className="text-[10px] text-neutral-400">Paid to lawyer</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`text-[10px] uppercase tracking-wider rounded-sm ${BOOKING_STATUS_COLORS[b.status]}`}>
                          {BOOKING_STATUS_LABELS[b.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-none h-8"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-xs font-semibold text-neutral-600">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-none h-8"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
