import prisma from '@/lib/db';
import type { FirmRole } from '@prisma/client';
import {
  decryptField,
  decryptFieldList,
  UNDECRYPTABLE_MARKER,
} from '@/lib/privacy/encryption';

/**
 * Who inside a firm may see what.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the only file in the codebase that decides whether someone may read a
 * client's account of their legal problem. Do not re-implement any of it inline
 * in a route. If the rule changes, it changes here once.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Why it is written this conservatively:
 *
 * Before Phase 2 there was exactly one person who could read a matter — the
 * attorney the client chose. Introducing firms necessarily widens that, and
 * every person added is a person who could waive privilege under Evidence
 * Ordinance s.126. Whether non-attorney staff (paralegals, practice managers)
 * may read matter detail at all is an open question with counsel — question 8(b)
 * in docs/restructure/QUESTIONS-FOR-COUNSEL.md — so until it is answered:
 *
 *   - the assigned attorney always may;
 *   - FIRM_OWNER and FIRM_ADMIN may, because someone must be able to reassign a
 *     matter when an attorney is ill, leaves, or has a conflict;
 *   - other ATTORNEY members of the same firm may NOT, unless assigned;
 *   - PARALEGAL never may;
 *   - platform staff, including ADMIN, never may — that has been true since
 *     Phase 0.5 and firms do not change it.
 *
 * Loosening any of these is a legal decision, not an engineering one.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 5).
 */

/** Firm roles that may read a matter belonging to their firm but not assigned to them. */
const MATTER_READING_ROLES: FirmRole[] = ['FIRM_OWNER', 'FIRM_ADMIN'];

/** Firm roles that may reassign a matter to a different attorney in the firm. */
const ASSIGNING_ROLES: FirmRole[] = ['FIRM_OWNER', 'FIRM_ADMIN'];

/** Firm roles that may edit the firm's own profile, offices and bank details. */
const FIRM_ADMIN_ROLES: FirmRole[] = ['FIRM_OWNER', 'FIRM_ADMIN'];

/** Firm roles that may add, remove or re-role other members. */
const MEMBER_MANAGING_ROLES: FirmRole[] = ['FIRM_OWNER'];

export type FirmMembership = {
  firmId: string;
  firmName: string;
  role: FirmRole;
  /** The member's own LawyerProfile id, when they are an admitted attorney. */
  profileId: string | null;
  isSoloPractice: boolean;
};

/**
 * The firm this user acts for, or null if they belong to none.
 *
 * Returns the single ACTIVE membership. A user with several active memberships
 * is unusual (an attorney consulting to a second practice) and is not supported
 * by the UI yet — the first by join date wins, deterministically.
 */
export async function getFirmMembership(
  userId: string
): Promise<FirmMembership | null> {
  const member = await prisma.firmMember.findFirst({
    where: { userId, status: 'ACTIVE', firm: { isActive: true } },
    orderBy: { joinedAt: 'asc' },
    select: {
      role: true,
      firm: { select: { id: true, name: true, isSoloPractice: true } },
      user: { select: { profile: { select: { id: true } } } },
    },
  });

  if (!member) return null;

  return {
    firmId: member.firm.id,
    firmName: member.firm.name,
    role: member.role,
    profileId: member.user.profile?.id ?? null,
    isSoloPractice: member.firm.isSoloPractice,
  };
}

/** The shape of a matter this module needs in order to decide anything. */
export type MatterOwnership = {
  /**
   * LawyerProfile id of the attorney currently responsible.
   *
   * NULL means the matter is unassigned — it arrived addressed to the firm and
   * is sitting in its queue. Nobody has `ASSIGNED_ATTORNEY` access to it yet, so
   * only the principal or practice manager can read it, which is what makes it
   * triageable at all.
   */
  lawyerId: string | null;
  /** The firm that received the request */
  firmId: string | null;
  /** User id of the client */
  clientId: string;
};

