'use client';

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitPaymentSchema, type SubmitPayment } from '@/schemas/subscription.schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FieldError } from '@/components/ui/FieldError';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OfflinePaymentClientProps {
  locale: string;
  invoice: any;
}

export default function OfflinePaymentClient({ locale, invoice }: OfflinePaymentClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SubmitPayment>({
    resolver: zodResolver(SubmitPaymentSchema),
    defaultValues: {
      invoiceId: invoice.id,
      amount: invoice.amount,
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'invoices');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to upload image');
    }
  };

  const onSubmit = async (data: SubmitPayment) => {
    setIsSubmitting(true);
    try {
      let receiptImageUrl = data.receiptImageUrl;

      // Upload image if selected
      if (selectedFile) {
        setUploadProgress(30);
        receiptImageUrl = await uploadImage(selectedFile);
        setUploadProgress(70);
      }

      setUploadProgress(80);
      const response = await fetch('/api/invoices/submit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          receiptImageUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit payment',
          variant: 'destructive',
        });
        setUploadProgress(0);
        return;
      }

      setUploadProgress(100);
      toast({
        title: 'Success',
        description: 'Payment details submitted successfully. Awaiting admin approval.',
      });

      reset();
      setSelectedFile(null);
      setUploadProgress(0);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/${locale}/dashboard/lawyer/payments/invoices`);
      }, 2000);
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred while submitting payment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 text-neutral-600 hover:text-black"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-black uppercase tracking-tight">
            Offline Payment Submission
          </h1>
          <p className="text-neutral-600 mt-2">
            Invoice #{invoice.id.substring(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Invoice Summary */}
        <Card className="mb-8 border-l-4 border-l-[#ffb84f] rounded-3xl shadow-sm border border-neutral-200/50">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{invoice.plan?.name || invoice.paymentReason || 'Invoice Payment'}</CardTitle>
                <CardDescription>
                  {invoice.plan ? 'Payment Submission for Plan Subscription' : 'Payment Submission for Invoice'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200 rounded-full">
                {invoice.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-neutral-600 font-medium">Amount Due</p>
                <p className="text-2xl font-bold text-black">LKR {invoice.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 font-medium">Invoice Date</p>
                <p className="text-lg font-semibold text-black">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 font-medium">Due Date</p>
                <p className="text-lg font-semibold text-black">
                  {new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card className="rounded-3xl border border-neutral-200/50 shadow-lg">
          <CardHeader>
            <CardTitle>Submit Bank Transfer Details</CardTitle>
            <CardDescription>
              Fill in your bank transfer details and upload the receipt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Bank Details Section */}
              <div className="space-y-4 pb-6 border-b border-neutral-200">
                <h3 className="font-semibold text-black text-sm uppercase tracking-wide">Bank Information</h3>

                <div>
                  <Label htmlFor="bankName">Bank Name *</Label>
                  <Input
                    id="bankName"
                    {...register('bankName')}
                    placeholder="e.g., Commercial Bank of Ceylon"
                    disabled={isSubmitting}
                    className="mt-1.5 rounded-3xl"
                  />
                  {errors.bankName && <FieldError message={errors.bankName.message} />}
                </div>

                <div>
                  <Label htmlFor="accountHolder">Account Holder Name *</Label>
                  <Input
                    id="accountHolder"
                    {...register('accountHolder')}
                    placeholder="Full name on bank account"
                    disabled={isSubmitting}
                    className="mt-1.5 rounded-3xl"
                  />
                  {errors.accountHolder && <FieldError message={errors.accountHolder.message} />}
                </div>

                <div>
                  <Label htmlFor="accountNumber">Account Number *</Label>
                  <Input
                    id="accountNumber"
                    {...register('accountNumber')}
                    placeholder="e.g., 1234567890"
                    disabled={isSubmitting}
                    className="mt-1.5 rounded-3xl"
                  />
                  {errors.accountNumber && <FieldError message={errors.accountNumber.message} />}
                </div>
              </div>

              {/* Transaction Details Section */}
              <div className="space-y-4 pb-6 border-b border-neutral-200">
                <h3 className="font-semibold text-black text-sm uppercase tracking-wide">Transaction Details</h3>

                <div>
                  <Label htmlFor="transactionDate">Transaction Date *</Label>
                  <Input
                    id="transactionDate"
                    type="datetime-local"
                    {...register('transactionDate')}
                    disabled={isSubmitting}
                    className="mt-1.5 rounded-3xl"
                  />
                  {errors.transactionDate && <FieldError message={errors.transactionDate.message} />}
                </div>

                <div>
                  <Label htmlFor="transactionId">Transaction Reference ID *</Label>
                  <Input
                    id="transactionId"
                    {...register('transactionId')}
                    placeholder="e.g., TXN-2024-123456"
                    disabled={isSubmitting}
                    className="mt-1.5 rounded-3xl"
                  />
                  {errors.transactionId && <FieldError message={errors.transactionId.message} />}
                </div>

                <div>
                  <Label htmlFor="amount">Amount Transferred (LKR) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    {...register('amount', { valueAsNumber: true })}
                    placeholder={invoice.amount.toString()}
                    disabled={isSubmitting}
                    className="mt-1.5 rounded-3xl"
                  />
                  {errors.amount && <FieldError message={errors.amount.message} />}
                </div>
              </div>

              {/* Receipt Upload Section */}
              <div className="space-y-4 pb-6 border-b border-neutral-200">
                <h3 className="font-semibold text-black text-sm uppercase tracking-wide">Receipt Upload</h3>

                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-300 rounded-3xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      disabled={isSubmitting}
                      className="hidden"
                    />

                    <Upload className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-black mb-1">
                      {selectedFile ? selectedFile.name : 'Click to upload receipt image'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      PNG, JPG, GIF up to 5MB
                    </p>

                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="mt-3 w-full bg-neutral-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {selectedFile && (
                    <p className="text-xs text-green-600 mt-2">
                      ✓ {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB) selected
                    </p>
                  )}
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  placeholder="Any additional information for the admin..."
                  rows={4}
                  disabled={isSubmitting}
                  className="mt-1.5 rounded-3xl resize-none"
                />
                {errors.notes && <FieldError message={errors.notes.message} />}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                  className="flex-1 rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-full bg-[#ffb84f] text-black hover:bg-[#e5a443] font-semibold"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Payment'}
                </Button>
              </div>

              <p className="text-xs text-neutral-500 text-center pt-4">
                Your payment will be reviewed by our admin team and you will be notified once it is approved.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
