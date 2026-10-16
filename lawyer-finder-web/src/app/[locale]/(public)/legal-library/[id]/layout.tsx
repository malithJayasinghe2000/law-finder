import type { Metadata } from 'next';
import prisma from '@/lib/db';

// The tab title is the Act's own title; the page itself is a client component.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const doc = await prisma.legalDocument.findFirst({
    where: { id, status: 'ACTIVE' },
    select: { title: true },
  });
  return { title: doc?.title ?? 'Legal Library' };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
