import { LawyerInvoicesTable } from '@/components/subscriptions/LawyerInvoicesTable';

export const metadata = {
  title: 'Payment History',
  description: 'View your past payments and transactions',
};

export default function LawyerPaymentHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-normal tracking-tight">Payment History</h1>
        <p className="text-gray-600 mt-2 font-medium text-sm">View your past subscription payments and completed transactions.</p>
      </div>

      <LawyerInvoicesTable defaultTab="history" />
    </div>
  );
}
