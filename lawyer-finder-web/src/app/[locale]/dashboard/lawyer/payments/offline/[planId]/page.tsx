import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import OfflinePaymentClient from "./OfflinePaymentClient";

export default async function OfflinePaymentPage({
  params,
}: {
  params: Promise<{ locale: string; planId: string }>;
}) {
  const { locale, planId } = await params;
  const session = await getSession();

  if (!session || session.role !== 'LAWYER') {
    redirect(`/${locale}/login`);
  }

  // Fetch invoice to verify it exists and belongs to current user
  const invoice = await prisma.invoice.findUnique({
    where: { id: planId },
    include: {
      lawyer: {
        include: {
          user: true
        }
      },
      plan: true,
      remarks: {
        orderBy: { createdAt: 'desc' }
      }
    },
  });

  if (!invoice) {
    redirect(`/${locale}/dashboard/lawyer/payments/invoices`);
  }

  // Verify invoice belongs to current user
  const lawyerProfile = await prisma.lawyerProfile.findUnique({
    where: { userId: session.userId },
  });

  if (!lawyerProfile || invoice.lawyerId !== lawyerProfile.id) {
    redirect(`/${locale}/dashboard/lawyer/payments/invoices`);
  }

  return (
    <OfflinePaymentClient
      locale={locale}
      invoice={invoice}
    />
  );
}
