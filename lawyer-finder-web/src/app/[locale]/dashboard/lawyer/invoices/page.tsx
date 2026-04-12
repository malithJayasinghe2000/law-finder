import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LawyerInvoicesTable } from "@/components/subscriptions/LawyerInvoicesTable";

export const metadata = {
  title: 'My Invoices',
  description: 'View and manage your subscription invoices',
};

export default async function LawyerInvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();

  if (!session || session.role !== 'LAWYER') {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Invoices</h1>
        <p className="text-gray-600 mt-2">View and manage your subscription invoices</p>
      </div>

      <LawyerInvoicesTable />
    </div>
  );
}
