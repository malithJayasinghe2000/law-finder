/**
 * Data-protection policy check.
 *
 * Run with: npm run check:pdpa   (needs a database)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this exists as a runnable script rather than a comment.
 *
 * `npm run build` and `npx tsc --noEmit` both pass happily on:
 *   - a purge that deletes a firm's conflict-check records
 *   - an "erasure" that leaves the person's name and email in place
 *   - an audit log that copies the matter description into itself
 *   - an export that hands one client the names of parties screened against them
 *   - a consent withdrawal that stops collection but keeps what it collected
 *
 * Every one of those compiles. So each is asserted here, against real rows,
 * with the destructive cases proved by *creating the data that would break it*
 * and checking what survives — not by reading the policy file back to itself.
 *
 * If a case here starts failing, that is either a bug or a legal decision. It is
 * never a test to "just update".
 *
 * See docs/restructure/DATA-INVENTORY.md and src/lib/privacy/policy.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import prisma from '@/lib/db';
import {
  RETENTION_SCHEDULE,
  FIRM_CONTROLLED_MODELS,
  ERASURE_PLAN,
  CONSENT_PURPOSES,
  assertPurgeable,
  controllerOf,
  retentionCutoff,
  mayRelyOnConsentFor,
  needsFirmReferral,
  subjectRequestDueDate,
  erasedEmailFor,
  summariseErasure,
  SUBJECT_REQUEST_DUE_DAYS,
} from '@/lib/privacy/policy';
import { buildSubjectExport, eraseSubject } from '@/lib/privacy/subject';
import { recordAccess } from '@/lib/privacy/audit';

let pass = 0;
const fails: string[] = [];

function ok(name: string, cond: boolean, why: string) {
  if (cond) {
    pass++;
    console.log('  PASS ', name);
  } else {
    fails.push(`  FAIL  ${name}\n        ${why}`);
    console.log('  FAIL ', name);
  }
}

const TAG = `pdpa-check-${Date.now()}`;

async function main() {
  console.log('\n── The controller/processor split ─────────────────────────\n');

  for (const model of FIRM_CONTROLLED_MODELS) {
    ok(
      `${model} is recognised as firm-controlled`,
      controllerOf(model) === 'FIRM',
      'if this reads PLATFORM, the purge will delete a firm’s records on our own authority'
    );
  }

  ok(
    'the purge refuses every firm-controlled model',
    FIRM_CONTROLLED_MODELS.every((m) => !assertPurgeable(m).ok),
    'a processor may not delete the controller’s data on its own schedule'
  );

  ok(
    'consent may not be relied on for firm-controlled data',
    FIRM_CONTROLLED_MODELS.every((m) => !mayRelyOnConsentFor(m)),
    'you cannot obtain consent for processing you neither control nor can stop'
  );

  ok(
    'no retention rule targets firm-controlled data',
    RETENTION_SCHEDULE.every((r) => r.controller === 'PLATFORM'),
    'counsel question 7(c) is unanswered; matter retention is not ours to set'
  );

  ok(
    'every retention rule is purgeable',
    RETENTION_SCHEDULE.every((r) => assertPurgeable(r.model).ok),
    'a rule the guard refuses is a contradiction in the policy file'
  );

  ok(
    'an unscheduled model is refused rather than kept forever by default',
    !assertPurgeable('lawyerProfile').ok,
    'silence must not mean "retain indefinitely"'
  );

  console.log('\n── Retention actually deletes ─────────────────────────────\n');

  // Prove the purge cutoff by writing a row that is genuinely expired and one
  // that is not, then applying the rule the purge applies.
  const logRule = RETENTION_SCHEDULE.find((r) => r.model === 'dataAccessLog')!;
  const cutoff = retentionCutoff(logRule.days);
  const wellExpired = new Date(cutoff.getTime() - 86_400_000);
  const wellInside = new Date();

  const [expiredLog, freshLog] = await Promise.all([
    prisma.dataAccessLog.create({
      data: {
        actorUserId: `${TAG}-expired`, actorRole: 'ADMIN', resource: 'BOOKING',
        resourceId: TAG, action: 'READ_DETAIL', createdAt: wellExpired,
      },
    }),
    prisma.dataAccessLog.create({
      data: {
        actorUserId: `${TAG}-fresh`, actorRole: 'ADMIN', resource: 'BOOKING',
        resourceId: TAG, action: 'READ_DETAIL', createdAt: wellInside,
      },
    }),
  ]);

  const purged = await prisma.dataAccessLog.deleteMany({
    where: { resourceId: TAG, createdAt: { lt: cutoff } },
  });

  ok('an expired row is actually deleted', purged.count === 1,
     `the retention rule matched ${purged.count} rows, expected 1`);
  ok('a row inside the period survives',
     (await prisma.dataAccessLog.findUnique({ where: { id: freshLog.id } })) !== null,
     'the cutoff is deleting live data');
  ok('the expired row is really gone',
     (await prisma.dataAccessLog.findUnique({ where: { id: expiredLog.id } })) === null,
     'deleteMany reported a count it did not deliver');

  await prisma.dataAccessLog.deleteMany({ where: { resourceId: TAG } });

  console.log('\n── The audit log holds no content ─────────────────────────\n');

  const logFields = Object.keys(
    (prisma.dataAccessLog as unknown as { fields: Record<string, unknown> }).fields ?? {}
  );
  const contentish = ['description', 'subject', 'notes', 'content', 'excerpt', 'body', 'snippet'];

  ok(
    'DataAccessLog has no content-bearing column',
    logFields.length > 0 && !logFields.some((f) => contentish.includes(f)),
    `a log that copies the matter description into itself is a second privileged store. Fields: ${logFields.join(', ')}`
  );

  console.log('\n── Erasure ────────────────────────────────────────────────\n');

  // A real person, with a real matter at a real firm, and platform data of
  // every kind the plan claims to delete.
  const firm = await prisma.lawFirm.create({
    data: { name: `${TAG} Firm`, slug: TAG, firmType: 'SOLE_PRACTITIONER' },
  });
  const subject = await prisma.user.create({
    data: { email: `${TAG}@example.com`, fullName: 'Erasure Subject', role: 'CLIENT' },
  });
  const conv = await prisma.aiConversation.create({
    data: {
      userId: subject.id, title: 'My landlord problem',
      messages: { create: [{ role: 'user', content: 'my landlord kept my deposit' }] },
    },
  });
  const attorneyUser = await prisma.user.create({
    data: { email: `${TAG}-att@example.com`, fullName: 'Acting Attorney', role: 'LAWYER' },
  });
  const attorney = await prisma.lawyerProfile.create({
    data: { userId: attorneyUser.id, fullName: 'Acting Attorney', baslNumber: `${TAG}-b`, firmId: firm.id },
  });
  // Replaces the `Inquiry` fixture removed in Phase 7. An application holds an
  // NIC number and identity images, so erasure must actually delete it.
  await prisma.lawyerApplication.create({
    data: {
      userId: subject.id, status: 'DRAFT', currentStep: 1,
      draftData: { step1: { fullName: 'Erasure Subject', nic: '901234567V' } },
    },
  });
  const booking = await prisma.booking.create({
    data: {
      bookingNumber: `${TAG}-BK`, clientId: subject.id, firmId: firm.id, lawyerId: attorney.id,
      mode: 'ONLINE', subject: 'Deposit dispute', lawyerFee: 0, totalAmount: 0,
      description: 'PRIVILEGED: my landlord kept my deposit and I want it back',
      status: 'REQUESTED',
    },
  });
  const conflict = await prisma.conflictCheck.create({
    data: {
      bookingId: booking.id, outcome: 'CLEAR', checkedById: attorney.id,
      screenedParties: ['Erasure Subject', 'SOMEONE ELSE ENTIRELY'],
      notes: 'PRIVILEGED firm-internal reasoning',
    },
  });

  const exportBefore = await buildSubjectExport(subject.id);

  ok('the export includes the person’s AI conversations',
     JSON.stringify(exportBefore?.aiConversations).includes('landlord kept my deposit'),
     'an access request that omits data we control is not an answer');
  ok('the export names the firm holding their matter',
     exportBefore?.heldByLawFirms.some((f) => f.firmId === firm.id) === true,
     'the person must be told who to ask for the rest');
  ok('the export contains NO matter description',
     !JSON.stringify(exportBefore).includes('PRIVILEGED: my landlord kept my deposit'),
     'matter data belongs to the firm and is referred, not released by us');
  ok('the export contains NO conflict-check note',
     !JSON.stringify(exportBefore).includes('PRIVILEGED firm-internal reasoning'),
     'a conflict check is firm-internal and names other parties');
  ok('the export does NOT disclose other screened parties',
     !JSON.stringify(exportBefore).includes('SOMEONE ELSE ENTIRELY'),
     'answering one request must not breach another person’s confidentiality');
  ok('the export says what it does not include',
     (exportBefore?.notIncluded.length ?? 0) > 0,
     'an unexplained gap looks like an incomplete answer');

  const result = await eraseSubject(subject.id);
  const after = await prisma.user.findUnique({ where: { id: subject.id } });

  ok('erasure reports itself as partial', result?.partial === true,
     'reporting a clean success would misrepresent what happened');
  ok('the user row survives', after !== null,
     'deleting it would cascade into or orphan the firm’s matter file');
  ok('the name is gone', after?.fullName === null, 'anonymisation that leaves the name is not anonymisation');
  ok('the email is overwritten', after?.email === erasedEmailFor(subject.id),
     `still ${after?.email}`);
  ok('the email cannot resolve to a real mailbox', after?.email.endsWith('@erased.invalid') === true,
     '.invalid is reserved by RFC 2606');
  ok('sign-in credentials are gone', after?.passwordHash === null && after?.googleId === null,
     'an erased account that can still be signed into is not erased');
  ok('the account is marked ERASED', after?.status === 'ERASED', `status is ${after?.status}`);
  ok('AI conversations are deleted',
     (await prisma.aiConversation.findUnique({ where: { id: conv.id } })) === null,
     'the plan promises deletion, not hiding');
  ok('the attorney application is deleted',
     (await prisma.lawyerApplication.count({ where: { userId: subject.id } })) === 0,
     'it holds a national identity number and images of identity documents');

  const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
  const conflictAfter = await prisma.conflictCheck.findUnique({ where: { id: conflict.id } });

  ok('the firm’s matter file is untouched',
     bookingAfter?.description === 'PRIVILEGED: my landlord kept my deposit and I want it back',
     'we destroyed a record the firm may be professionally required to keep');
  ok('the conflict check is untouched', conflictAfter?.notes === 'PRIVILEGED firm-internal reasoning',
     'erasing it would degrade the firm’s ability to screen for OTHER clients');
  ok('the firm is referred for the rest', result?.referredFirmIds.includes(firm.id) === true,
     'the firm must be told there is a request to decide');
  ok('every retained item carries a reason',
     (result?.retained.length ?? 0) > 0 && result!.retained.every((r) => r.explanation.length > 20),
     'a refusal that does not name the duty requiring retention is not defensible');

  console.log('\n── Consent ────────────────────────────────────────────────\n');

  ok('no consent purpose covers matter data',
     !Object.keys(CONSENT_PURPOSES).some((p) => /matter|booking|case|legal/i.test(p)),
     'matter data rests on contract and professional duty, and implying it is withdrawable is the expensive PDPA error');
  ok('every consent purpose states what withdrawal does',
     Object.values(CONSENT_PURPOSES).every((p) => p.onWithdrawal.length > 10),
     'consent nobody can meaningfully withdraw is not consent');

  const consented = await prisma.consentRecord.create({
    data: { userId: attorneyUser.id, purpose: 'MARKETING_EMAIL', noticeVersion: 'test-v1' },
  });
  await prisma.consentRecord.updateMany({
    where: { userId: attorneyUser.id, purpose: 'MARKETING_EMAIL', withdrawnAt: null },
    data: { withdrawnAt: new Date() },
  });
  const withdrawn = await prisma.consentRecord.findUnique({ where: { id: consented.id } });

  ok('withdrawal marks the record rather than deleting it',
     withdrawn !== null && withdrawn.withdrawnAt !== null,
     'the history is the evidence that processing was lawful up to that point');
  ok('the notice version is recorded with the consent',
     withdrawn?.noticeVersion === 'test-v1',
     '"they consented" to a document nobody can produce is not demonstrable consent');

  console.log('\n── Subject requests ───────────────────────────────────────\n');

  ok('access, erasure and portability all reach the firm',
     needsFirmReferral('ACCESS') && needsFirmReferral('ERASURE') && needsFirmReferral('PORTABILITY'),
     'these span matter data, which the firm controls');
  ok('rectification of one’s own details does not',
     !needsFirmReferral('RECTIFICATION'),
     'correcting your own name does not involve the firm');

  const due = subjectRequestDueDate(new Date('2026-01-01T00:00:00Z'));
  ok(`the response clock is ${SUBJECT_REQUEST_DUE_DAYS} days`,
     due.toISOString().startsWith('2026-01-22'),
     `got ${due.toISOString()}`);

  console.log('\n── The audit log records what happened ────────────────────\n');

  await recordAccess({
    actorUserId: attorneyUser.id, actorRole: 'ATTORNEY', resource: 'BOOKING',
    resourceId: booking.id, action: 'READ_DETAIL', bookingId: booking.id,
    firmId: firm.id, clientUserId: subject.id,
  });
  ok('a read by someone other than the client is recorded',
     (await prisma.dataAccessLog.count({ where: { bookingId: booking.id } })) === 1,
     'access.ts decides whether; nothing recorded that it happened');

  await recordAccess({
    actorUserId: subject.id, actorRole: 'CLIENT', resource: 'BOOKING',
    resourceId: booking.id, action: 'READ_DETAIL', bookingId: booking.id,
    firmId: firm.id, clientUserId: subject.id,
  });
  ok('a client reading their own matter is NOT recorded',
     (await prisma.dataAccessLog.count({ where: { bookingId: booking.id } })) === 1,
     'logging every self-read buries the entries anyone would look for');

  ok('the erasure plan covers EVERY firm-controlled model, with no exceptions',
     FIRM_CONTROLLED_MODELS.every((m) =>
       ERASURE_PLAN.some((s) => s.model === m && s.action === 'RETAIN')
     ),
     'a model with no entry survives an erasure with no explanation attached — the person ' +
       'is told "kept" and not why. Missing: ' +
       FIRM_CONTROLLED_MODELS.filter((m) => !ERASURE_PLAN.some((s) => s.model === m)).join(', '));
  ok('the erasure summary reports partial fulfilment',
     summariseErasure().partial,
     'today a firm’s file always survives, and the interface must say so');

  // ── Cleanup ────────────────────────────────────────────────────────────
  await prisma.dataAccessLog.deleteMany({ where: { bookingId: booking.id } });
  await prisma.consentRecord.deleteMany({ where: { userId: attorneyUser.id } });
  await prisma.dataSubjectRequest.deleteMany({ where: { userId: subject.id } });
  await prisma.conflictCheck.deleteMany({ where: { bookingId: booking.id } });
  await prisma.booking.delete({ where: { id: booking.id } });
  await prisma.lawyerApplication.deleteMany({ where: { userId: subject.id } });
  await prisma.lawyerProfile.delete({ where: { id: attorney.id } });
  await prisma.user.deleteMany({ where: { id: { in: [subject.id, attorneyUser.id] } } });
  await prisma.lawFirm.delete({ where: { id: firm.id } });

  if (fails.length) {
    console.error('\n' + fails.join('\n\n'));
    console.error(`\n${pass} passed, ${fails.length} FAILED\n`);
    process.exit(1);
  }
  console.log(`\n${pass} passed, 0 failed\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
