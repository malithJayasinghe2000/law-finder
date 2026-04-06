import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import InvoiceClient from "./InvoiceClient";

export default async function InvoicePage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ locale: string, planId: string }>;
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { locale, planId } = await params;
  const { cycle = 'monthly' } = await searchParams;
  const session = await getSession();

  if (!session || session.role !== 'LAWYER') {
    redirect(`/${locale}/login`);
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    include: { subscriptionDetails: true }
  });

  if (!plan) {
    notFound();
  }

  const user = {
    userId: session.userId,
    fullName: session.fullName,
    email: await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } }).then(u => u?.email)
  };

  return (
    <InvoiceClient 
      locale={locale} 
      plan={plan} 
      user={user} 
      billingCycle={cycle} 
    />
  );
}
