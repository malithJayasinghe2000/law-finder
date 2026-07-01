'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Banknote, CheckCircle, AlertTriangle, CalendarDays } from 'lucide-react';
import { formatDateOnlyString } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function LawyerEarningsPage() {
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEarnings(); }, []);

  async function loadEarnings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/consultations/bookings?limit=50`);
      const data = await res.json();
      
      // Filter bookings where lawyer actually earned money
      // 1. Completed bookings
      // 2. Client cancelled bookings where retainedLawyerFee > 0
      const validEarnings = (data.bookings || []).filter((b: any) => 
        b.status === 'COMPLETED' || 
        (b.status === 'CANCELLED_BY_CLIENT' && b.retainedLawyerFee && b.retainedLawyerFee > 0)
      );
      
      setEarnings(validEarnings);
    } catch { 
      toast.error('Failed to load earnings'); 
    } finally { 
      setLoading(false); 
    }
  }

  const totalEarnings = earnings.reduce((sum, b) => {
    if (b.status === 'COMPLETED') return sum + b.lawyerFee;
    if (b.status === 'CANCELLED_BY_CLIENT') return sum + (b.retainedLawyerFee || 0);
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
          <Banknote className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Earnings & Retained Fees</h1>
          <p className="text-sm text-neutral-500 font-medium">Overview of your consultation payouts and cancellation penalties</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-none bg-[#0a0a0a] text-white">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Total Earnings</p>
            <p className="text-3xl font-bold">LKR {totalEarnings.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-none" />)}</div>
      ) : earnings.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-200 bg-neutral-50/50">
          <Banknote className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-900">No earnings found</p>
          <p className="text-xs text-neutral-500 mt-1">Your completed sessions and retained cancellation fees will appear here</p>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">Earning Ledger</h2>
          {earnings.map((booking) => {
            const isCancellation = booking.status === 'CANCELLED_BY_CLIENT';
            const earnedAmount = isCancellation ? booking.retainedLawyerFee : booking.lawyerFee;
            
            return (
              <Card key={booking.id} className="rounded-none border border-neutral-200">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isCancellation ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                      {isCancellation ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-neutral-900">{booking.bookingNumber}</span>
                        {isCancellation ? (
                          <Badge className="bg-amber-100 text-amber-800 rounded-sm text-[10px] uppercase tracking-wider px-2 py-0">Late Cancellation Penalty</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 rounded-sm text-[10px] uppercase tracking-wider px-2 py-0">Completed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {formatDateOnlyString(booking.date)} at {booking.startTime}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">Client: {booking.client?.fullName || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">+ LKR {earnedAmount?.toLocaleString()}</p>
                    <p className="text-xs text-neutral-400">Total Booking: LKR {booking.totalAmount?.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
