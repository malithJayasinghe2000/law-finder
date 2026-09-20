import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RectificationSchema } from '@/schemas/privacy.schema';
import { recordAccess } from '@/lib/privacy/audit';
import { RETENTION_SCHEDULE } from '@/lib/privacy/policy';
import { getPublishedNotice } from '@/lib/privacy/notice';

/**
 * What we hold about you, and correcting your own details.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GET is the "what we hold" half of the access right, and it is deliberately
 * NOT the export.
 *
 * It returns **categories and counts, never content**. The reason is not
 * squeamishness about payload size: this screen renders in a browser, gets
 * screenshotted, and sits open on a train. The export at
 * `/api/privacy/export` is the thing that actually hands over the words, and it
 * is a deliberate act with a download and an audit-log entry behind it.
 *
 * Matter data appears here as a COUNT AND A FIRM NAME and nothing else. The
 * client engaged that firm themselves, so naming it discloses nothing they do
 * not know — but the file's contents belong to the firm, and we are its
 * processor. The same rule as `buildSubjectExport`: name the firm to ask, never
 * answer for them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type Holding = {
  tier: 1 | 2 | 3 | 4;
  category: string;
  /** Plain language. Somebody who has never read the inventory must follow it. */
  whatItIs: string;
  count: number | null;
  /** Empty string where nothing expires on a schedule of ours. */
  retention: string;
  controller: 'PLATFORM' | 'FIRM';
};

