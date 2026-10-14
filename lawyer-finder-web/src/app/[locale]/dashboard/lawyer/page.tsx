import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, ArrowRight, Bell, CalendarDays, MessageCircle, UserPlus, ShieldCheck, FileText, Banknote, Inbox, Building2, PenLine, Globe, KeyRound, Shield,
} from 'lucide-react';
import type { BookingStatus } from '@prisma/client';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/schemas/consultation.schema';
import { getFirmMembership, resolveMatterAccess, discloseMatter, canManageFirm } from '@/lib/firms/access';
import { countUnreadConversations } from '@/lib/chat/unread';
import { isListedFirm, isPublicDirectoryEnabled } from '@/lib/directory';
import { LICENSING_ENABLED } from '@/lib/licensing';

/**
 * The firm-side home: what needs this person, and the practice's latest requests.
 *
 * Built from firm MEMBERSHIP, not the platform role. It used to load the
 * attorney's own LawyerProfile from an API that answered LAWYER only, so a
 * practice manager (account CLIENT) got a 401 and the page crashed. What each
 * person sees of a request is still decided per row by src/lib/firms/access.ts.
 */

// Plain classes: `buttonVariants` lives in a 'use client' module and cannot be
// called from this server component.
const ACTION_LINK =
  'inline-flex items-center justify-center shrink-0 h-8 px-3 rounded-none bg-[#0a0a0a] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors';

const FIRM_ROLE_LABELS: Record<string, string> = {
  FIRM_OWNER: 'Principal',
  FIRM_ADMIN: 'Practice manager',
  ATTORNEY: 'Attorney',
  PARALEGAL: 'Paralegal',
};

/** Requests the firm still has to move: triage, quote, or confirm payment. */
const FIRM_TODO_STATUSES: BookingStatus[] = ['REQUESTED', 'CONFLICT_CHECK', 'ACCEPTED'];

/**
 * Whether the practice is in the public directory, and if not, why. Only a
 * registered practice that our team has verified is listed (LISTED_FIRM_WHERE),
 * and before this nothing on the home page told an attorney they were not.
 */
function listingLine(
  firm: { slug: string; isActive: boolean; isRegisteredPractice: boolean; verificationStatus: string },
  directoryOn: boolean,
  locale: string
): { text: string; href: string; link: string } {
  const practiceHref = `/${locale}/dashboard/lawyer/firm`;
  if (isListedFirm(firm)) {
    return directoryOn
      ? { text: 'Listed in the public directory.', href: `/${locale}/firms/${firm.slug}`, link: 'View' }
      : { text: 'Ready to be listed. The public directory is switched off for everyone at the moment.', href: practiceHref, link: 'Practice' };
  }
  if (!firm.isRegisteredPractice) {
    return { text: 'Not listed: your practice is not registered yet.', href: practiceHref, link: 'Register' };
  }
  if (firm.verificationStatus === 'REJECTED') {
    return { text: 'Not listed: verification was not granted.', href: practiceHref, link: 'See why' };
  }
  return { text: 'Not listed yet: our team is checking your practice.', href: practiceHref, link: 'Practice' };
}

const formatDay = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });

/** The practice's software licence in one sentence. The licence belongs to the firm, not the attorney. */
function licenceLine(sub: { status: string; endDate: Date | null; plan: { name: string } } | null): string {
  if (!sub) return 'No licence yet.';
  const lapsed = sub.status === 'EXPIRED' || (sub.endDate !== null && sub.endDate < new Date());
  if (lapsed) return `${sub.plan.name}: expired${sub.endDate ? ` on ${formatDay(sub.endDate)}` : ''}.`;
  if (sub.status === 'CANCELED') return `${sub.plan.name}: cancelled${sub.endDate ? `, works until ${formatDay(sub.endDate)}` : ''}.`;
  if (sub.status === 'PAST_DUE') return `${sub.plan.name}: payment due.`;
  return `${sub.plan.name}: active${sub.endDate ? ` until ${formatDay(sub.endDate)}` : ''}.`;
}

type Todo = { id: string; icon: typeof Bell; title: string; detail: string; action: string };

