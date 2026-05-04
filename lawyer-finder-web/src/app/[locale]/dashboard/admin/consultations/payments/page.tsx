'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { DollarSign, CheckCircle, XCircle, Search, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function AdminConsultationPaymentsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadPendingPayments(); }, []);

  async function loadPendingPayments() {
    setLoading(true);
    try {
      // Get bookings that are pending payment, ideally filtering by method BANK_TRANSFER
      const res = await fetch(`/api/consultations/bookings?status=PENDING_PAYMENT&limit=50`);
      const data = await res.json();
      
      // Filter for those with pending bank transfers
      const pendingBankTransfers = (data.bookings || []).filter((b: any) => 
        b.payment && b.payment.method === 'BANK_TRANSFER' && b.payment.status === 'PENDING'
      );
      
      setBookings(pendingBankTransfers);
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }

  async function handleVerify(bookingId: string, status: 'PAID' | 'CANCELLED') {
    setActionLoading(bookingId);
    try {
      const res = await fetch(`/api/consultations/bookings/${bookingId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          adminNotes: status === 'CANCELLED' ? 'Invalid receipt or transaction reference' : 'Verified manually',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Payment ${status === 'PAID' ? 'approved and booking confirmed' : 'rejected'}`);
        loadPendingPayments();
      } else {
        toast.error(data.error || 'Failed to update payment');
      }
    } catch { toast.error('Failed to update payment'); }
    finally { setActionLoading(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center bg-amber-500 text-white">
          <DollarSign className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Payment Verification</h1>
          <p className="text-sm text-neutral-500 font-medium">Verify pending bank transfers for consultations</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-none" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-200 bg-neutral-50/50">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-900">All caught up!</p>
          <p className="text-xs text-neutral-500 mt-1">No pending bank transfers to verify.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bookings.map(b => (
            <Card key={b.id} className="rounded-none shadow-sm">
              <CardContent className="p-0">
                <div className="p-5 border-b border-neutral-100 bg-neutral-50 flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="text-[10px] bg-white mb-2 font-mono">{b.bookingNumber}</Badge>
                    <h3 className="font-bold text-neutral-900 text-lg">Rs. {b.totalAmount.toLocaleString()}</h3>
                    <p className="text-xs text-neutral-500 mt-1">Lawyer: {b.lawyer?.fullName}</p>
                    <p className="text-xs text-neutral-500">Client: {b.client?.fullName}</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 rounded-none text-[10px]">Pending Verification</Badge>
                </div>
                <div className="p-5 space-y-4">
                  <div className="bg-blue-50 border border-blue-100 p-3 text-xs space-y-2 text-blue-900 font-mono">
                    <p><span className="font-semibold text-blue-700">Bank:</span> {b.payment.bankName}</p>
                    <p><span className="font-semibold text-blue-700">Account:</span> {b.payment.accountHolder}</p>
                    <p><span className="font-semibold text-blue-700">Ref:</span> {b.payment.transactionRef}</p>
                  </div>
                  {b.payment.receiptImageUrl && (
                    <a href={b.payment.receiptImageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 border border-blue-200 p-2 hover:bg-blue-50 transition-colors">
                      <ExternalLink className="w-3 h-3" /> View Uploaded Receipt
                    </a>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => handleVerify(b.id, 'CANCELLED')}
                      disabled={actionLoading === b.id}
                      className="rounded-none h-9 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                    <Button 
                      onClick={() => handleVerify(b.id, 'PAID')}
                      disabled={actionLoading === b.id}
                      className="bg-green-600 text-white hover:bg-green-700 rounded-none h-9 text-xs font-bold"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
