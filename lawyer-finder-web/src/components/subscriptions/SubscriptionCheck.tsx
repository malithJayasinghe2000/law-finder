'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionCheckProps {
  planId: string;
  planName: string;
  amount: number;
  onInvoiceCreated: (invoiceId: string, amount: number) => void;
}

export function SubscriptionCheck({ planId, planName, amount, onInvoiceCreated }: SubscriptionCheckProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const { toast } = useToast();

  const checkActiveSubscription = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/invoices/check-active-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to check subscription',
          variant: 'destructive',
        });
        return;
      }

      if (data.hasActiveSubscription) {
        setHasActiveSubscription(true);
        toast({
          title: 'Active Subscription Found',
          description: `You already have an active ${planName} subscription.`,
          variant: 'default',
        });
      } else {
        setHasActiveSubscription(false);
        await createInvoice();
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while checking your subscription',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createInvoice = async () => {
    try {
      const response = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          billingCycle: 'MONTHLY',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create invoice',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Invoice created successfully. Please submit your payment details.',
      });

      onInvoiceCreated(data.invoice.id, data.invoice.amount);
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while creating invoice',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{planName} Plan</CardTitle>
        <CardDescription>Amount: LKR {amount.toLocaleString()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasActiveSubscription === null && (
          <Button onClick={checkActiveSubscription} disabled={isLoading} className="w-full">
            {isLoading ? 'Checking...' : 'Subscribe Now'}
          </Button>
        )}
        {hasActiveSubscription === true && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900 text-sm">You already have an active subscription for this plan</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