export default async function LawyerDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const [user, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { fullName: true, profile: { select: { id: true, fullName: true } } },
    }),
    getFirmMembership(session.userId),
  ]);

  const name = user?.profile?.fullName || user?.fullName || '';
  const profileId = user?.profile?.id ?? session.profileId ?? null;
  const queueHref = `/${locale}/dashboard/lawyer/consultations`;

  if (!membership) {
    return (
      <div className="w-full space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Welcome{name ? `, ${name}` : ''}</h1>
        <section className="bg-white border border-neutral-200 p-5 sm:p-6 text-sm text-neutral-600">
          You are not part of a practice yet. Register your practice, or accept an invitation from a firm,
          to receive requests.
          <div className="mt-4">
            <Link href={`/${locale}/dashboard/lawyer/firm`} className={ACTION_LINK}>Go to Practice</Link>
          </div>
        </section>
      </div>
    );
  }

  // Firm-wide for the principal and practice manager (they assign) and for a
  // paralegal (no matters of their own); an attorney sees the requests they act on.
  const firmWide = membership.role === 'FIRM_OWNER' || membership.role === 'FIRM_ADMIN' || !profileId;
  const recentWhere = firmWide ? { firmId: membership.firmId } : { firmId: membership.firmId, lawyerId: profileId };

  const [open, recent, unread, publishedPosts, firm, directoryOn, subscription, dataRequests] = await Promise.all([
    prisma.booking.findMany({
      where: { firmId: membership.firmId, status: { in: FIRM_TODO_STATUSES } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, bookingNumber: true, status: true, firmId: true, lawyerId: true, clientId: true,
        conflictCheck: { select: { outcome: true } },
      },
    }),
    prisma.booking.findMany({
      where: recentWhere,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, bookingNumber: true, status: true, subject: true, firmId: true, lawyerId: true, clientId: true,
        lawyer: { select: { fullName: true } },
      },
    }),
    countUnreadConversations(session),
    // Community posts are the only thing anyone writes; the old `Article` table
    // has no editor and nothing writes to it.
    prisma.post.count({ where: { authorId: session.userId, status: 'PUBLISHED' } }),
    prisma.lawFirm.findUnique({
      where: { id: membership.firmId },
      select: { slug: true, isActive: true, isRegisteredPractice: true, verificationStatus: true },
    }),
    isPublicDirectoryEnabled(),
    LICENSING_ENABLED
      ? prisma.subscription.findFirst({
          where: { firmId: membership.firmId },
          orderBy: { createdAt: 'desc' },
          select: { status: true, endDate: true, plan: { select: { name: true } } },
        })
      : null,
    // Data-protection requests sent to this practice that it has not answered.
    // They carry a legal deadline, and nothing else told the practice they had
    // arrived. Only the principal and practice manager may answer them.
    canManageFirm(membership)
      ? prisma.dataSubjectRequest.findMany({
          where: {
            referredFirmIds: { has: membership.firmId },
            status: 'AWAITING_FIRM',
            firmResponses: { none: { firmId: membership.firmId } },
          },
          orderBy: { dueBy: 'asc' },
          select: { dueBy: true },
        })
      : [],
  ]);

  const listing = firm ? listingLine(firm, directoryOn, locale) : null;

  const accessTo = (b: { lawyerId: string | null; firmId: string; clientId: string }) =>
    resolveMatterAccess({
      actorUserId: session.userId,
      actorRole: session.role,
      actorProfileId: profileId,
      membership,
      matter: { lawyerId: b.lawyerId, firmId: b.firmId, clientId: b.clientId },
    });

  // Each request appears once, as the one thing this person can do next. The
  // server refuses the same actions to anyone else, so nothing here is shown to
  // someone who could not do it.
  const todos: Todo[] = [];
  for (const b of open) {
    const access = accessTo(b);
    const assigned = access.basis === 'ASSIGNED_ATTORNEY';
    if (!b.lawyerId && access.canAssign && b.status !== 'ACCEPTED') {
      todos.push({ id: b.id, icon: UserPlus, title: b.bookingNumber, detail: 'New request. Assign an attorney.', action: 'Assign' });
    } else if (assigned && b.status === 'REQUESTED') {
      const onHold = b.conflictCheck?.outcome === 'NEEDS_REVIEW';
      todos.push({
        id: b.id, icon: ShieldCheck, title: b.bookingNumber,
        detail: onHold ? 'On hold. Accept or decline when you are ready.' : 'Assigned to you. Review the request.',
        action: 'Review',
      });
    } else if (assigned && b.status === 'CONFLICT_CHECK') {
      todos.push({ id: b.id, icon: FileText, title: b.bookingNumber, detail: 'You accepted it. Send the client a fee proposal.', action: 'Quote' });
    } else if (assigned && b.status === 'ACCEPTED') {
      todos.push({ id: b.id, icon: Banknote, title: b.bookingNumber, detail: 'The client accepted your terms. Check their payment.', action: 'Open' });
    }
  }

  const attentionCount = todos.length + (unread > 0 ? 1 : 0) + (dataRequests.length > 0 ? 1 : 0);

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0a0a0a] text-white">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Welcome back{name ? `, ${name}` : ''}
          </h1>
          <p className="text-sm text-neutral-500 font-medium">
            {membership.firmName} · {FIRM_ROLE_LABELS[membership.role] ?? membership.role}
          </p>
        </div>
      </div>

      {/* Needs your attention */}
      <section className="bg-white border border-neutral-200 p-5 sm:p-6" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4" /> Needs your attention
          {attentionCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{attentionCount}</span>
          )}
        </h2>

        {attentionCount === 0 ? (
          <p className="text-sm text-neutral-500">Nothing right now. New requests and messages will show here.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {todos.map((t) => (
              <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <t.icon className="w-4 h-4 mt-0.5 shrink-0 text-[#8c6d3f]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-mono text-neutral-900">{t.title}</p>
                    <p className="text-xs text-neutral-500">{t.detail}</p>
                  </div>
                </div>
                <Link href={queueHref} className={ACTION_LINK}>{t.action}</Link>
              </li>
            ))}
            {dataRequests.length > 0 && (
              <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <Shield className="w-4 h-4 mt-0.5 shrink-0 text-[#8c6d3f]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">
                      {dataRequests.length === 1 ? '1 data request is' : `${dataRequests.length} data requests are`} waiting for your answer
                    </p>
                    <p className="text-xs text-neutral-500">
                      {dataRequests[0].dueBy < new Date() ? 'Overdue since ' : 'Due '}
                      {formatDay(dataRequests[0].dueBy)}
                    </p>
                  </div>
                </div>
                <Link href={`/${locale}/dashboard/lawyer/firm/requests`} className={ACTION_LINK}>Answer</Link>
              </li>
            )}
            {unread > 0 && (
              <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <MessageCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#8c6d3f]" />
                  <p className="text-sm font-semibold text-neutral-900">
                    {unread === 1 ? '1 conversation has' : `${unread} conversations have`} new messages
                  </p>
                </div>
                <Link href={`/${locale}/dashboard/lawyer/chat`} className={ACTION_LINK}>Read</Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Recent requests */}
      <section className="bg-white border border-neutral-200 p-5 sm:p-6" aria-labelledby="requests-heading">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 id="requests-heading" className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> {firmWide ? 'Latest requests' : 'Your latest requests'}
          </h2>
          {recent.length > 0 && (
            <Link href={queueHref} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 shrink-0">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-neutral-200 bg-neutral-50/50">
            <Inbox className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-900">No requests yet</p>
            <p className="text-xs text-neutral-500 mt-1">Requests clients send to your practice will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {recent.map((b) => {
              const access = accessTo(b);
              const subject = access.canReadMatterDetail ? discloseMatter(b, access).subject : null;
              return (
                <li key={b.id}>
                  <Link href={queueHref} className="block border border-neutral-100 p-4 hover:shadow-sm transition-shadow">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-neutral-400">{b.bookingNumber}</span>
                      <Badge className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${BOOKING_STATUS_COLORS[b.status] || 'bg-neutral-100 text-neutral-700'}`}>
                        {BOOKING_STATUS_LABELS[b.status] || b.status}
                      </Badge>
                    </div>
                    {subject && <p className="text-sm font-semibold text-neutral-900 truncate">{subject}</p>}
                    <p className="text-xs text-neutral-500 truncate">
                      {b.lawyer?.fullName ? `Attorney: ${b.lawyer.fullName}` : 'No attorney assigned yet'}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Your practice */}
      <section className="bg-white border border-neutral-200 p-5 sm:p-6" aria-labelledby="practice-heading">
        <h2 id="practice-heading" className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2 mb-2">
          <Building2 className="w-4 h-4" /> Your practice
        </h2>
        <ul className="divide-y divide-neutral-100">
          {listing && (
            <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <Globe className="w-4 h-4 mt-0.5 shrink-0 text-neutral-500" />
                <p className="text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-900">Directory:</span> {listing.text}
                </p>
              </div>
              <Link href={listing.href} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 shrink-0 pl-7 sm:pl-0">
                {listing.link} <ArrowRight className="w-3 h-3" />
              </Link>
            </li>
          )}
          {/* Hidden for launch — src/lib/licensing.ts. */}
          {LICENSING_ENABLED && (
            <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <KeyRound className="w-4 h-4 mt-0.5 shrink-0 text-neutral-500" />
                <p className="text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-900">Licence:</span> {licenceLine(subscription)}
                </p>
              </div>
              {/* Only the principal may buy or change the firm's licence. */}
              {membership.role === 'FIRM_OWNER' && (
                <Link href={`/${locale}/pricing`} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 shrink-0 pl-7 sm:pl-0">
                  Plans <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </li>
          )}
          <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <PenLine className="w-4 h-4 mt-0.5 shrink-0 text-neutral-500" />
              <p className="text-sm text-neutral-700">
                <span className="font-semibold text-neutral-900">My community posts:</span> {publishedPosts} published
              </p>
            </div>
            <Link href={`/${locale}/dashboard/blog/my-posts`} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 shrink-0 pl-7 sm:pl-0">
              View <ArrowRight className="w-3 h-3" />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