export type MatterAccess = {
  /** May read the matter at all (list entry, status, schedule). */
  canRead: boolean;
  /**
   * May read the client's own description of their legal problem, the conflict
   * check, and the attorney's notes. Strictly narrower than `canRead`.
   */
  canReadMatterDetail: boolean;
  /** May act on the engagement: conflict check, quote, confirm payment, complete. */
  canAct: boolean;
  /** May reassign the matter to another attorney in the same firm. */
  canAssign: boolean;
  /** Why access was granted — used for audit trails and error messages. */
  basis:
    | 'CLIENT'
    | 'ASSIGNED_ATTORNEY'
    | 'FIRM_PRINCIPAL'
    | 'FIRM_MEMBER_LIMITED'
    | 'PLATFORM_STAFF'
    | 'NONE';
};

const NO_ACCESS: MatterAccess = {
  canRead: false,
  canReadMatterDetail: false,
  canAct: false,
  canAssign: false,
  basis: 'NONE',
};

/**
 * Decide what this actor may do with this matter.
 *
 * `membership` may be null for clients and platform staff — pass the result of
 * `getFirmMembership` when the actor is a LAWYER.
 */
export function resolveMatterAccess(params: {
  actorUserId: string;
  actorRole: 'ADMIN' | 'LAWYER' | 'CLIENT';
  actorProfileId?: string | null;
  membership: FirmMembership | null;
  matter: MatterOwnership;
}): MatterAccess {
  const { actorUserId, actorRole, actorProfileId, membership, matter } = params;

  // The client owns their own matter. They see everything they told us and
  // everything the firm has sent them — but never the firm's internal conflict
  // screening, which is handled separately because it concerns other clients.
  if (matter.clientId === actorUserId) {
    return {
      canRead: true,
      canReadMatterDetail: true,
      canAct: false,
      canAssign: false,
      basis: 'CLIENT',
    };
  }

  // Platform staff. ADMIN can see that a matter exists — they have to be able to
  // support the product and count things — but never what it is about. This is
  // Evidence Ordinance s.126: a third party who can read privileged material can
  // be used to argue privilege was waived.
  if (actorRole === 'ADMIN') {
    return {
      canRead: true,
      canReadMatterDetail: false,
      canAct: false,
      canAssign: false,
      basis: 'PLATFORM_STAFF',
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // AUTHORITY INSIDE A FIRM COMES FROM MEMBERSHIP, NOT FROM THE PLATFORM ROLE.
  //
  // This used to read `if (actorRole !== 'LAWYER') return NO_ACCESS;`, and that
  // was wrong in a way nothing caught until the flow was driven in a browser.
  //
  // A practice manager or a paralegal is usually NOT an admitted attorney, so
  // their platform `Role` is `CLIENT`. The guard therefore refused every
  // non-attorney firm member outright — a `FIRM_ADMIN` who is meant to run the
  // diary got 403 on the diary. Non-attorney membership did nothing at all.
  //
  // `check:privilege` passed throughout, because its fixtures described the
  // paralegal as `actorRole: 'LAWYER'` — a combination that cannot occur. The
  // test asserted a rule about a person who does not exist. There are now cases
  // below for the roles as they really are.
  //
  // The platform role is still what separates a stranger from a member: without
  // an ACTIVE membership of this matter's firm, there is no way past here.
  // ───────────────────────────────────────────────────────────────────────────
  if (actorRole !== 'LAWYER' && !membership) return NO_ACCESS;

  // The attorney the client chose, or the attorney the firm has since assigned.
  // Guarded on matter.lawyerId being set so that an unassigned matter cannot be
  // claimed by a lawyer who simply has no profile id.
  if (actorProfileId && matter.lawyerId && actorProfileId === matter.lawyerId) {
    return {
      canRead: true,
      canReadMatterDetail: true,
      canAct: true,
      canAssign: false,
      basis: 'ASSIGNED_ATTORNEY',
    };
  }

  // Everyone else must be in the same firm. A matter never crosses firms.
  if (!membership || !matter.firmId || membership.firmId !== matter.firmId) {
    return NO_ACCESS;
  }

  // The principal or practice manager. They can see the matter and move it to
  // another attorney, but they do not act on the engagement itself — quoting and
  // conflict-checking belong to the attorney who will do the work.
  if (MATTER_READING_ROLES.includes(membership.role)) {
    return {
      canRead: true,
      canReadMatterDetail: true,
      canAct: false,
      canAssign: ASSIGNING_ROLES.includes(membership.role),
      basis: 'FIRM_PRINCIPAL',
    };
  }

  // An unassigned attorney or a paralegal at the same firm. They can see that
  // the matter exists — enough to run a diary and answer the phone — and nothing
  // about what it concerns.
  return {
    canRead: true,
    canReadMatterDetail: false,
    canAct: false,
    canAssign: false,
    basis: 'FIRM_MEMBER_LIMITED',
  };
}

/**
 * Convenience wrapper: load the membership and resolve access in one call.
 */
export async function getMatterAccess(params: {
  actorUserId: string;
  actorRole: 'ADMIN' | 'LAWYER' | 'CLIENT';
  actorProfileId?: string | null;
  matter: MatterOwnership;
}): Promise<MatterAccess> {
  // Membership is loaded for everyone except platform staff.
  //
  // It used to be loaded only for `LAWYER`, which meant a practice manager or
  // paralegal — whose platform role is `CLIENT`, because they are not admitted
  // attorneys — arrived at the rule with `membership: null` and could never
  // match their own firm. Skipping the lookup for ADMIN is not an optimisation:
  // platform staff have no firm membership that could grant them anything, and
  // the rule refuses them before it looks.
  const membership =
    params.actorRole === 'ADMIN'
      ? null
      : await getFirmMembership(params.actorUserId);

  return resolveMatterAccess({ ...params, membership });
}

// ─────────────────────────────────────────────────────────────────────────────
// Disclosure — the only path from stored ciphertext to readable text
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a reader sees where they may see that a matter exists but not what it
 * says. Deliberately a sentence and not an empty string: a blank field reads as
 * "the client wrote nothing", which is a different and misleading claim.
 */
export const WITHHELD_MARKER = '[Withheld - privileged]';

/**
 * Turn one stored privileged field into something a caller may have.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS FUNCTION HAS EXACTLY THREE OUTCOMES AND CIPHERTEXT IS NOT ONE OF THEM.
 *
 *   1. The reader may read the detail, and the value decrypts → plaintext.
 *   2. The reader may not read the detail                     → WITHHELD_MARKER.
 *   3. The reader may, but the value will not decrypt         → UNDECRYPTABLE_MARKER.
 *
 * Outcome 3 exists because the tempting alternative — "if decryption fails,
 * return what is stored" — hands the ciphertext to whoever asked. That is the
 * failure mode that makes an encryption-at-rest feature theatre, and it is the
 * one `npm run check:privilege` is written to catch. It asserts that the value
 * a withheld reader receives is neither the plaintext nor the stored ciphertext.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function discloseField(params: {
  access: MatterAccess;
  model: string;
  recordId: string;
  field: string;
  stored: string | null | undefined;
}): string | null {
  const { access, model, recordId, field, stored } = params;

  if (stored === null || stored === undefined || stored === '') return stored ?? null;

  if (!access.canReadMatterDetail) return WITHHELD_MARKER;

  try {
    return decryptField({ model, recordId, field }, stored);
  } catch (error) {
    // Logged without the value. A log line carrying the ciphertext would be a
    // second copy of privileged material in a store with different retention
    // and different access rules — the same reasoning that keeps a content
    // column off `DataAccessLog`.
    console.error(
      `[privilege] could not decrypt ${model}.${field} on ${recordId}:`,
      error instanceof Error ? error.message : 'unknown error'
    );
    return UNDECRYPTABLE_MARKER;
  }
}

/** `discloseField` for a string-array column, e.g. `ConflictCheck.screenedParties`. */
export function discloseFieldList(params: {
  access: MatterAccess;
  model: string;
  recordId: string;
  field: string;
  stored: string[];
}): string[] {
  const { access, model, recordId, field, stored } = params;

  if (!access.canReadMatterDetail) return stored.map(() => WITHHELD_MARKER);

  try {
    return decryptFieldList({ model, recordId, field }, stored);
  } catch (error) {
    console.error(
      `[privilege] could not decrypt ${model}.${field} on ${recordId}:`,
      error instanceof Error ? error.message : 'unknown error'
    );
    return stored.map(() => UNDECRYPTABLE_MARKER);
  }
}

/**
 * Disclose a matter for an actor: decrypt what they may read, withhold the rest.
 *
 * Always run list and detail payloads through this rather than deciding by hand
 * at each call site — Phase 0 shipped a redaction on one booking read path and
 * missed the other, and that class of miss is now worse than it was, because
 * the field a call site forgets no longer leaks the description: it leaks the
 * ciphertext, which looks harmless in a code review.
 *
 * Replaces `redactMatter`, which only blanked fields. Blanking was sufficient
 * while the columns held plaintext; now that they hold ciphertext, a reader who
 * may see the matter also needs it turned back into words.
 */
export function discloseMatter<
  T extends {
    id: string;
    subject?: string | null;
    description?: string | null;
    lawyerNotes?: string | null;
  },
>(matter: T, access: MatterAccess): T {
  const ref = { access, model: 'Booking', recordId: matter.id };

  return {
    ...matter,
    ...('subject' in matter
      ? { subject: discloseField({ ...ref, field: 'subject', stored: matter.subject }) }
      : {}),
    ...('description' in matter
      ? {
          description: discloseField({
            ...ref,
            field: 'description',
            stored: matter.description,
          }),
        }
      : {}),
    // Notes are the attorney's own working record. A reader without detail
    // access gets null rather than a marker, because unlike the subject and
    // description there is no client-facing expectation that anything is there.
    ...('lawyerNotes' in matter
      ? {
          lawyerNotes: access.canReadMatterDetail
            ? discloseField({ ...ref, field: 'lawyerNotes', stored: matter.lawyerNotes })
            : null,
        }
      : {}),
  };
}

/**
 * Disclose a quote.
 *
 * `scopeOfWork` describes what the firm agreed to do about the client's
 * problem, so it is privileged in the same way the description is.
 *
 * This exists because of a leak found while wiring encryption in: the booking
 * detail route `include`s `quotes` and spread the rows straight into its
 * response, so every quote's scope of work reached anyone who could see that
 * the matter existed — a paralegal, another attorney at the firm, and platform
 * `ADMIN`. The subject and description were being carefully withheld one line
 * above while the same information went out in an adjacent field.
 */
export function discloseQuote<
  T extends {
    id: string;
    scopeOfWork?: string | null;
    exclusions?: string | null;
    declineReason?: string | null;
  },
>(quote: T, access: MatterAccess): T {
  const ref = { access, model: 'Quote', recordId: quote.id };

  return {
    ...quote,
    ...('scopeOfWork' in quote
      ? {
          scopeOfWork: discloseField({
            ...ref,
            field: 'scopeOfWork',
            stored: quote.scopeOfWork,
          }),
        }
      : {}),
    ...('exclusions' in quote
      ? { exclusions: discloseField({ ...ref, field: 'exclusions', stored: quote.exclusions }) }
      : {}),
    ...('declineReason' in quote
      ? {
          declineReason: discloseField({
            ...ref,
            field: 'declineReason',
            stored: quote.declineReason,
          }),
        }
      : {}),
  };
}

/**
 * Disclose an engagement letter.
 *
 * The letter snapshots the matter subject and the scope of work, so those
 * columns are encrypted too — a plaintext copy three tables away would have
 * made encrypting the originals pointless for every matter that reached
 * acceptance.
 */
export function discloseEngagementLetter<
  T extends {
    id: string;
    body?: string | null;
    matterSubject?: string | null;
    scopeOfWork?: string | null;
    exclusions?: string | null;
  },
>(letter: T, access: MatterAccess): T {
  const ref = { access, model: 'EngagementLetter', recordId: letter.id };

  return {
    ...letter,
    ...('body' in letter
      ? { body: discloseField({ ...ref, field: 'body', stored: letter.body }) }
      : {}),
    ...('matterSubject' in letter
      ? {
          matterSubject: discloseField({
            ...ref,
            field: 'matterSubject',
            stored: letter.matterSubject,
          }),
        }
      : {}),
    ...('scopeOfWork' in letter
      ? {
          scopeOfWork: discloseField({
            ...ref,
            field: 'scopeOfWork',
            stored: letter.scopeOfWork,
          }),
        }
      : {}),
    ...('exclusions' in letter
      ? { exclusions: discloseField({ ...ref, field: 'exclusions', stored: letter.exclusions }) }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message threads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Who may read a client↔firm message thread.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Until Phase 7 this rule did not exist. `Conversation` and `Message` held
 * client↔attorney communication — the most obviously privileged material in the
 * system — and access was decided in the chat routes by a single question: is
 * there a `ConversationParticipant` row for you? Three things followed from
 * that, and each is a real hole rather than a tidiness complaint:
 *
 *   1. An attorney who LEFT a firm kept reading its clients' messages. A
 *      participant row has no end date, so leaving the practice removed their
 *      access to the matter file and left the conversation about it open.
 *   2. Nothing in the code said platform staff may not read a thread. No route
 *      did, but the rule lived in the absence of a query rather than in a
 *      decision — and absences do not survive the next feature.
 *   3. `POST /api/chat/conversations` accepted any user id, so a signed-in user
 *      could open a thread with anyone at all.
 *
 * THE DELIBERATE NARROWNESS. Unlike a matter, a thread is NOT readable by the
 * firm's principal unless they are in it. A principal needs the matter file to
 * triage and reassign; they do not need to read a conversation that has already
 * happened between a colleague and a client. Every extra person who can read a
 * privileged communication is another person an opponent can point at to argue
 * privilege was waived, so the default is the narrowest one that works.
 *
 * See docs/restructure/DATA-INVENTORY.md §7 finding B and LEGAL-GUARDRAILS.md
 * (rule 5). Asserted by `npm run check:privilege`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type ConversationOwnership = {
  /** The firm on the other side. NULL for pre-Phase-7 threads. */
  firmId: string | null;
  /** The client in the thread. */
  clientId: string | null;
  /** User ids of everyone with a participant row. */
  participantUserIds: string[];
};

export type ConversationAccess = {
  /** May open the thread and read its messages. */
  canRead: boolean;
  /** May post to it. */
  canWrite: boolean;
  basis: 'CLIENT' | 'FIRM_ATTORNEY' | 'FORMER_PARTICIPANT' | 'NONE';
};

const NO_CONVERSATION_ACCESS: ConversationAccess = {
  canRead: false,
  canWrite: false,
  basis: 'NONE',
};

export function resolveConversationAccess(params: {
  actorUserId: string;
  actorRole: 'ADMIN' | 'LAWYER' | 'CLIENT';
  /** The actor's ACTIVE firm membership, or null. */
  membership: FirmMembership | null;
  conversation: ConversationOwnership;
}): ConversationAccess {
  const { actorUserId, actorRole, membership, conversation } = params;

  // Platform staff, first and unconditionally.
  //
  // Checked before participation rather than after, so that a future feature
  // which puts a support user into a thread cannot accidentally grant them the
  // history of everything said before they arrived. If we ever need staff in a
  // conversation, that is a product decision with a client-visible disclosure
  // attached, not a fall-through.
  if (actorRole === 'ADMIN') return NO_CONVERSATION_ACCESS;

  const isParticipant = conversation.participantUserIds.includes(actorUserId);
  if (!isParticipant) return NO_CONVERSATION_ACCESS;

  // The client always keeps their own thread. Their access does not depend on
  // the firm, because it is their conversation as much as the firm's, and a
  // client must not lose their record of what their attorney told them because
  // the attorney changed practice.
  if (conversation.clientId === actorUserId) {
    return { canRead: true, canWrite: true, basis: 'CLIENT' };
  }

  if (actorRole !== 'LAWYER') return NO_CONVERSATION_ACCESS;

  // A pre-Phase-7 thread with no firm recorded. Participants only, and it can
  // never be widened, because there is no firm to widen it to.
  if (!conversation.firmId) {
    return { canRead: true, canWrite: true, basis: 'FIRM_ATTORNEY' };
  }

  // The firm side. Participation is not permanent authority: it must still be
  // backed by an ACTIVE membership of the firm the client was talking to.
  if (membership && membership.firmId === conversation.firmId) {
    return { canRead: true, canWrite: true, basis: 'FIRM_ATTORNEY' };
  }

  // In the thread, but no longer of the firm. This is the case the old rule got
  // wrong: they used to keep reading indefinitely. The distinct basis exists so
  // an audit can tell "never had access" from "had it and lost it".
  return { canRead: false, canWrite: false, basis: 'FORMER_PARTICIPANT' };
}

/** Load the membership and resolve conversation access in one call. */
export async function getConversationAccess(params: {
  actorUserId: string;
  actorRole: 'ADMIN' | 'LAWYER' | 'CLIENT';
  conversation: ConversationOwnership;
}): Promise<ConversationAccess> {
  // Same reasoning as `getMatterAccess`: a firm-side participant need not be an
  // admitted attorney, so membership cannot be gated on the platform role.
  const membership =
    params.actorRole === 'ADMIN'
      ? null
      : await getFirmMembership(params.actorUserId);

  return resolveConversationAccess({ ...params, membership });
}

/**
 * Disclose one message.
 *
 * `Message.content` is encrypted at rest. As everywhere else, a reader who may
 * not have the words gets a marker and never the stored value.
 */
export function discloseMessage<T extends { id: string; content: string }>(
  message: T,
  access: ConversationAccess
): T {
  if (!access.canRead) {
    return { ...message, content: WITHHELD_MARKER };
  }

  try {
    return {
      ...message,
      content: decryptField(
        { model: 'Message', recordId: message.id, field: 'content' },
        message.content
      ),
    };
  } catch (error) {
    console.error(
      `[privilege] could not decrypt Message.content on ${message.id}:`,
      error instanceof Error ? error.message : 'unknown error'
    );
    return { ...message, content: UNDECRYPTABLE_MARKER };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firm administration
// ─────────────────────────────────────────────────────────────────────────────

export function canManageFirm(membership: FirmMembership | null): boolean {
  return !!membership && FIRM_ADMIN_ROLES.includes(membership.role);
}

export function canManageMembers(membership: FirmMembership | null): boolean {
  return !!membership && MEMBER_MANAGING_ROLES.includes(membership.role);
}

/**
 * Confirm that an attorney may be given a matter belonging to a firm.
 *
 * This is the invariant that keeps `Booking.lawyerId` and `Booking.firmId`
 * consistent: the responsible attorney must be an ACTIVE attorney member of the
 * owning firm. Nothing may move a matter to an attorney at another practice —
 * that would be a referral, and a referral is exactly what we must never make.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 3 and 4).
 */
export async function assertAttorneyBelongsToFirm(
  profileId: string,
  firmId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const profile = await prisma.lawyerProfile.findUnique({
    where: { id: profileId },
    select: { id: true, firmId: true, isVerified: true, userId: true },
  });

  if (!profile) return { ok: false, reason: 'That attorney does not exist.' };

  if (profile.firmId !== firmId) {
    return {
      ok: false,
      reason: 'A matter can only be assigned to an attorney in the same firm.',
    };
  }

  const member = await prisma.firmMember.findUnique({
    where: { firmId_userId: { firmId, userId: profile.userId } },
    select: { role: true, status: true },
  });

  if (!member || member.status !== 'ACTIVE') {
    return {
      ok: false,
      reason: 'That attorney is not an active member of this firm.',
    };
  }

  if (member.role === 'PARALEGAL' || member.role === 'FIRM_ADMIN') {
    return {
      ok: false,
      reason:
        'A matter must be the responsibility of an admitted attorney, not support staff.',
    };
  }

  return { ok: true };
}
