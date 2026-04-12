import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { redirect } from 'next/navigation';
import AdminInvoiceDetailClient from './AdminInvoiceDetailClient';

export const metadata = {
  title: 'Invoice Review',
  description: 'Review and approve invoice payment',
};

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; invoiceId: string }>;
}) {
  const { locale, invoiceId } = await params;
  const session = await getSession();

  // Check if user is admin
  if (!session || session.role !== 'ADMIN') {
    redirect(`/${locale}/login`);
  }

  // Fetch invoice with all details
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lawyer: {
        include: {
          user: true,
          Subscription: {
            include: {
              plan: true,
            },
          },
        },
      },
      plan: true,
      remarks: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!invoice) {
    redirect(`/${locale}/dashboard/admin/invoices`);
  }

  return (
    <AdminInvoiceDetailClient
      locale={locale}
      invoice={invoice}
    />
  );
}