/** The retention sentence for a model, from the schedule rather than retyped. */
function retentionFor(model: string): string {
  const rule = RETENTION_SCHEDULE.find((r) => r.model === model);
  if (!rule) return '';
  const from =
    rule.timestampField === 'updatedAt'
      ? 'from when you last used it'
      : rule.timestampField === 'expiresAt'
        ? 'after it expires'
        : 'from when it was created';
  return `${rule.days} days ${from}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      profileImageUrl: true,
      role: true,
      status: true,
      authProvider: true,
      isEmailVerified: true,
      createdAt: true,
      erasedAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const [
    aiConversations,
    aiMessages,
    posts,
    comments,
    votes,
    slotHolds,
    consentRecords,
    subjectRequests,
    application,
    bookings,
    notice,
  ] = await Promise.all([
    prisma.aiConversation.count({ where: { userId: user.id } }),
    prisma.aiMessage.count({ where: { conversation: { userId: user.id } } }),
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
    prisma.vote.count({ where: { userId: user.id } }),
    prisma.slotHold.count({ where: { clientId: user.id } }),
    prisma.consentRecord.count({ where: { userId: user.id } }),
    prisma.dataSubjectRequest.count({ where: { userId: user.id } }),
    prisma.lawyerApplication.count({ where: { userId: user.id } }),
    prisma.booking.findMany({
      where: { clientId: user.id },
      select: { id: true, firmId: true, firm: { select: { name: true } } },
    }),
    getPublishedNotice(),
  ]);

  // Reads of THIS person's matter data by somebody else. `DataAccessLog` is
  // keyed by the matter, not by the subject, so it is reached through their own
  // bookings. The log holds no content — see the standing rule on
  // `DataAccessLog` — so a count is the whole of what there is to show. A client
  // reading their own matter is not logged (`shouldAudit`), so every entry here
  // is somebody else having opened their file.
  const accessLogEntries =
    bookings.length === 0
      ? 0
      : await prisma.dataAccessLog.count({
          where: { bookingId: { in: bookings.map((b) => b.id) } },
        });

  const byFirm = new Map<string, { firmId: string; firmName: string; matterCount: number }>();
  for (const b of bookings) {
    const existing = byFirm.get(b.firmId);
    if (existing) existing.matterCount += 1;
    else
      byFirm.set(b.firmId, {
        firmId: b.firmId,
        firmName: b.firm?.name ?? 'A law firm',
        matterCount: 1,
      });
  }

  const holdings: Holding[] = [
    {
      tier: 3,
      category: 'Your account',
      whatItIs:
        'Your email address, your name and photograph if you gave them, and how you sign ' +
        'in. Your password is stored only as a one-way hash — we cannot read it.',
      count: 1,
      retention: 'While your account is open, plus a short grace period',
      controller: 'PLATFORM',
    },
    {
      tier: 2,
      category: 'Questions to the legal assistant',
      whatItIs:
        'Conversations you had with the AI assistant, and its answers. These often describe ' +
        'a real situation, so we treat them as sensitive even though no attorney is ' +
        'involved and no privilege attaches. Questions asked while signed out are never stored.',
      count: aiConversations,
      retention: retentionFor('aiConversation'),
      controller: 'PLATFORM',
    },
    {
      tier: 4,
      category: 'Community posts and comments',
      whatItIs:
        'What you wrote in the community, and your votes. Posting "anonymously" hides your ' +
        'name from other readers — it does not hide it from us, because moderation would ' +
        'be impossible otherwise.',
      count: posts + comments,
      retention: 'Until you delete it, or your account is erased',
      controller: 'PLATFORM',
    },
    {
      tier: 4,
      category: 'Held appointment slots',
      whatItIs:
        'Times you were holding in an attorney’s diary. A lapsed hold still records which ' +
        'attorney you were considering, which says something about your affairs.',
      count: slotHolds,
      retention: retentionFor('slotHold'),
      controller: 'PLATFORM',
    },
    {
      tier: 4,
      category: 'Your consent decisions',
      whatItIs:
        'Every time you granted or withdrew one of the three consents, with the version of ' +
        'the privacy notice in force at that moment. This is the evidence that we asked ' +
        'you properly — it is kept even after erasure, for that reason.',
      count: consentRecords,
      retention: 'Kept as evidence of what you agreed to',
      controller: 'PLATFORM',
    },
    {
      tier: 4,
      category: 'Records of who read your matter',
      whatItIs:
        'When somebody at a law firm opened your matter file, we recorded that it happened — ' +
        'who, when, and which record. We did not record what it said. There is no column ' +
        'anywhere in that log for the contents, not even a truncated one.',
      count: accessLogEntries,
      retention: retentionFor('dataAccessLog'),
      controller: 'PLATFORM',
    },
    {
      tier: 4,
      category: 'Data-protection requests you have made',
      whatItIs: 'Requests like this one, what we did about them, and when.',
      count: subjectRequests,
      retention: 'Kept as evidence that we answered you',
      controller: 'PLATFORM',
    },
  ];

  if (application > 0) {
    holdings.push({
      tier: 3,
      category: 'Your application to be listed as an attorney',
      whatItIs:
        'Your NIC number, BASL registration number, practising certificate and photograph, ' +
        'and your practice details. We hold these to check that a person holding themselves ' +
        'out as an admitted Attorney-at-Law really is one.',
      count: application,
      retention: retentionFor('lawyerApplication'),
      controller: 'PLATFORM',
    });
  }

  const matterCount = bookings.length;

  if (matterCount > 0) {
    holdings.push({
      tier: 1,
      category: 'Your matter files with law firms',
      whatItIs:
        'What you told your attorney about your problem, the firm’s conflict-of-interest ' +
        'check, quotes, the engagement letter, fee notes and your messages with your ' +
        'attorney. This is privileged, it is encrypted, and our own staff cannot read it. ' +
        'It belongs to the firm, not to us — so the firm decides what may be released or ' +
        'deleted, and we refer your request to them.',
      count: matterCount,
      retention: 'The firm decides. Nothing here is on any automatic deletion schedule of ours',
      controller: 'FIRM',
    });
  }

  return NextResponse.json({
    account: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      erasedAt: user.erasedAt?.toISOString() ?? null,
    },
    holdings,
    aiMessages,
    firmsHoldingMatters: [...byFirm.values()],
    currentNoticeVersion: notice?.version ?? null,
  });
}

/**
 * Rectification — correcting your own details.
 *
 * Deliberately narrow. A person may correct what they told us about
 * themselves; they may not reach `role`, `status`, verification state, or
 * anything on a matter. Matter data is the firm's record of what happened, and
 * a client rewriting it would corrupt the firm's file rather than correct it —
 * so a correction to a matter goes to the firm as a request, not as an edit.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = RectificationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to correct.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { status: true },
  });

  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  if (user.status === 'ERASED') {
    return NextResponse.json(
      { error: 'This account has been erased and cannot be edited.' },
      { status: 409 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: parsed.data,
    select: { id: true, email: true, fullName: true, profileImageUrl: true },
  });

  await recordAccess({
    actorUserId: session.userId,
    actorRole: session.role,
    resource: 'SUBJECT_REQUEST',
    resourceId: session.userId,
    action: 'RECTIFIED',
  });

  return NextResponse.json({ user: updated });
}
