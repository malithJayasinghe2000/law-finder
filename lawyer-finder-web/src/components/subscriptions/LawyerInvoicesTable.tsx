'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Invoice {
  id: string;
  planId: string;
  planName: string;
  amount: number;
  status: string;
  paymentReason: string;
  createdAt: string;
  updatedAt: string;
}

export function LawyerInvoicesTable({ defaultTab = 'all' }: { defaultTab?: 'all' | 'actionable' | 'history' }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    fetchInvoices();
  }, [page, activeTab]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/invoices/my-invoices?page=${page}&limit=10&filter=${activeTab}`);
      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: 'Failed to fetch invoices',
          variant: 'destructive',
        });
        return;
      }

      setInvoices(data.invoices);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while fetching invoices',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPage(1); // reset pagination
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { variant: any; label: string } } = {
      PENDING: { variant: 'outline', label: 'Pending' },
      PAID: { variant: 'default', label: 'Paid' },
      RESUBMIT: { variant: 'secondary', label: 'Resubmit' },
      CANCELLED: { variant: 'destructive', label: 'Cancelled' },
      UNPAID: { variant: 'outline', label: 'Unpaid' },
    };

    const config = statusConfig[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant} className="rounded-none">{config.label}</Badge>;
  };

  const renderTableBody = () => {
    if (isLoading && page === 1) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
            Loading invoices...
          </TableCell>
        </TableRow>
      );
    }

    if (invoices.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
            No invoices found for this category
          </TableCell>
        </TableRow>
      );
    }

    return invoices.map((invoice) => (
      <TableRow key={invoice.id}>
        <TableCell className="font-mono text-sm">{invoice.id.slice(0, 8)}...</TableCell>
        <TableCell className="font-medium">
          {invoice.planName !== 'N/A' ? invoice.planName : invoice.paymentReason}
        </TableCell>
        <TableCell>LKR {invoice.amount.toLocaleString()}</TableCell>
        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
        <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
        <TableCell>
          {invoice.status === 'PENDING' ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-none hover:bg-neutral-100"
              onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/offline/${invoice.id}`)}
            >
              Submit Payment
            </Button>
          ) : invoice.status === 'RESUBMIT' ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-none bg-yellow-50 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
              onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/offline/${invoice.id}`)}
            >
              Resubmit
            </Button>
          ) : invoice.status === 'UNPAID' ? (
             <Button
              size="sm"
              className="rounded-none bg-[#0a0a0a] text-white hover:bg-neutral-800"
              onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/offline/${invoice.id}`)}
            >
              Pay Now
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              className="rounded-none"
              onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/offline/${invoice.id}`)}
            >
              View Receipt
            </Button>
          )}
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <Card className="rounded-none shadow-sm">
      <CardHeader className="pb-3 border-b border-neutral-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>View and manage your subscription invoices</CardDescription>
          </div>
          <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-3 rounded-none h-10 bg-neutral-100">
              <TabsTrigger value="all" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
                All
              </TabsTrigger>
              <TabsTrigger value="actionable" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
                Action Required
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
                History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-neutral-50/50">
              <TableRow>
                <TableHead className="w-[120px]">Invoice ID</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableBody()}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t border-neutral-100">
            <span className="text-sm text-neutral-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
