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

export function LawyerInvoicesTable() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    fetchInvoices();
  }, [page]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/invoices/my-invoices?page=${page}&limit=10`);
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

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { variant: any; label: string } } = {
      PENDING: { variant: 'outline', label: 'Pending' },
      PAID: { variant: 'default', label: 'Approved' },
      RESUBMIT: { variant: 'secondary', label: 'Resubmit' },
      CANCELLED: { variant: 'destructive', label: 'Cancelled' },
      UNPAID: { variant: 'outline', label: 'Unpaid' },
    };

    const config = statusConfig[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading && page === 1) {
    return <div className="p-4">Loading invoices...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>My Invoices</CardTitle>
          <CardDescription>View and manage your subscription invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice ID</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.id.slice(0, 8)}...</TableCell>
                      <TableCell>{invoice.planName}</TableCell>
                      <TableCell>LKR {invoice.amount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {invoice.status === 'PENDING' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/offline/${invoice.id}`)}
                          >
                            Submit Payment
                          </Button>
                        ) : invoice.status === 'RESUBMIT' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-yellow-50 text-yellow-800 hover:bg-yellow-100 border-yellow-200"
                            onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/offline/${invoice.id}`)}
                          >
                            Resubmit
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => router.push(`/${locale}/dashboard/lawyer/payments/offline/${invoice.id}`)}
                          >
                            View Details
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="px-4 py-2 font-medium flex items-center">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
