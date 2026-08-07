/**
 * Executing data-subject rights: export and erasure.
 *
 * The rules are in `policy.ts`; this carries them out. Two properties of this
 * file are load-bearing and easy to lose in a later refactor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. AN EXPORT MUST NOT BECOME A DISCLOSURE ROUTE.
 *
 * A subject-access request is a right to *your* data, not to everything a
 * record about you happens to contain. A `ConflictCheck` names other firms'
 * clients and opposing parties; an `EngagementLetter` names the attorneys
 * acting. Releasing those rows whole would answer one person's request by
 * breaching several other people's confidentiality — and in the conflict-check
 * case, would hand someone the names of parties a firm screened them against.
 *
 * So matter data is NOT exported here at all. It is referred to the firm that
 * controls it, which is both the lawful position and the safe one.
 *
 * 2. ERASURE IS ANONYMISATION, NOT DELETION.
 *
 * The `User` row survives with its identifying fields overwritten. Deleting it
 * would cascade into a firm's matter file or orphan it, and a firm may be
 * professionally required to keep that file. We are the processor; it is not
 * ours to destroy. The interface must report this as PARTIAL, honestly.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import prisma from '@/lib/db';
import { ERASURE_PLAN, erasedEmailFor, summariseErasure } from './policy';

// ─────────────────────────────────────────────────────────────────────────────
// Export (access / portability)
// ─────────────────────────────────────────────────────────────────────────────

export type SubjectExport = {
  generatedAt: string;
  subject: { id: string; email: string; fullName: string | null; role: string; createdAt: string };
  account: unknown;
  consents: unknown[];
  aiConversations: unknown[];
  communityActivity: { posts: unknown[]; comments: unknown[]; votesCast: number };
  enquiriesSent: unknown[];
  subjectRequests: unknown[];
  /**
   * Matter data is deliberately absent. This names the firms to ask instead —
   * see the header comment.
   */
  heldByLawFirms: {
    firmId: string;
    firmName: string;
    matterCount: number;
    note: string;
  }[];
  notIncluded: string[];
};

/**
 * Everything we hold about a person **as controller**, in one JSON document.
 *
 * Serves both the access right and portability: the difference between them is
 * what the recipient may do with it, not what we assemble.
 */
