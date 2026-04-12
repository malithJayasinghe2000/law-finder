import { AdminInvoicesTable } from '@/components/admin/AdminInvoicesTable';

export const metadata = {
  title: 'Payment Invoices',
  description: 'Manage lawyer subscription payment invoices',
};

export default function AdminInvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payment Invoices</h1>
        <p className="text-gray-600 mt-2">Manage all lawyer subscription payment invoices</p>
      </div>

      <AdminInvoicesTable />
    </div>
  );
}
