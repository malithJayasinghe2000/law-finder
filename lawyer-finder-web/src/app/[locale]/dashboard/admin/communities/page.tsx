import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FileText, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import CommunityManagement from './CommunityManagement';

export default async function AdminCommunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect(`/${locale}/login`);

  const [communities, pendingRequests, pendingPosts, pendingReports] = await Promise.all([
    prisma.community.findMany({
      orderBy: { memberCount: 'desc' },
      include: { _count: { select: { posts: true, members: true } } },
    }),
    prisma.communityRequest.findMany({
      where: { status: 'PENDING' },
      include: { requester: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Community Management</h1>
        <p className="text-muted-foreground mt-1">Manage communities, review requests, and moderate content</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{communities.length}</div>
            <div className="text-xs text-muted-foreground">Communities</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <div className="text-xs text-muted-foreground">Pending Requests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <div className="text-2xl font-bold">{pendingPosts}</div>
            <div className="text-xs text-muted-foreground">Posts to Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <div className="text-2xl font-bold">{pendingReports}</div>
            <div className="text-xs text-muted-foreground">Flagged Content</div>
          </CardContent>
        </Card>
      </div>

      {/* Links to sub-pages */}
      {(pendingPosts > 0 || pendingReports > 0) && (
        <div className="flex gap-3">
          {pendingPosts > 0 && (
            <Link href={`/${locale}/dashboard/admin/content-moderation`}>
              <Badge className="gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer">
                <FileText className="h-3.5 w-3.5" /> {pendingPosts} posts need review →
              </Badge>
            </Link>
          )}
          {pendingReports > 0 && (
            <Link href={`/${locale}/dashboard/admin/content-moderation`}>
              <Badge className="gap-1 px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer">
                <AlertTriangle className="h-3.5 w-3.5" /> {pendingReports} reports pending →
              </Badge>
            </Link>
          )}
        </div>
      )}

      {/* Client component for interactive management */}
      <CommunityManagement
        communities={communities.map((c) => ({
          ...c,
          memberCount: c._count.members,
          postCount: c._count.posts,
        }))}
        pendingRequests={pendingRequests}
        locale={locale}
      />
    </div>
  );
}
