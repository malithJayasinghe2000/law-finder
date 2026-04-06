import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import OfflinePaymentClient from "./OfflinePaymentClient";

export default async function OfflinePaymentPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ locale: string, planId: string }>;
  searchParams: Promise<{ cycle?: string, amount?: string, invoice?: string }>;
}) {
  const { locale, planId } = await params;
  const { cycle = 'monthly', amount = '0', invoice = '000000' } = await searchParams;
  const session = await getSession();

  if (!session || session.role !== 'LAWYER') {
    redirect(`/${locale}/login`);
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId }
  });

  if (!plan) {
    notFound();
  }

  return (
    <OfflinePaymentClient 
      locale={locale} 
      plan={plan} 
      amount={amount} 
      invoice={invoice} 
      cycle={cycle} 
    />
  );
}