export async function buildSubjectExport(userId: string): Promise<SubjectExport | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      status: true,
      authProvider: true,
      isEmailVerified: true,
      profileImageUrl: true,
    },
  });

  if (!user) return null;

  const [consents, aiConversations, posts, comments, votesCast, enquiries, requests, bookings] =
    await Promise.all([
      prisma.consentRecord.findMany({
        where: { userId },
        select: { purpose: true, noticeVersion: true, grantedAt: true, withdrawnAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.aiConversation.findMany({
        where: { userId },
        select: {
          title: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            select: { role: true, content: true, createdAt: true, refusalCategory: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.post.findMany({
        where: { authorId: userId },
        select: { title: true, content: true, createdAt: true, isAnonymous: true },
      }),
      prisma.comment.findMany({
        where: { authorId: userId },
        select: { content: true, createdAt: true, isAnonymous: true, isDeleted: true },
      }),
      prisma.vote.count({ where: { userId } }),
      prisma.inquiry.findMany({
        where: { clientEmail: user.email },
        select: { message: true, status: true, createdAt: true },
      }),
      prisma.dataSubjectRequest.findMany({
        where: { userId },
        select: { type: true, status: true, createdAt: true, completedAt: true, outcomeNote: true },
      }),
      prisma.booking.findMany({
        where: { clientId: userId },
        select: { firmId: true, firm: { select: { name: true } } },
      }),
    ]);

  // Group matters by firm WITHOUT reading a single matter field.
  const byFirm = new Map<string, { name: string; count: number }>();
  for (const b of bookings) {
    const entry = byFirm.get(b.firmId);
    if (entry) entry.count++;
    else byFirm.set(b.firmId, { name: b.firm.name, count: 1 });
  }

  return {
    generatedAt: new Date().toISOString(),
    subject: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    account: {
      status: user.status,
      authProvider: user.authProvider,
      isEmailVerified: user.isEmailVerified,
      profileImageUrl: user.profileImageUrl,
    },
    consents,
    aiConversations,
    communityActivity: { posts, comments, votesCast },
    enquiriesSent: enquiries,
    subjectRequests: requests,
    heldByLawFirms: [...byFirm.entries()].map(([firmId, { name, count }]) => ({
      firmId,
      firmName: name,
      matterCount: count,
      note:
        'This firm holds your matter file. It decides what is released from it, not us — ' +
        'we host it on the firm\'s behalf. Your request has been passed to them.',
    })),
    notIncluded: [
      'Your matter files, quotes, engagement letters, fee notes and messages with your ' +
        'attorney. These belong to the law firm you engaged; ask them, or use the request ' +
        'we have already referred.',
      'Conflict-of-interest records, which name other people as well as you and cannot be ' +
        'released on one party\'s request.',
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Erasure
// ─────────────────────────────────────────────────────────────────────────────

export type ErasureResult = {
  /** Always true today — a firm's file always survives. */
  partial: boolean;
  anonymisedUser: boolean;
  deleted: Record<string, number>;
  retained: { model: string; explanation: string }[];
  referredFirmIds: string[];
};

/**
 * Carry out an erasure request against platform-controlled data only.
 *
 * Runs in one transaction so a half-erased account is not a state anyone can
 * observe. Firm-controlled data is untouched by construction: this function has
 * no code path that writes to a matter table, and `ERASURE_PLAN` records why
 * for every one of them.
 */
export async function eraseSubject(userId: string): Promise<ErasureResult | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true },
  });

  if (!user) return null;

  const firmIds = await prisma.booking
    .findMany({ where: { clientId: userId }, select: { firmId: true }, distinct: ['firmId'] })
    .then((rows) => rows.map((r) => r.firmId));

  const deleted: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    // Their questions to the AI assistant. Cascades to AiMessage.
    deleted.aiConversation = (
      await tx.aiConversation.deleteMany({ where: { userId } })
    ).count;

    // Enquiries are keyed by the email they were sent with, not by user id.
    // Read it before the overwrite below, or this matches nothing.
    deleted.inquiry = (
      await tx.inquiry.deleteMany({ where: { clientEmail: user.email } })
    ).count;

    deleted.vote = (await tx.vote.deleteMany({ where: { userId } })).count;

    deleted.slotHold = (await tx.slotHold.deleteMany({ where: { clientId: userId } })).count;

    // Community writing stays — other people's replies depend on it — but is
    // detached from the person. `isAnonymous` is the mechanism the read paths
    // already use to substitute the author, so this reuses it rather than
    // inventing a second concept of "hidden author".
    deleted.postsAnonymised = (
      await tx.post.updateMany({ where: { authorId: userId }, data: { isAnonymous: true } })
    ).count;
    deleted.commentsAnonymised = (
      await tx.comment.updateMany({ where: { authorId: userId }, data: { isAnonymous: true } })
    ).count;

    // The account itself: overwritten in place, never removed.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: erasedEmailFor(userId),
        fullName: null,
        passwordHash: null,
        googleId: null,
        profileImageUrl: null,
        isEmailVerified: false,
        status: 'ERASED',
        erasedAt: new Date(),
      },
    });
  });

  const summary = summariseErasure();

  return {
    partial: true,
    anonymisedUser: true,
    deleted,
    retained: summary.retained.map((s) => ({ model: s.model, explanation: s.explanation })),
    referredFirmIds: firmIds,
  };
}

/** The plan, for showing someone what will happen before they confirm. */
export function erasurePreview() {
  const summary = summariseErasure();
  return {
    willDelete: summary.deleted.map((s) => s.explanation),
    willAnonymise: summary.anonymised.map((s) => s.explanation),
    willBeKept: summary.retained.map((s) => ({ model: s.model, why: s.explanation })),
    partial: summary.partial,
    plan: ERASURE_PLAN,
  };
}
