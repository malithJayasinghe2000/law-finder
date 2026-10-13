import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, ArrowRight, Bell, CalendarDays, MessageCircle, FileSignature, Search, Inbox,
} from 'lucide-react';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/schemas/consultation.schema';
import { AWAITING_CLIENT_STATUSES } from '@/lib/consultations/bookingStatus';
import { resolveMatterAccess, discloseMatter } from '@/lib/firms/access';
import { countUnreadConversations } from '@/lib/chat/unread';
import { isPublicDirectoryEnabled } from '@/lib/directory';
import { directoryPath } from '@/lib/directoryLinks';

/**
 * The client's home: what needs them, and where their requests stand.
 *
 * It used to be entirely about community posts — counters, recent posts and a
 * "create post" panel — and said nothing about the reason a client is here.
 * Community posts are still in the menu; whether they stay is a separate
 * decision (see PROGRESS.md, 2026-10-14).
 */

// Link styles. Plain classes: `buttonVariants` lives in a 'use client' module
// and cannot be called from this server component.
const ACTION_LINK =
  'inline-flex items-center justify-center shrink-0 h-8 px-3 rounded-none bg-[#0a0a0a] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors';
const PRIMARY_LINK =
  'inline-flex items-center justify-center w-full sm:w-auto rounded-none h-11 px-6 bg-[#0a0a0a] text-white hover:bg-neutral-800 text-xs font-bold uppercase tracking-widest transition-colors';

/** What the client is being asked to do, per status. */
const NEXT_STEP: Record<string, string> = {
  QUOTED: 'The practice sent its fee and terms. Accept or decline them.',
  ACCEPTED: 'You accepted the terms. Pay the practice as its terms say.',
  RESCHEDULE_REQUESTED: 'The practice proposed a new time. Accept it or ask for another.',
};

export default async function ClientDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, fullName: true },
  });

  const [needsClient, recent, invitations, unread, directoryOn] = await Promise.all([
    prisma.booking.findMany({
      where: { clientId: session.userId, status: { in: AWAITING_CLIENT_STATUSES } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, bookingNumber: true, status: true, firm: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { clientId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true, bookingNumber: true, status: true, subject: true, firmId: true, lawyerId: true, clientId: true,
        firm: { select: { name: true } },
      },
    }),
    // Requests a practice opened for this client and is waiting for them to
    // confirm. The token is the client's own link; they are signed in as its
    // addressee, so showing it to them is showing them their own invitation.
    user
      ? prisma.clientIntakeInvitation.findMany({
          where: { email: user.email.toLowerCase(), status: 'PENDING', expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, token: true, firm: { select: { name: true } } },
        })
      : [],
    countUnreadConversations(session),
    isPublicDirectoryEnabled(),
  ]);

  // The client reads their own matters; subjects are encrypted at rest.
  const ownSubject = (b: (typeof recent)[number]) =>
    discloseMatter(
      b,
      resolveMatterAccess({
        actorUserId: session.userId,
        actorRole: session.role,
        actorProfileId: session.profileId,
        membership: null,
        matter: { lawyerId: b.lawyerId, firmId: b.firmId, clientId: b.clientId },
      })
    ).subject;

  const attentionCount = needsClient.length + invitations.length + (unread > 0 ? 1 : 0);
  const consultationsHref = `/${locale}/dashboard/client/consultations`;

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0a0a0a] text-white">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 truncate">
            Welcome back{user?.fullName ? `, ${user.fullName}` : ''}
          </h1>
          <p className="text-sm text-neutral-500 font-medium">Your requests to practices, and what needs you</p>
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
          <p className="text-sm text-neutral-500">Nothing right now. We will show it here when a practice needs you.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {invitations.map((inv) => (
              <li key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <FileSignature className="w-4 h-4 mt-0.5 shrink-0 text-[#8c6d3f]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{inv.firm.name} opened a request for you</p>
                    <p className="text-xs text-neutral-500">Check it, then accept or decline.</p>
                  </div>
                </div>
                <Link
                  href={`/${locale}/client-request?token=${inv.token}`}
                  className={ACTION_LINK}
                >
                  View request
                </Link>
              </li>
            ))}
            {needsClient.map((b) => (
              <li key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <CalendarDays className="w-4 h-4 mt-0.5 shrink-0 text-[#8c6d3f]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{b.firm.name}</p>
                    <p className="text-xs text-neutral-500">
                      <span className="font-mono">{b.bookingNumber}</span> · {NEXT_STEP[b.status]}
                    </p>
                  </div>
                </div>
                <Link href={consultationsHref} className={ACTION_LINK}>
                  Open
                </Link>
              </li>
            ))}
            {unread > 0 && (
              <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <MessageCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#8c6d3f]" />
                  <p className="text-sm font-semibold text-neutral-900">
                    {unread === 1 ? '1 conversation has' : `${unread} conversations have`} new messages
                  </p>
                </div>
                <Link
                  href={`/${locale}/dashboard/client/messages`}
                  className={ACTION_LINK}
                >
                  Read
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Your requests */}
      <section className="bg-white border border-neutral-200 p-5 sm:p-6" aria-labelledby="requests-heading">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 id="requests-heading" className="text-sm font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Your requests
          </h2>
          {recent.length > 0 && (
            <Link href={consultationsHref} className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 shrink-0">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-neutral-200 bg-neutral-50/50">
            <Inbox className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-900">No requests yet</p>
            <p className="text-xs text-neutral-500 mt-1">When you send a request to a practice, you can follow it here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {recent.map((b) => (
              <li key={b.id}>
                <Link
                  href={consultationsHref}
                  className="block border border-neutral-100 p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-neutral-400">{b.bookingNumber}</span>
                    <Badge className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${BOOKING_STATUS_COLORS[b.status] || 'bg-neutral-100 text-neutral-700'}`}>
                      {BOOKING_STATUS_LABELS[b.status] || b.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-neutral-900 truncate">{ownSubject(b)}</p>
                  <p className="text-xs text-neutral-500 truncate">{b.firm.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {directoryOn && (
        <Link
          href={directoryPath(locale)}
          className={PRIMARY_LINK}
        >
          <Search className="w-4 h-4 mr-2" /> Find a practice
        </Link>
      )}
    </div>
  );
}
