import { LICENSING_ENABLED } from '@/lib/licensing';
import LicensingOff from '@/components/subscriptions/LicensingOff';

/** Licence invoices and payments are hidden while licensing is off (src/lib/licensing.ts). */
export default function LicenceBillingLayout({ children }: { children: React.ReactNode }) {
  if (!LICENSING_ENABLED) return <LicensingOff />;
  return <>{children}</>;
}
