'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Eye } from 'lucide-react';

interface Invoice {
  id: string;
  lawyerName: string;
  lawyerEmail: string;
  planName: string;
  amount: number;
  status: string;
  paymentReason: string;
  paymentDetails: any;
  createdAt: string;
}

export function AdminInvoicesTable() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoices();
  }, [page, status]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      let url = `/api/admin/invoices?page=${page}&limit=10`;
      if (status) {
        url += `&status=${status}`;
      }

      const response = await fetch(url);
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
    <Card>
      <CardHeader>
        <CardTitle>Payment Invoices Management</CardTitle>
        <CardDescription>Manage lawyer subscription payment invoices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Select value={status} onValueChange={(val) => { setStatus(val || ''); setPage(1); }}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PAID">Approved</SelectItem>
              <SelectItem value="RESUBMIT">Resubmit</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Lawyer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">{invoice.id.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.lawyerName}</p>
                        <p className="text-sm text-gray-500">{invoice.lawyerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>{invoice.planName}</TableCell>
                    <TableCell>LKR {invoice.amount.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/${locale}/dashboard/admin/invoices/${invoice.id}`}>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Eye className="w-4 h-4" />
                          Review
                        </Button>
                      </Link>
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
            <span className="px-4 py-2">
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
  );
}
