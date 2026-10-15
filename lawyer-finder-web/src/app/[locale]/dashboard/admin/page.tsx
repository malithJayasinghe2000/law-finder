import prisma from '@/lib/db';
import Link from 'next/link';
import {
  LayoutDashboard, Bell, ShieldCheck, Building2, Flag, FileText, Globe, Megaphone, Image, Shield,
} from 'lucide-react';
import { LISTED_FIRM_WHERE } from '@/lib/directory';
import { SignupCharts } from '@/components/admin/SignupCharts';

/**
 * The admin home: what is waiting for an admin, then a few true numbers.
 *
 * It used to show typed-in trends ("+12%", "+5%", "99% Platform health"),
 * counted every firm as a law firm when only registered, verified ones are
 * listed, and called every CLIENT account an "active client" — practice
 * managers included. Access is checked by the admin layout.
 */

// Plain classes: `buttonVariants` lives in a 'use client' module and cannot be
// called from this server component.
const ACTION_LINK =
  'inline-flex items-center justify-center shrink-0 h-8 px-3 rounded-none bg-[#0a0a0a] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors';

/** A data request no one has closed. Our part of an erasure closes at once. */
const OPEN_REQUEST_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'AWAITING_FIRM'] as const;

/** A client account is a CLIENT who is not working in a practice (a manager's account is CLIENT too). */
const CLIENT_ACCOUNT_WHERE = {
  role: 'CLIENT',
  status: { not: 'ERASED' },
  firmMemberships: { none: { status: 'ACTIVE' } },
} as const;

const MONTH_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit' });
const monthKey = (d: Date) => MONTH_KEY.format(d).slice(0, 7);

/** The last twelve months in Sri Lanka time, oldest first: [key, label]. */
function lastTwelveMonths(): [string, string][] {
  const [y, m] = monthKey(new Date()).split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 12 + i, 1));
    return [
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    ];
  });
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

