import { redirect } from 'next/navigation';

export default function InvoiceIndexPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dashboard/lawyer/payments/invoices`);
}
