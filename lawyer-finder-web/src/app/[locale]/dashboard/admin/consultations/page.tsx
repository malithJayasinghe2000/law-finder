'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/schemas/consultation.schema';
import type { StaffRequestView } from '@/lib/consultations/staffView';
import Link from 'next/link';
import { ADMIN_CREATE_BOOKING_ENABLED } from '@/lib/consultations/adminBooking';

import { useParams } from 'next/navigation';

export default function AdminConsultationsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const [bookings, setBookings] = useState<StaffRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { loadBookings(); }, [page, statusFilter, search]);

  async function loadBookings() {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '15' });
      if (statusFilter) p.set('status', statusFilter);
      if (search) p.set('q', search);
      const res = await fetch(`/api/consultations/bookings?${p}`);
      const data = await res.json();
      setBookings(data.bookings || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  }

  const received = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });

  const statusBadge = (status: string) => (
    <Badge className={`text-[10px] uppercase tracking-wider rounded-sm ${BOOKING_STATUS_COLORS[status]}`}>
      {BOOKING_STATUS_LABELS[status] ?? status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0a0a0a] text-white">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">All Requests</h1>
            <p className="text-sm text-neutral-500 font-medium">
              Which practice has each request and where it stands. Who the client is, and what
              it is about, stays with the practice.
            </p>
          </div>
        </div>
        {/* Off: see src/lib/consultations/adminBooking.ts. */}
        {ADMIN_CREATE_BOOKING_ENABLED && (
          <Link href={`/${locale}/dashboard/admin/consultations/create-booking`}>
            <Button className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-10 px-6 text-xs font-bold uppercase tracking-wide">
              Create Booking
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(query.trim()); }}
          className="flex flex-1 sm:max-w-xs"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Request number, e.g. BK-2026-0003"
            aria-label="Find a request by its number"
            className="min-w-0 flex-1 border border-neutral-200 px-3 py-2 text-sm bg-white outline-none"
          />
          <Button type="submit" variant="outline" className="rounded-none h-auto border-l-0" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>
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

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-none" />)}
        </div>
      ) : bookings.length === 0 ? (
        <Card className="rounded-none shadow-sm">
          <CardContent className="px-6 py-12 text-center text-sm text-neutral-500">No requests found</CardContent>
        </Card>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="space-y-2 md:hidden">
            {bookings.map((b) => (
              <li key={b.id} className="border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-neutral-700">{b.bookingNumber}</span>
                  {statusBadge(b.status)}
                </div>
                <p className="mt-2 text-sm font-semibold text-neutral-900">{b.firmName ?? 'No practice'}</p>
                <p className="mt-0.5 text-xs text-neutral-500">Received {received(b.createdAt)}</p>
              </li>
            ))}
          </ul>

          {/* Larger screens: table */}
          <Card className="hidden rounded-none shadow-sm md:block">
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-neutral-500 uppercase tracking-widest bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-4 font-bold">Request</th>
                    <th className="px-6 py-4 font-bold">Practice</th>
                    <th className="px-6 py-4 font-bold">Received</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{b.bookingNumber}</td>
                      <td className="px-6 py-4 font-semibold text-neutral-900">{b.firmName ?? 'No practice'}</td>
                      <td className="px-6 py-4 text-neutral-600">{received(b.createdAt)}</td>
                      <td className="px-6 py-4">{statusBadge(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

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
