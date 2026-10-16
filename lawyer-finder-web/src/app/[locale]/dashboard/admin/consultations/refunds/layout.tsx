import { ADMIN_REFUNDS_VIEW_ENABLED, ADMIN_REFUNDS_VIEW_OFF_REASON } from '@/lib/consultations/adminRefunds';

// Off: see src/lib/consultations/adminRefunds.ts.
export default function AdminRefundsLayout({ children }: { children: React.ReactNode }) {
  if (ADMIN_REFUNDS_VIEW_ENABLED) return children;

  return (
    <div className="mx-auto max-w-xl border border-neutral-200 bg-white p-6">
      <h1 className="text-lg font-bold text-neutral-900">Refunds are not shown to platform staff</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{ADMIN_REFUNDS_VIEW_OFF_REASON}</p>
    </div>
  );
}
