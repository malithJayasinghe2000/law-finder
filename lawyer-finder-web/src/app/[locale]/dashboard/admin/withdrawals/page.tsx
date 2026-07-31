'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowUpRight, CheckCircle2, Clock, XCircle, Landmark, Upload, ImagePlus, Loader2, Eye, AlertTriangle } from 'lucide-react';

export default function AdminWithdrawalsPage() {
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [selectedWithdraw, setSelectedWithdraw] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'VIEW' | null>(null);
  
  // Form State
  const [adminNotes, setAdminNotes] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  async function loadWithdrawals() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/withdraw');
      const data = await res.json();
      if (res.ok) {
        setWithdrawals(data.withdrawals || []);
      } else {
        toast.error(data.error || 'Failed to load payout requests');
      }
    } catch {
      toast.error('Failed to load payout requests');
    } finally {
      setLoading(false);
    }
  }

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'payouts');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload receipt');
      }

      const data = await response.json();
      setReferenceImageUrl(data.url);
      toast.success('Payout receipt uploaded successfully.');
    } catch (uploadError: any) {
      toast.error(uploadError?.message || 'Receipt upload failed.');
    } finally {
      setUploading(false);
    }
  };

  async function handleStatusChange(status: 'APPROVED' | 'REJECTED') {
    if (!selectedWithdraw) return;

    if (status === 'APPROVED' && !referenceImageUrl) {
      toast.error('Please upload a transfer receipt image before approving.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/withdraw', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedWithdraw.id,
          status,
          adminNotes,
          referenceImageUrl,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Withdrawal request successfully ${status.toLowerCase()}!`);
        setSelectedWithdraw(null);
        setActionType(null);
        setAdminNotes('');
        setReferenceImageUrl('');
        loadWithdrawals();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setSubmitting(false);
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
          <h1 className="text-4xl font-normal tracking-tight text-neutral-900">Legacy Payouts</h1>
          <p className="text-sm text-neutral-500 font-medium">Historical withdrawal requests, retained for reconciliation</p>
        </div>
      </div>

      {/* Retired-model notice */}
      <div
        role="alert"
        className="flex items-start gap-3 border border-amber-200 bg-amber-50 p-4"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-amber-900">Withdrawals have been retired</p>
          <p className="text-amber-800">
            The platform no longer holds consultation fees — clients pay lawyers
            directly — so lawyers can no longer submit withdrawal requests and there
            is no platform balance to pay from. Anything listed below predates that
            change. <strong>Reconcile manually against funds actually collected
            before settling any request.</strong>
          </p>
        </div>
      </div>

      {/* Grid Table */}
      <Card className="rounded-none border-neutral-200 shadow-sm">
        <CardHeader className="border-b border-neutral-100 p-6">
          <CardTitle className="text-lg font-bold uppercase tracking-wider">Withdrawal Requests</CardTitle>
          <CardDescription className="text-xs">Process payouts, verify details, and attach payment confirmations</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-none w-full" />)}
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-sm">No withdrawals requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-neutral-50">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-4 pl-6 text-[#0a0a0a]">Lawyer</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a]">Bank Details</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a] text-right">Amount</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a] text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a]">Request Date</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-[#0a0a0a] text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id} className="hover:bg-neutral-50/50">
                      <TableCell className="py-4 pl-6">
                        <div className="font-bold text-neutral-900">{w.lawyer?.fullName || 'Lawyer'}</div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{w.lawyer?.baslNumber || 'No BASL'}</div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-xs font-medium text-neutral-800">{w.bankName}</div>
                        <div className="text-xs text-neutral-500">{w.accountNumber} · {w.accountHolder}</div>
                      </TableCell>
                      <TableCell className="py-4 text-right font-bold text-neutral-950">
                        LKR {w.amount.toLocaleString()}.00
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        {w.status === 'PENDING' && (
                          <Badge className="bg-amber-100 text-amber-800 rounded-none text-[9px] uppercase tracking-wider"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>
                        )}
                        {w.status === 'APPROVED' && (
                          <Badge className="bg-green-100 text-green-800 rounded-none text-[9px] uppercase tracking-wider"><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</Badge>
                        )}
                        {w.status === 'REJECTED' && (
                          <Badge className="bg-red-100 text-red-800 rounded-none text-[9px] uppercase tracking-wider"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-neutral-500 text-xs">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none h-8 px-2 text-xs"
                            onClick={() => {
                              setSelectedWithdraw(w);
                              setAdminNotes(w.adminNotes || '');
                              setReferenceImageUrl(w.referenceImageUrl || '');
                              setActionType('VIEW');
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {w.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white rounded-none h-8 text-xs font-bold"
                                onClick={() => {
                                  setSelectedWithdraw(w);
                                  setAdminNotes('');
                                  setReferenceImageUrl('');
                                  setActionType('APPROVE');
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="rounded-none h-8 text-xs font-bold"
                                onClick={() => {
                                  setSelectedWithdraw(w);
                                  setAdminNotes('');
                                  setReferenceImageUrl('');
                                  setActionType('REJECT');
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={selectedWithdraw !== null} onOpenChange={() => { setSelectedWithdraw(null); setActionType(null); }}>
        <DialogContent className="max-w-md rounded-none border border-neutral-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold uppercase tracking-wider">
              {actionType === 'APPROVE' && 'Approve & Pay Withdrawal'}
              {actionType === 'REJECT' && 'Reject Withdrawal Request'}
              {actionType === 'VIEW' && 'Payout Details'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'APPROVE' && `Confirm bank transfer payout of LKR ${selectedWithdraw?.amount?.toLocaleString()} to ${selectedWithdraw?.lawyer?.fullName}.`}
              {actionType === 'REJECT' && `Cancel withdrawal request of LKR ${selectedWithdraw?.amount?.toLocaleString()} for ${selectedWithdraw?.lawyer?.fullName}.`}
              {actionType === 'VIEW' && 'Overview of withdrawal details and confirmations.'}
            </DialogDescription>
          </DialogHeader>

          {selectedWithdraw && (
            <div className="space-y-4 py-2">
              {/* Account details */}
              <div className="bg-neutral-50 p-4 border border-neutral-100 space-y-2 text-xs text-neutral-700">
                <div>Bank: <strong>{selectedWithdraw.bankName}</strong></div>
                <div>Account No: <strong>{selectedWithdraw.accountNumber}</strong></div>
                <div>Account Holder: <strong>{selectedWithdraw.accountHolder}</strong></div>
                <div>Amount: <strong className="text-sm text-neutral-900">LKR {selectedWithdraw.amount.toLocaleString()}.00</strong></div>
              </div>

              {/* View/Input Receipt */}
              {(actionType === 'APPROVE' || (actionType === 'VIEW' && selectedWithdraw.status === 'APPROVED')) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Transfer Confirmation Receipt</Label>
                  
                  {referenceImageUrl || selectedWithdraw.referenceImageUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-neutral-200">
                      <img src={referenceImageUrl || selectedWithdraw.referenceImageUrl} alt="Reference receipt preview" className="w-full h-40 object-cover" />
                      {actionType === 'APPROVE' && (
                        <button
                          type="button"
                          onClick={() => setReferenceImageUrl('')}
                          className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 text-[10px] rounded-md hover:bg-black/80"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ) : actionType === 'APPROVE' ? (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        id="receipt-file"
                        className="hidden"
                        onChange={handleReceiptUpload}
                      />
                      <label
                        htmlFor="receipt-file"
                        className="flex items-center justify-center gap-2 w-full p-6 border-2 border-dashed border-neutral-200 rounded-lg text-sm text-muted-foreground hover:border-neutral-400 hover:text-foreground cursor-pointer transition-colors"
                      >
                        {uploading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <ImagePlus className="h-5 w-5" />
                        )}
                        {uploading ? 'Uploading reference receipt...' : 'Upload Bank Slip / Payout Receipt'}
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 italic">No receipt attached.</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {(actionType === 'APPROVE' || actionType === 'REJECT') ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Admin Notes / Remarks</Label>
                  <Textarea
                    placeholder="Enter any reference IDs, transfer remarks or rejection reasons..."
                    className="rounded-none border-neutral-200 text-xs focus-visible:ring-0 focus-visible:border-neutral-900 min-h-[80px]"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                </div>
              ) : selectedWithdraw.adminNotes ? (
                <div className="bg-neutral-50 p-3 border-l-2 border-neutral-300 text-xs">
                  <strong className="text-[10px] uppercase font-bold text-neutral-500 block mb-0.5">Admin Notes</strong>
                  {selectedWithdraw.adminNotes}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none uppercase tracking-wider font-bold text-xs"
              onClick={() => { setSelectedWithdraw(null); setActionType(null); }}
            >
              Close
            </Button>
            {actionType === 'APPROVE' && (
              <Button
                disabled={submitting || uploading}
                className="bg-green-600 hover:bg-green-700 text-white rounded-none uppercase tracking-wider font-bold text-xs"
                onClick={() => handleStatusChange('APPROVED')}
              >
                {submitting ? 'Approving...' : 'Confirm Payment'}
              </Button>
            )}
            {actionType === 'REJECT' && (
              <Button
                variant="destructive"
                disabled={submitting}
                className="rounded-none uppercase tracking-wider font-bold text-xs"
                onClick={() => handleStatusChange('REJECTED')}
              >
                {submitting ? 'Rejecting...' : 'Reject Request'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
