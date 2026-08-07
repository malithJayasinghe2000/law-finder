/**
 * Writing the access log.
 *
 * `firms/access.ts` decides WHETHER someone may read a matter. This records
 * THAT THEY DID. The two are deliberately separate files: Phase 6 records
 * access, it does not widen or narrow it, and nothing in here may ever be
 * consulted to make an access decision.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Two rules that are easy to break later.
 *
 * 1. NO CONTENT EVER REACHES THIS LOG. There is no parameter for the matter
 *    description, the conflict-check note, or an excerpt of either — and none
 *    should be added. A log of *who read a matter description* is an
 *    accountability record. A log that copies the description into itself is a
 *    second privileged store with different access rules and a different
 *    retention period, which is a new place for privilege to leak.
 *
 * 2. A FAILED WRITE MUST NOT BLOCK THE READ. An attorney opening their own
 *    client's matter cannot be stopped by a logging problem — that would break
 *    a working flow to satisfy a compliance feature, which is exactly the trade
 *    this project refuses to make. Failures are reported loudly and swallowed.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { AuditedAction, AuditedResource } from '@prisma/client';
import prisma from '@/lib/db';
import { shouldAudit } from './policy';

export type AccessRecord = {
  /** Who read it. */
  actorUserId: string;
  /**
   * Their role at the moment of reading — a `FirmRole`, or 'ADMIN' / 'CLIENT'.
   * Denormalised because roles change and the log must say what was true then.
   */
  actorRole: string;
  resource: AuditedResource;
  resourceId: string;
  action: AuditedAction;
  bookingId?: string | null;
  firmId?: string | null;
  /**
   * The client the matter belongs to. When the actor IS the client, nothing is
   * written: they wrote the thing they are reading, and logging it would bury
   * the entries anyone would actually look for.
   */
  clientUserId?: string | null;
};

export async function recordAccess(record: AccessRecord): Promise<void> {
  try {
    if (
      record.clientUserId &&
      !shouldAudit({ actorUserId: record.actorUserId, clientUserId: record.clientUserId })
    ) {
      return;
    }

    await prisma.dataAccessLog.create({
      data: {
        actorUserId: record.actorUserId,
        actorRole: record.actorRole,
        resource: record.resource,
        resourceId: record.resourceId,
        action: record.action,
        bookingId: record.bookingId ?? null,
        firmId: record.firmId ?? null,
      },
    });
  } catch (error) {
    // Loud, but not fatal. See rule 2 above.
    console.error('[privacy] failed to write access log', {
      resource: record.resource,
      resourceId: record.resourceId,
      action: record.action,
      error,
    });
  }
}

/**
 * The actor's role as the log should record it.
 *
 * Prefers the firm role, because "FIRM_OWNER" says more about why someone could
 * read a matter than "LAWYER" does.
 */
export function actorRoleFor(params: {
  sessionRole: string;
  firmRole?: string | null;
}): string {
  return params.firmRole ?? params.sessionRole;
}
