'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Banknote, CheckCircle2, Clock, XCircle, ArrowUpRight, DollarSign, ArrowRightLeft, Building2, User } from 'lucide-react';
import { formatDateOnlyString } from '@/lib/utils';

export default function LawyerEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    totalPaid: 0,
    totalPending: 0,
    withdrawableBalance: 0,
  });
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'earnings' | 'withdrawals'>('earnings');
  
  // Withdrawal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/lawyer/withdraw');
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setWithdrawals(data.withdrawals || []);
        setBookings(data.bookings || []);
      } else {
        toast.error(data.error || 'Failed to load financial records');
      }
    } catch {
      toast.error('Failed to load financial records');
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdrawSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid positive amount.');
      return;
    }

    if (parsedAmount > stats.withdrawableBalance) {
      toast.error(`Insufficient balance. You can withdraw up to LKR ${stats.withdrawableBalance.toLocaleString()}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/lawyer/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount,
          bankName,
          accountNumber,
          accountHolder,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Withdrawal request submitted successfully!');
        setIsModalOpen(false);
        // Reset form
        setAmount('');
        setBankName('');
        setAccountNumber('');
        setAccountHolder('');
        loadData();
      } else {
        toast.error(data.error || 'Failed to submit withdrawal request');
      }
    } catch {
      toast.error('Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center bg-[#0a0a0a] text-white">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Earnings & Payouts</h1>
            <p className="text-sm text-neutral-500 font-medium">Track your consultation earnings and request bank withdrawals</p>
          </div>
        </div>

        {/* Withdrawal Dialog */}
        <Button onClick={() => setIsModalOpen(true)} className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none h-11 px-6 uppercase tracking-wider font-bold text-xs flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4" /> Request Payout
        </Button>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md rounded-none border border-neutral-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold uppercase tracking-wider">Request Withdrawal</DialogTitle>
              <DialogDescription>
                Submit your bank details to withdraw your earnings. Payouts are processed by admin within 24-48 hours.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4 py-2">
              <div className="space-y-2 bg-neutral-50 p-4 border border-neutral-100 mb-2">
                <div className="flex justify-between text-xs text-neutral-500 uppercase tracking-widest font-bold">
                  <span>Available Balance:</span>
                  <span className="text-[#0a0a0a]">LKR {stats.withdrawableBalance.toLocaleString()}.00</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Amount (LKR) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  required
                  className="rounded-none border-neutral-200 focus-visible:ring-0 focus-visible:border-[#0a0a0a]"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Bank Name *</Label>
                <Input
                  placeholder="e.g. Commercial Bank"
                  required
                  className="rounded-none border-neutral-200 focus-visible:ring-0 focus-visible:border-[#0a0a0a]"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Account Number *</Label>
                <Input
                  placeholder="e.g. 1234567890"
                  required
                  className="rounded-none border-neutral-200 focus-visible:ring-0 focus-visible:border-[#0a0a0a]"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Account Holder Name *</Label>
                <Input
                  placeholder="e.g. Mr. John Doe"
                  required
                  className="rounded-none border-neutral-200 focus-visible:ring-0 focus-visible:border-[#0a0a0a]"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none uppercase tracking-wider font-bold text-xs"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#0a0a0a] text-white hover:bg-neutral-800 rounded-none uppercase tracking-wider font-bold text-xs"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-none border-neutral-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Available for Payout</p>
            <p className="text-3xl font-bold text-green-600">LKR {stats.withdrawableBalance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200 shadow-sm bg-neutral-50">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Total Earnings</p>
            <p className="text-3xl font-bold text-neutral-900">LKR {stats.totalEarnings.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Paid Out</p>
            <p className="text-3xl font-bold text-blue-600">LKR {stats.totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-neutral-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Pending Verification</p>
            <p className="text-3xl font-bold text-amber-600">LKR {stats.totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 mt-6">
        <button
          onClick={() => setActiveTab('earnings')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 -mb-px flex items-center gap-2 ${activeTab === 'earnings' ? 'border-[#0a0a0a] text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
        >
          <DollarSign className="h-4 w-4" /> Earnings Ledger
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 -mb-px flex items-center gap-2 ${activeTab === 'withdrawals' ? 'border-[#0a0a0a] text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
        >
          <ArrowRightLeft className="h-4 w-4" /> Payout Requests
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-none" />)}</div>
      ) : activeTab === 'earnings' ? (
        bookings.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 bg-neutral-50/50">
            <Banknote className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-neutral-900">No earnings found</p>
            <p className="text-xs text-neutral-500 mt-1">Your completed sessions will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <Card key={booking.id} className="rounded-none border border-neutral-200 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-neutral-900">{booking.bookingNumber}</span>
                      <Badge className="bg-green-100 text-green-800 rounded-none text-[9px] uppercase tracking-wider px-2 py-0">Completed</Badge>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Date: {formatDateOnlyString(booking.date)} · Time: {booking.startTime} - {booking.endTime}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Client: {booking.client?.fullName || 'Client'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">+ LKR {booking.lawyerFee.toLocaleString()}</p>
                    <p className="text-xs text-neutral-400">Total Booking: LKR {booking.totalAmount.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : withdrawals.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-200 bg-neutral-50/50">
          <ArrowRightLeft className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-900">No payout requests found</p>
          <p className="text-xs text-neutral-500 mt-1">Click the "Request Payout" button to withdraw funds</p>
        </div>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((withdraw) => (
            <Card key={withdraw.id} className="rounded-none border border-neutral-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-900">LKR {withdraw.amount.toLocaleString()}.00</span>
                    {withdraw.status === 'PENDING' && (
                      <Badge className="bg-amber-100 text-amber-800 rounded-none text-[9px] uppercase tracking-wider flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
                    )}
                    {withdraw.status === 'APPROVED' && (
                      <Badge className="bg-green-100 text-green-800 rounded-none text-[9px] uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Approved / Paid</Badge>
                    )}
                    {withdraw.status === 'REJECTED' && (
                      <Badge className="bg-red-100 text-red-800 rounded-none text-[9px] uppercase tracking-wider flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>
                    )}
                  </div>
                  <span className="text-xs text-neutral-400">Submitted: {new Date(withdraw.createdAt).toLocaleDateString()}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-600">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-neutral-400" />
                    <span>Bank: <strong>{withdraw.bankName}</strong></span>
                  </div>
                  <div>
                    <span>Account No: <strong>{withdraw.accountNumber}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-neutral-400" />
                    <span>Holder: <strong>{withdraw.accountHolder}</strong></span>
                  </div>
                </div>

                {withdraw.adminNotes && (
                  <div className="mt-3 bg-neutral-50 p-2.5 border-l-2 border-neutral-300 text-xs text-neutral-700">
                    <strong className="text-[10px] uppercase font-bold text-neutral-500 block mb-0.5">Admin Notes</strong>
                    {withdraw.adminNotes}
                  </div>
                )}

                {withdraw.referenceImageUrl && (
                  <div className="mt-3">
                    <strong className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Receipt / Reference</strong>
                    <a href={withdraw.referenceImageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      View reference attachment / receipt
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
