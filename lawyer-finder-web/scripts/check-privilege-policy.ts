/**
 * Privilege policy check.
 *
 * Run with: npm run check:privilege
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this exists as a runnable script rather than a comment.
 *
 * `npm run build` and `npx tsc --noEmit` both pass happily on a version of
 * src/lib/firms/access.ts that lets a paralegal read a client's account of their
 * legal problem. A green build proves the code compiles, not that it protects
 * anything. This is the one rule in the codebase where being wrong exposes real
 * attorneys — and their clients — so it gets an assertion rather than a promise.
 *
 * Run it after ANY change to src/lib/firms/access.ts. If a case here starts
 * failing, that is either a bug or a legal decision; it is never a test to
 * "just update".
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rule 5) and counsel question 8(b).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  resolveMatterAccess,
  redactMatter,
  type FirmMembership,
} from '../src/lib/firms/access';
import type { FirmRole } from '@prisma/client';

const MATTER = {
  lawyerId: 'profile-A',
  firmId: 'firm-1',
  clientId: 'client-1',
};

const membership = (
  role: FirmRole,
  firmId = 'firm-1',
  profileId: string | null = null
): FirmMembership => ({
  firmId,
  firmName: 'Test & Co, Attorneys-at-Law',
  role,
  profileId,
  isSoloPractice: false,
});

type Case = {
  who: string;
  actor: Parameters<typeof resolveMatterAccess>[0];
  expect: { read: boolean; detail: boolean; act: boolean; assign: boolean };
  /** Why the expectation is what it is. */
  because: string;
};

const CASES: Case[] = [
  {
    who: 'The client whose matter it is',
    actor: { actorUserId: 'client-1', actorRole: 'CLIENT', membership: null, matter: MATTER },
    expect: { read: true, detail: true, act: false, assign: false },
    because: 'They wrote it. They cannot act on the engagement — that is the firm\'s side.',
  },
  {
    who: 'Platform ADMIN',
    actor: { actorUserId: 'staff-1', actorRole: 'ADMIN', membership: null, matter: MATTER },
    expect: { read: true, detail: false, act: false, assign: false },
    because:
      'Evidence Ordinance s.126 — a third party who can read privileged material can be used to argue privilege was waived. Support can see a matter exists, never what it says.',
  },
  {
    who: 'The attorney the matter is assigned to',
    actor: {
      actorUserId: 'u-A', actorRole: 'LAWYER', actorProfileId: 'profile-A',
      membership: membership('ATTORNEY', 'firm-1', 'profile-A'), matter: MATTER,
    },
    expect: { read: true, detail: true, act: true, assign: false },
    because: 'They are doing the work. They do not reassign — that is the principal\'s call.',
  },
  {
    who: 'The firm\'s principal, matter assigned to someone else',
    actor: {
      actorUserId: 'u-O', actorRole: 'LAWYER', actorProfileId: 'profile-O',
      membership: membership('FIRM_OWNER'), matter: MATTER,
    },
    expect: { read: true, detail: true, act: false, assign: true },
    because:
      'Someone must be able to move a matter when an attorney is ill, leaves, or hits a conflict — but quoting and conflict-checking belong to whoever will do the work.',
  },
  {
    who: 'Practice manager (FIRM_ADMIN, not an attorney)',
    actor: {
      actorUserId: 'u-M', actorRole: 'LAWYER', actorProfileId: null,
      membership: membership('FIRM_ADMIN'), matter: MATTER,
    },
    expect: { read: true, detail: true, act: false, assign: true },
    because:
      'Runs the diary and the queue, so needs the matter. Whether a non-attorney may see matter detail at all is counsel question 8(b) — if the answer is no, THIS is the case that must change.',
  },
  {
    who: 'A different attorney at the same firm',
    actor: {
      actorUserId: 'u-B', actorRole: 'LAWYER', actorProfileId: 'profile-B',
      membership: membership('ATTORNEY', 'firm-1', 'profile-B'), matter: MATTER,
    },
    expect: { read: true, detail: false, act: false, assign: false },
    because:
      'Being in the same firm is not a reason to read a colleague\'s client\'s problem. Access is need-based and minimal.',
  },
  {
    who: 'A paralegal at the same firm',
    actor: {
      actorUserId: 'u-P', actorRole: 'LAWYER', actorProfileId: null,
      membership: membership('PARALEGAL'), matter: MATTER,
    },
    expect: { read: true, detail: false, act: false, assign: false },
    because: 'Can see that an appointment exists. Never what it concerns.',
  },
  {
    who: 'An attorney at a DIFFERENT firm',
    actor: {
      actorUserId: 'u-X', actorRole: 'LAWYER', actorProfileId: 'profile-X',
      membership: membership('FIRM_OWNER', 'firm-2', 'profile-X'), matter: MATTER,
    },
    expect: { read: false, detail: false, act: false, assign: false },
    because: 'A matter never crosses firms. Nothing about it leaks to another practice.',
  },
  {
    who: 'A lawyer belonging to no firm',
    actor: {
      actorUserId: 'u-Z', actorRole: 'LAWYER', actorProfileId: 'profile-Z',
      membership: null, matter: MATTER,
    },
    expect: { read: false, detail: false, act: false, assign: false },
    because: 'No membership, no route in.',
  },
];

let passed = 0;
const failures: string[] = [];

console.log('\nPrivilege policy — who may read a client\'s legal problem\n');

for (const c of CASES) {
  const a = resolveMatterAccess(c.actor);
  const ok =
    a.canRead === c.expect.read &&
    a.canReadMatterDetail === c.expect.detail &&
    a.canAct === c.expect.act &&
    a.canAssign === c.expect.assign;

  if (ok) {
    passed++;
    console.log(`  PASS  ${c.who}`);
  } else {
    failures.push(
      `  FAIL  ${c.who}\n` +
        `        expected read=${c.expect.read} detail=${c.expect.detail} act=${c.expect.act} assign=${c.expect.assign}\n` +
        `        actual   read=${a.canRead} detail=${a.canReadMatterDetail} act=${a.canAct} assign=${a.canAssign}\n` +
        `        why it matters: ${c.because}`
    );
    console.log(`  FAIL  ${c.who}`);
  }
}

// Redaction must actually blank the fields, not merely be called.
const redacted = redactMatter(
  { subject: 'Land dispute', description: 'My neighbour has...', lawyerNotes: 'internal' },
  resolveMatterAccess({
    actorUserId: 'staff-1',
    actorRole: 'ADMIN',
    membership: null,
    matter: MATTER,
  })
);

if (
  redacted.subject?.includes('Withheld') &&
  redacted.description?.includes('Withheld') &&
  redacted.lawyerNotes === null
) {
  passed++;
  console.log('  PASS  redactMatter blanks subject, description and notes');
} else {
  failures.push('  FAIL  redactMatter did not blank the privileged fields');
  console.log('  FAIL  redactMatter blanks subject, description and notes');
}

if (failures.length) {
  console.error('\n' + failures.join('\n\n'));
  console.error(`\n${passed} passed, ${failures.length} FAILED\n`);
  process.exit(1);
}

console.log(`\n${passed} passed, 0 failed\n`);
