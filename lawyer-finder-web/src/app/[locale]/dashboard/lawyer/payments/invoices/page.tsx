import { LawyerInvoicesTable } from '@/components/subscriptions/LawyerInvoicesTable';

export const metadata = {
  title: 'My Invoices',
  description: 'View and manage your subscription invoices',
};

export default function LawyerInvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Invoices</h1>
        <p className="text-gray-600 mt-2">View and manage your subscription payment invoices</p>
      </div>

      <LawyerInvoicesTable />
    </div>
  );
}
