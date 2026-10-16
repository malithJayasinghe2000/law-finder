import { LICENSING_ENABLED } from '@/lib/licensing';
import LicensingOff from '@/components/subscriptions/LicensingOff';

/** Plans, roles, permissions and usage are hidden while licensing is off (src/lib/licensing.ts). */
export default function AdminSubscriptionsLayout({ children }: { children: React.ReactNode }) {
  if (!LICENSING_ENABLED) return <LicensingOff admin />;
  return <>{children}</>;
}