type Todo = { key: string; icon: typeof Bell; title: string; detail: string; href?: string; action?: string };

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const admin = (p: string) => `/${locale}/dashboard/admin${p}`;
  const months = lastTwelveMonths();
  // Midnight on the 1st of the oldest month shown, Sri Lanka time.
  const since = new Date(`${months[0][0]}-01T00:00:00+05:30`);

  const [
    applications, firmsToCheck, reports, postsToReview, communityRequests, advertisers, campaigns,
    dataRequests, overdueRequests,
    accounts, clientAccounts, verifiedAttorneys, listedPractices,
    newAttorneys, newClients,
  ] = await Promise.all([
    prisma.lawyerApplication.count({ where: { status: 'SUBMITTED' } }),
    prisma.lawFirm.count({ where: { isActive: true, verificationStatus: 'PENDING' } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.post.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.communityRequest.count({ where: { status: 'PENDING' } }),
    prisma.advertiser.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.adCampaign.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.dataSubjectRequest.count({ where: { status: { in: [...OPEN_REQUEST_STATUSES] } } }),
    prisma.dataSubjectRequest.count({ where: { status: { in: [...OPEN_REQUEST_STATUSES] }, dueBy: { lt: new Date() } } }),
    prisma.user.count({ where: { status: { not: 'ERASED' } } }),
    prisma.user.count({ where: CLIENT_ACCOUNT_WHERE }),
    prisma.lawyerProfile.count({ where: { isVerified: true } }),
    prisma.lawFirm.count({ where: LISTED_FIRM_WHERE }),
    prisma.lawyerProfile.findMany({ where: { user: { createdAt: { gte: since } } }, select: { user: { select: { createdAt: true } } } }),
    prisma.user.findMany({ where: { ...CLIENT_ACCOUNT_WHERE, createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);

  const tally = (dates: Date[]) => {
    const counts = new Map<string, number>();
    for (const d of dates) counts.set(monthKey(d), (counts.get(monthKey(d)) ?? 0) + 1);
    return counts;
  };
  const attorneysByMonth = tally(newAttorneys.map((p) => p.user.createdAt));
  const clientsByMonth = tally(newClients.map((u) => u.createdAt));
  const monthlyData = months.map(([key, label]) => ({
    month: label,
    lawyers: attorneysByMonth.get(key) ?? 0,
    clients: clientsByMonth.get(key) ?? 0,
  }));

  // One line per queue, only when something is in it.
  const todos: Todo[] = [];
  if (firmsToCheck > 0) {
    todos.push({ key: 'firms', icon: Building2, title: `${plural(firmsToCheck, 'practice', 'practices')} to verify`, detail: 'Registered practices waiting to be listed.', href: admin('/firms'), action: 'Check' });
  }
  if (applications > 0) {
    todos.push({ key: 'apps', icon: ShieldCheck, title: `${plural(applications, 'attorney application', 'attorney applications')} to verify`, detail: 'Check each against the BASL roll.', href: admin('/verification'), action: 'Check' });
  }
  if (dataRequests > 0) {
    todos.push({
      key: 'dsr', icon: Shield,
      title: `${plural(dataRequests, 'data request', 'data requests')} open`,
      detail: `${overdueRequests > 0 ? `${overdueRequests} past the legal deadline. ` : ''}There is no admin page for data requests yet.`,
    });
  }
  if (reports > 0) {
    todos.push({ key: 'reports', icon: Flag, title: `${plural(reports, 'reported post', 'reported posts')}`, detail: 'Reported by users in the community.', href: admin('/content-moderation'), action: 'Review' });
  }
  if (postsToReview > 0) {
    todos.push({ key: 'posts', icon: FileText, title: `${plural(postsToReview, 'post', 'posts')} to review`, detail: 'Community posts waiting to be published.', href: admin('/content-moderation'), action: 'Review' });
  }
  if (communityRequests > 0) {
    todos.push({ key: 'communities', icon: Globe, title: `${plural(communityRequests, 'community request', 'community requests')}`, detail: 'Requests to start a new community.', href: admin('/communities'), action: 'Review' });
  }
  if (advertisers > 0) {
    todos.push({ key: 'advertisers', icon: Megaphone, title: `${plural(advertisers, 'advertiser', 'advertisers')} to check`, detail: 'Only non-legal organisations may advertise.', href: admin('/advertisers'), action: 'Check' });
  }
  if (campaigns > 0) {
    todos.push({ key: 'campaigns', icon: Image, title: `${plural(campaigns, 'ad campaign', 'ad campaigns')} to review`, detail: 'Waiting for approval before they run.', href: admin('/advertisements'), action: 'Review' });
  }

  const figures = [
    { label: 'Accounts', value: accounts, href: admin('/users') },
    { label: 'Client accounts', value: clientAccounts, href: admin('/users') },
    { label: 'Verified attorneys', value: verifiedAttorneys, href: admin('/users') },
    { label: 'Listed practices', value: listedPractices, href: admin('/firms') },
  ];

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0a0a0a] text-white">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 font-medium">What is waiting for an admin</p>
        </div>
      </div>

      {/* Needs your attention */}
      <section className="bg-white border border-neutral-200 p-5 sm:p-6" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4" /> Needs your attention
          {todos.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{todos.length}</span>
          )}
        </h2>

        {todos.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing right now. Practices, applications and reports to check will show here.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {todos.map((t) => (
              <li key={t.key} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <t.icon className="w-4 h-4 mt-0.5 shrink-0 text-[#8c6d3f]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{t.title}</p>
                    <p className="text-xs text-neutral-500">{t.detail}</p>
                  </div>
                </div>
                {t.href && <Link href={t.href} className={ACTION_LINK}>{t.action}</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Figures */}
      <section aria-label="Platform figures" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {figures.map((f) => (
          <Link key={f.label} href={f.href} className="bg-white border border-neutral-200 p-4 sm:p-5 hover:shadow-sm transition-shadow">
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">{f.value}</p>
            <p className="text-[11px] text-neutral-500 font-medium mt-0.5 uppercase tracking-wide">{f.label}</p>
          </Link>
        ))}
      </section>

      <SignupCharts data={monthlyData} />
    </div>
  );
}
