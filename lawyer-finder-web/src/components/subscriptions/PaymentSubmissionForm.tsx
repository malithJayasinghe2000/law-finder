'use client';

import { useState } from 'react';
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

interface PaymentSubmissionFormProps {
  invoiceId: string;
  amount: number;
  planName: string;
  onSuccess?: () => void;
}

export function PaymentSubmissionForm({
  invoiceId,
  amount,
  planName,
  onSuccess,
}: PaymentSubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SubmitPayment>({
    resolver: zodResolver(SubmitPaymentSchema),
    defaultValues: {
      invoiceId,
      amount,
    },
  });

  const onSubmit = async (data: SubmitPayment) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/invoices/submit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit payment',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Payment details submitted successfully. Awaiting admin approval.',
      });

      reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while submitting payment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Payment Details</CardTitle>
        <CardDescription>
          Invoice for {planName} - Amount: LKR {amount.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="bankName">Bank Name *</Label>
            <Input
              id="bankName"
              {...register('bankName')}
              placeholder="e.g., Bank of Ceylon"
              disabled={isSubmitting}
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
            />
            {errors.accountHolder && <FieldError message={errors.accountHolder.message} />}
          </div>

          <div>
            <Label htmlFor="accountNumber">Account Number *</Label>
            <Input
              id="accountNumber"
              {...register('accountNumber')}
              placeholder="xxx-xxx-xxx"
              disabled={isSubmitting}
            />
            {errors.accountNumber && <FieldError message={errors.accountNumber.message} />}
          </div>

          <div>
            <Label htmlFor="transactionDate">Transaction Date *</Label>
            <Input
              id="transactionDate"
              type="datetime-local"
              {...register('transactionDate')}
              disabled={isSubmitting}
            />
            {errors.transactionDate && <FieldError message={errors.transactionDate.message} />}
          </div>

          <div>
            <Label htmlFor="transactionId">Transaction ID *</Label>
            <Input
              id="transactionId"
              {...register('transactionId')}
              placeholder="Reference/Transaction number"
              disabled={isSubmitting}
            />
            {errors.transactionId && <FieldError message={errors.transactionId.message} />}
          </div>

          <div>
            <Label htmlFor="amount">Amount (LKR) *</Label>
            <Input
              id="amount"
              type="number"
              {...register('amount', { valueAsNumber: true })}
              placeholder={amount.toString()}
              disabled={isSubmitting}
            />
            {errors.amount && <FieldError message={errors.amount.message} />}
          </div>

          <div>
            <Label htmlFor="receiptImageUrl">Receipt Image URL</Label>
            <Input
              id="receiptImageUrl"
              type="url"
              {...register('receiptImageUrl')}
              placeholder="https://example.com/receipt.jpg"
              disabled={isSubmitting}
            />
            {errors.receiptImageUrl && <FieldError message={errors.receiptImageUrl.message} />}
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Any additional information..."
              rows={3}
              disabled={isSubmitting}
            />
            {errors.notes && <FieldError message={errors.notes.message} />}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting...' : 'Submit Payment'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
