/**
 * The privacy notice register: publishing, resolving, and reading versions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A REGISTER RATHER THAN A PAGE SOMEBODY EDITS.
 *
 * `ConsentRecord.noticeVersion` records which notice a person was shown when
 * they agreed to something. Consent under the PDPA must be **demonstrable**,
 * and demonstrating it means producing the exact words that person read. Before
 * Phase 8 the version was a constant in `policy.ts` pointing at no document at
 * all, so every consent record on the system was a claim about wording nobody
 * could produce.
 *
 * Two rules follow, and they are the whole point of this file:
 *
 *   1. **A published version is never edited.** Publishing writes a NEW row and
 *      supersedes the old one. `assertEditable()` refuses anything else. This is
 *      the same snapshot rule as `EngagementLetter.body` and `FeeNote.content`.
 *
 *   2. **A superseded version is never deleted.** It keeps its own permanent URL
 *      because consent records point at it. Evidence you can take off the shelf
 *      is not evidence.
 *
 * THE FAIL-CLOSED RULE. Granting consent when no notice is published is
 * refused (`requirePublishedVersionForConsent`). Recording "they agreed to
 * version X" where X resolves to nothing recreates the exact defect this phase
 * exists to fix, and doing it silently is worse than an error. **Withdrawal is
 * never blocked** — that is the person exercising a right, and a missing
 * document of ours is not a reason to refuse it.
 *
 * Run `npm run check:pdpa` after changing this file.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import prisma from '@/lib/db';
import { PRIVACY_NOTICE_VERSION } from './policy';

export type PublishedNotice = {
  id: string;
  version: string;
  title: string;
  body: string;
  changeSummary: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  publishedAt: Date | null;
};

const NOTICE_FIELDS = {
  id: true,
  version: true,
  title: true,
  body: true,
  changeSummary: true,
  status: true,
  publishedAt: true,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────────────

/** The version currently in force, or null if nothing has been published. */
export async function getPublishedNotice(): Promise<PublishedNotice | null> {
  return prisma.privacyNotice.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: NOTICE_FIELDS,
  });
}

/**
 * One version by its label, for the permanent per-version URL.
 *
 * Deliberately will not return a `DRAFT`: an unpublished draft is not a
 * document anybody agreed to, and serving it at a public URL would mean the
 * register showed wording that was never in force.
 */
export async function getNoticeByVersion(version: string): Promise<PublishedNotice | null> {
  const notice = await prisma.privacyNotice.findUnique({
    where: { version },
    select: NOTICE_FIELDS,
  });

  if (!notice || notice.status === 'DRAFT') return null;
  return notice;
}

/** Every version, newest first. Drafts included — this feeds the admin screen. */
export async function listNotices() {
  return prisma.privacyNotice.findMany({
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: { ...NOTICE_FIELDS, publishedById: true, createdAt: true, updatedAt: true },
  });
}

/**
 * The version label to stamp on a consent record written right now.
 *
 * Falls back to `PRIVACY_NOTICE_VERSION` only so that a database whose notice
 * row is somehow missing still produces a stable, greppable label rather than
 * an empty string. The fallback is not a licence to record consent without a
 * document — see `requirePublishedVersionForConsent()`.
 */
export async function resolveNoticeVersion(): Promise<string> {
  const published = await getPublishedNotice();
  return published?.version ?? PRIVACY_NOTICE_VERSION;
}

/**
 * The version to stamp on a **grant**, or a refusal explaining why not.
 *
 * Fails closed. A grant recorded against a version that resolves to nothing is
 * unprovable consent, which is the defect Phase 8 exists to remove — so it is
 * refused rather than written and discovered later by an auditor.
 */
export async function requirePublishedVersionForConsent(): Promise<
  { ok: true; version: string } | { ok: false; reason: string }
> {
  const published = await getPublishedNotice();

  if (!published) {
    return {
      ok: false,
      reason:
        'No privacy notice is published, so we cannot record what you were shown when you ' +
        'agreed. Consent that cannot be produced on demand is not consent, so we will not ' +
        'record it. Withdrawing a consent still works.',
    };
  }

  return { ok: true, version: published.version };
}

/** Does a stored consent record still point at a document that exists? */
export async function noticeVersionResolves(version: string): Promise<boolean> {
  return (await prisma.privacyNotice.count({ where: { version } })) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A version label people will type into a URL and quote in a dispute.
 *
 * Constrained to dates and simple suffixes (`2026-08-03`, `2026-08-03-b`) so a
 * label cannot smuggle a path segment, and so the register sorts and reads the
 * way a filing system does.
 */
export const NOTICE_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,8})?$/;

export function assertVersionLabel(version: string): { ok: true } | { ok: false; reason: string } {
  if (!NOTICE_VERSION_PATTERN.test(version)) {
    return {
      ok: false,
      reason:
        'A version label must look like 2026-08-03, optionally with a short suffix ' +
        '(2026-08-03-b) when more than one version is published on the same day.',
    };
  }
  return { ok: true };
}

/**
 * May this row's text be changed?
 *
 * Only a DRAFT. Editing a PUBLISHED or SUPERSEDED version would rewrite the
 * document that existing consent records point at — silently, with no error,
 * destroying the evidence it exists to provide.
 */
export function assertEditable(status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED'):
  | { ok: true }
  | { ok: false; reason: string } {
  if (status === 'DRAFT') return { ok: true };

  return {
    ok: false,
    reason:
      `This version is ${status} and cannot be edited. People agreed to these exact words, ` +
      'and consent records point at them. To change the notice, create a new version and ' +
      'publish it - the old one stays readable at its own address.',
  };
}

/**
 * Publish a draft.
 *
 * One transaction, in this order: supersede whatever is in force, then promote
 * this row. The invariant that **at most one version is PUBLISHED** is held
 * here rather than by a partial unique index, because Prisma cannot express one
 * and a raw index would show up forever as schema drift. `check:pdpa` asserts
 * the invariant after publishing twice, which is the property that actually
 * matters.
 */
export async function publishNotice(params: {
  id: string;
  actorUserId: string;
}): Promise<{ ok: true; version: string } | { ok: false; reason: string }> {
  const draft = await prisma.privacyNotice.findUnique({
    where: { id: params.id },
    select: { id: true, version: true, status: true, body: true },
  });

  if (!draft) return { ok: false, reason: 'That version does not exist.' };

  if (draft.status !== 'DRAFT') {
    return {
      ok: false,
      reason: `That version is already ${draft.status}. Publishing it again would change nothing.`,
    };
  }

  if (draft.body.trim().length < 200) {
    return {
      ok: false,
      reason:
        'This draft is too short to be a privacy notice. Publishing it would replace a real ' +
        'document with a placeholder for everyone who reads it.',
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.privacyNotice.updateMany({
      where: { status: 'PUBLISHED' },
      data: { status: 'SUPERSEDED' },
    });

    await tx.privacyNotice.update({
      where: { id: params.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: params.actorUserId,
      },
    });
  });

  return { ok: true, version: draft.version };
}
