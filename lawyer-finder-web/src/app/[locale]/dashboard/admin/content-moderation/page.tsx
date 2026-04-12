import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ContentModerationClient from './ContentModerationClient';

export default async function ContentModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect(`/${locale}/login`);

  const [pendingPosts, pendingReports] = await Promise.all([
    prisma.post.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        community: { select: { name: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.report.findMany({
      where: { status: 'PENDING' },
      include: {
        reporter: { select: { id: true, fullName: true } },
        post: { select: { id: true, title: true, slug: true } },
        comment: { select: { id: true, content: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content Moderation</h1>
        <p className="text-muted-foreground mt-1">Review pending posts and flagged content</p>
      </div>

      <ContentModerationClient
        pendingPosts={JSON.parse(JSON.stringify(pendingPosts))}
        pendingReports={JSON.parse(JSON.stringify(pendingReports))}
        locale={locale}
      />
    </div>
  );
}
