import { ADMIN_FINANCE_REPORTS_ENABLED, ADMIN_FINANCE_REPORTS_OFF_REASON } from '@/lib/admin/financeReports';

// Off: see src/lib/admin/financeReports.ts.
export default function AdminFinancesLayout({ children }: { children: React.ReactNode }) {
  if (ADMIN_FINANCE_REPORTS_ENABLED) return children;

  return (
    <div className="mx-auto max-w-xl border border-neutral-200 bg-white p-6">
      <h1 className="text-lg font-bold text-neutral-900">Financial reports are hidden</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{ADMIN_FINANCE_REPORTS_OFF_REASON}</p>
    </div>
  );
}
