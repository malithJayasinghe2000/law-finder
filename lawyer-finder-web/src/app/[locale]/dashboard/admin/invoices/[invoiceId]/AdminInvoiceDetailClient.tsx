'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Check, 
  X, 
  RotateCcw, 
  MessageSquare, 
  Eye, 
  Calendar,
  DollarSign,
  FileText,
  User,
  Hash,
  CreditCard,
} from 'lucide-react';

interface AdminInvoiceDetailClientProps {
  locale: string;
  invoice: any;
}

export default function AdminInvoiceDetailClient({ 
  locale, 
  invoice 
}: AdminInvoiceDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'cancel' | 'resubmit' | null>(null);
  const [adminRemark, setAdminRemark] = useState('');
  const [actionTaken, setActionTaken] = useState<string | null>(invoice.status !== 'PENDING' ? invoice.status : null);
  const [adminFill, setAdminFill] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    transactionId: '',
    transactionDate: '',
    amount: invoice.amount.toString(),
    notes: 'Filled by Admin Override',
  });

  const handleAction = async (actionType: 'PAID' | 'CANCELLED' | 'RESUBMIT') => {
    // Only require remark for rejection or resubmission
    if (actionType !== 'PAID' && !adminRemark.trim()) {
      toast({
        title: 'Error',
        description: 'Please add a remark before rejecting or requesting resubmission',
        variant: 'destructive',
      });
      return;
    }

    const isFillingDetails = Object.keys(invoice.paymentDetails || {}).length === 0;
    const hasAnyAdminFill = !!(adminFill.bankName.trim() || adminFill.accountHolder.trim() || adminFill.accountNumber.trim() || adminFill.transactionId.trim() || adminFill.transactionDate.trim());

    if (actionType === 'PAID' && isFillingDetails && hasAnyAdminFill) {
      if (!adminFill.bankName.trim() || !adminFill.accountHolder.trim() || !adminFill.accountNumber.trim() || !adminFill.transactionId.trim() || !adminFill.transactionDate.trim() || !adminFill.amount.trim()) {
        toast({
          title: 'Details Required',
          description: 'Please fill out all bank transfer details before approving this invoice.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const bodyPayload: any = {
        status: actionType,
        adminNotes: adminRemark || 'Payment approved by admin',
        remark: adminRemark || 'Payment approved by admin',
      };

      if (actionType === 'PAID' && isFillingDetails && hasAnyAdminFill) {
        bodyPayload.paymentDetails = {
          bankName: adminFill.bankName,
          accountHolder: adminFill.accountHolder,
          accountNumber: adminFill.accountNumber,
          transactionId: adminFill.transactionId,
          transactionDate: adminFill.transactionDate,
          amount: Number(adminFill.amount),
          notes: adminFill.notes,
          submittedAt: new Date().toISOString(),
        };
      }

      const response = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update invoice');
      }

      toast({
        title: 'Success',
        description: `Invoice ${actionType === 'PAID' ? 'approved' : actionType === 'CANCELLED' ? 'cancelled' : 'marked for resubmission'}`,
      });

      setActionTaken(actionType);
      setAdminRemark('');
      setAction(null);

      setTimeout(() => {
        router.push(`/${locale}/dashboard/admin/invoices`);
      }, 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'RESUBMIT':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-neutral-50 text-neutral-800 border-neutral-200';
    }
  };

  const lawyer = invoice.lawyer?.user;
  const plan = invoice.plan;
  const paymentDetails = invoice.paymentDetails || {};
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => router.push(`/${locale}/dashboard/admin/invoices`)} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Invoice Details</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4" />
              <span className="truncate max-w-[200px] sm:max-w-md">{invoice.id}</span>
            </div>
          </div>
        </div>
        
        <Badge className={`px-3 py-1 text-sm font-medium ${getStatusColor(invoice.status)}`} variant="outline">
          {invoice.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Lawyer & Plan Details */}
          <Card className="overflow-hidden border-none shadow-md bg-white">
            <CardHeader className="bg-neutral-50/50 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid sm:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Lawyer Name</h3>
                  <p className="font-medium">{lawyer?.name || 'Unknown User'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Email Address</h3>
                  <p className="font-medium">{lawyer?.email || 'N/A'}</p>
                </div>
                <div className="sm:col-span-2 pt-4 border-t">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Subscription Plan</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{plan?.name || 'Unknown Plan'}</Badge>
                        <span className="text-sm text-muted-foreground">({invoice.billingCycle})</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Amount Due</h3>
                      <p className="text-2xl font-bold text-primary">LKR {invoice.amount?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          {Object.keys(paymentDetails).length > 0 && (
            <Card className="overflow-hidden border-none shadow-md bg-white">
              <CardHeader className="bg-neutral-50/50 pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Bank Transfer Details
                </CardTitle>
                <CardDescription>Submitted by the lawyer</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid sm:grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Bank Name</h3>
                    <p className="font-medium">{paymentDetails.bankName || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Account Holder</h3>
                    <p className="font-medium">{paymentDetails.accountHolder || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Account Number</h3>
                    <p className="font-medium font-mono">{paymentDetails.accountNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Transaction ID</h3>
                    <p className="font-medium font-mono">{paymentDetails.transactionId || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Transfer Date</h3>
                    <div className="flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {paymentDetails.transactionDate ? new Date(paymentDetails.transactionDate).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Amount Transferred</h3>
                    <div className="flex items-center gap-2 font-medium">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {paymentDetails.amount ? `LKR ${Number(paymentDetails.amount).toFixed(2)}` : 'N/A'}
                    </div>
                  </div>
                  {paymentDetails.notes && (
                    <div className="col-span-2 pt-4 border-t">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Lawyer Notes</h3>
                      <div className="bg-neutral-50 p-3 rounded-md border text-sm">
                        {paymentDetails.notes}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(paymentDetails).length === 0 && (invoice.status !== 'PAID' && invoice.status !== 'CANCELLED') && (
            <Card className="overflow-hidden border-none shadow-md bg-white">
              <CardHeader className="bg-amber-50/50 pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                  Manual Bank Transfer Override (Fill details to approve)
                </CardTitle>
                <CardDescription>Lawyer did not submit offline details. You can enter details on their behalf.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminBankName" className="text-xs font-semibold">Bank Name *</Label>
                    <Input
                      id="adminBankName"
                      value={adminFill.bankName}
                      onChange={(e) => setAdminFill(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="e.g. BOC, Commercial Bank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminAccountHolder" className="text-xs font-semibold">Account Holder *</Label>
                    <Input
                      id="adminAccountHolder"
                      value={adminFill.accountHolder}
                      onChange={(e) => setAdminFill(prev => ({ ...prev, accountHolder: e.target.value }))}
                      placeholder="Name on transfer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminAccountNumber" className="text-xs font-semibold">Account Number *</Label>
                    <Input
                      id="adminAccountNumber"
                      value={adminFill.accountNumber}
                      onChange={(e) => setAdminFill(prev => ({ ...prev, accountNumber: e.target.value }))}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminTransactionId" className="text-xs font-semibold">Transaction ID / Reference *</Label>
                    <Input
                      id="adminTransactionId"
                      value={adminFill.transactionId}
                      onChange={(e) => setAdminFill(prev => ({ ...prev, transactionId: e.target.value }))}
                      placeholder="e.g. TX123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminTransactionDate" className="text-xs font-semibold">Transfer Date *</Label>
                    <Input
                      id="adminTransactionDate"
                      type="datetime-local"
                      value={adminFill.transactionDate}
                      onChange={(e) => setAdminFill(prev => ({ ...prev, transactionDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminAmount" className="text-xs font-semibold">Amount Paid (LKR) *</Label>
                    <Input
                      id="adminAmount"
                      type="number"
                      value={adminFill.amount}
                      onChange={(e) => setAdminFill(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder={invoice.amount.toString()}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminNotes" className="text-xs font-semibold">Notes</Label>
                  <Textarea
                    id="adminNotes"
                    value={adminFill.notes}
                    onChange={(e) => setAdminFill(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any notes regarding the manual override..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipt Image Viewer */}
          {invoice.receiptImageUrl && (
            <Card className="overflow-hidden border-none shadow-md bg-white">
              <CardHeader className="bg-neutral-50/50 pb-4 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Payment Receipt
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-neutral-100 rounded-lg overflow-hidden border shadow-sm">
                  <img 
                    src={invoice.receiptImageUrl} 
                    alt="Payment Receipt" 
                    className="object-contain w-full h-full"
                  />
                  <a 
                    href={invoice.receiptImageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute bottom-4 right-4 bg-black/70 hover:bg-black text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Full
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-md bg-white sticky top-24">
            <CardHeader className="bg-primary/5 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Admin Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {invoice.status === 'PAID' || invoice.status === 'CANCELLED' ? (
                <div className="text-center py-6 space-y-3">
                  <div className="inline-block p-3 rounded-full bg-neutral-100 mb-2">
                    {invoice.status === 'PAID' ? (
                      <Check className="h-6 w-6 text-green-600" />
                    ) : (
                      <X className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <h3 className="font-medium text-lg">
                    Invoice is {invoice.status}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This invoice has been processed and can no longer be modified.
                  </p>
                  
                  {invoice.remarks && invoice.remarks.length > 0 && (
                    <div className="mt-6 text-left pt-6 border-t">
                      <h4 className="text-sm font-medium mb-3">Final Admin Remarks:</h4>
                      <div className="bg-neutral-50 p-4 rounded-lg border text-sm space-y-4">
                        {invoice.remarks.slice(0, 1).map((remark: any, i: number) => (
                          <div key={i}>
                            <p className="text-neutral-700">{remark.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(remark.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="adminRemark" className="font-medium">
                      Review Notes / Remarks <span className="text-red-500">*</span>
                    </Label>
                    <Textarea 
                      id="adminRemark"
                      placeholder="Enter notes before approving, rejecting or requesting resubmission..."
                      value={adminRemark}
                      onChange={(e) => setAdminRemark(e.target.value)}
                      className="min-h-[120px] resize-none focus-visible:ring-primary/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for all actions. These will be visible to the lawyer.
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    {!action ? (
                      <div className="grid grid-cols-1 gap-3">
                        <Button 
                          onClick={() => setAction('approve')}
                          className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm"
                          disabled={isLoading}
                        >
                          <Check className="mr-2 h-4 w-4" /> Approve Payment
                        </Button>
                        <Button 
                          onClick={() => setAction('resubmit')}
                          variant="outline"
                          className="w-full border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 shadow-sm"
                          disabled={isLoading}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" /> Request Resubmission
                        </Button>
                        <Button 
                          onClick={() => setAction('cancel')}
                          variant="outline"
                          className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 shadow-sm"
                          disabled={isLoading}
                        >
                          <X className="mr-2 h-4 w-4" /> Cancel / Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 space-y-4 animate-in slide-in-from-top-2">
                        <div className="text-sm font-medium text-center">
                          Confirm {action === 'approve' ? 'Approval' : action === 'cancel' ? 'Cancellation' : 'Resubmission Request'}?
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => setAction(null)}
                            disabled={isLoading}
                          >
                            Go Back
                          </Button>
                          <Button 
                            className={`flex-1 ${
                              action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 
                              action === 'resubmit' ? 'bg-orange-600 hover:bg-orange-700' : 
                              'bg-red-600 hover:bg-red-700'
                            } text-white`}
                            onClick={() => handleAction(
                              action === 'approve' ? 'PAID' : 
                              action === 'resubmit' ? 'RESUBMIT' : 'CANCELLED'
                            )}
                            disabled={isLoading}
                          >
                            {isLoading ? 'Processing...' : 'Confirm'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Previous Remarks History */}
          {invoice.remarks && invoice.remarks.length > (invoice.status === 'PAID' || invoice.status === 'CANCELLED' ? 1 : 0) && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <RotateCcw className="h-4 w-4" />
                  Remark History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-300 before:to-transparent">
                  {invoice.remarks.slice(invoice.status === 'PAID' || invoice.status === 'CANCELLED' ? 1 : 0).map((remark: any, i: number) => (
                    <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-4 h-4 rounded-full border border-white bg-neutral-300 text-neutral-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-white p-3 rounded border shadow-sm">
                        <p className="text-sm text-neutral-700">{remark.content}</p>
                        <time className="block mt-2 text-xs text-muted-foreground">
                          {new Date(remark.createdAt).toLocaleString()}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

