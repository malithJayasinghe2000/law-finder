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
  PRIVACY_NOTICE_VERSION,
} from '@/lib/privacy/policy';
import { buildSubjectExport, eraseSubject } from '@/lib/privacy/subject';
import { recordAccess } from '@/lib/privacy/audit';
import {
  getPublishedNotice,
  getNoticeByVersion,
  publishNotice,
  assertEditable,
  assertVersionLabel,
  requirePublishedVersionForConsent,
  resolveNoticeVersion,
} from '@/lib/privacy/notice';
import { recordFirmResponse, assertFirmReason } from '@/lib/privacy/firmResponse';
import { isOutcomeAllowed } from '@/lib/privacy/firmOutcomes';

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

  // ── The privacy notice register (Phase 8) ──────────────────────────────
  //
  // The defect this exists to prevent: an administrator edits the notice in
  // place, and every past consent record silently starts pointing at wording
  // nobody agreed to. Nothing errors. The evidence is destroyed by an ordinary
  // content edit, and you find out when somebody asks you to prove consent.

  ok('a consent record’s notice version resolves to a document that exists',
     (await getNoticeByVersion(PRIVACY_NOTICE_VERSION)) !== null,
     `nothing is published under ${PRIVACY_NOTICE_VERSION}, so every consent record written ` +
       'under it points at wording nobody can produce — which is not demonstrable consent. ' +
       'The migration that created the register seeds this document for exactly this reason');

  ok('a PUBLISHED version cannot be edited',
     !assertEditable('PUBLISHED').ok,
     'editing the document people agreed to rewrites the evidence silently');
  ok('a SUPERSEDED version cannot be edited',
     !assertEditable('SUPERSEDED').ok,
     'a superseded version is still pointed at by the consent records written under it');
  ok('a DRAFT can be edited',
     assertEditable('DRAFT').ok,
     'nobody has agreed to a draft, so there is no evidence to protect — and a register you ' +
       'cannot write in is not usable');

  ok('a version label cannot smuggle a path segment',
     !assertVersionLabel('../../etc/passwd').ok && !assertVersionLabel('2026-08-03/x').ok,
     'the label is put into a public URL; a label that is not a label is a traversal');
  ok('a normal and a suffixed version label are accepted',
     assertVersionLabel('2026-08-03').ok && assertVersionLabel('2026-08-03-b').ok,
     'publishing twice in one day must be expressible, or somebody will reuse a label');

  // Everything from here to the matching `finally` mutates the live register:
  // it publishes a scratch version, which supersedes whatever is in force. On
  // the happy path it is put back below — but a check that leaves the database
  // with NO published notice if it throws would turn a failed assertion into a
  // broken dev environment, where consent grants then fail closed for everyone.
  const restorePoint = await getPublishedNotice();
  try {

  const draftA = await prisma.privacyNotice.create({
    data: {
      version: `2999-01-01-${TAG.slice(-6)}`,
      title: 'Privacy Notice (check)',
      body: 'x'.repeat(400),
      status: 'DRAFT',
    },
  });

  const before = await getPublishedNotice();
  const publishedA = await publishNotice({ id: draftA.id, actorUserId: subject.id });

  ok('publishing a draft promotes it and supersedes the old version',
     publishedA.ok &&
       (await prisma.privacyNotice.count({ where: { status: 'PUBLISHED' } })) === 1,
     'at most one version is ever in force; two would make "the current notice" ambiguous');

  ok('the superseded version still exists and is still readable at its own URL',
     before !== null && (await getNoticeByVersion(before.version)) !== null,
     'consent records point at it. Evidence you can take off the shelf is not evidence');

  ok('the superseded version is marked SUPERSEDED, not deleted',
     before !== null &&
       (await prisma.privacyNotice.findUnique({ where: { version: before.version } }))?.status ===
         'SUPERSEDED',
     'a version that vanishes takes the proof of what people agreed to with it');

  ok('the version stamped on a new consent is the one now in force',
     (await resolveNoticeVersion()) === draftA.version,
     'PRIVACY_NOTICE_VERSION is no longer "the current version" — it is a lookup, or the ' +
       'constant and the register drift apart');

  ok('publishing an already-published version is refused',
     !(await publishNotice({ id: draftA.id, actorUserId: subject.id })).ok,
     'republishing would supersede the version currently in force with itself');

  const stub = await prisma.privacyNotice.create({
    data: { version: `2999-01-02-${TAG.slice(-6)}`, body: 'too short', status: 'DRAFT' },
  });
  ok('a placeholder-length draft cannot be published',
     !(await publishNotice({ id: stub.id, actorUserId: subject.id })).ok,
     'publishing a stub replaces a real notice with a placeholder for every reader');
  await prisma.privacyNotice.delete({ where: { id: stub.id } });

  // The `finally` below is the single restore path — see the comment there.

  ok('a grant is refused when no notice is published, and the reason says why',
     await (async () => {
       await prisma.privacyNotice.updateMany({
         where: { status: 'PUBLISHED' },
         data: { status: 'SUPERSEDED' },
       });
       const refused = await requirePublishedVersionForConsent();
       if (before) {
         await prisma.privacyNotice.update({
           where: { id: before.id },
           data: { status: 'PUBLISHED' },
         });
       }
       return !refused.ok;
     })(),
     'recording agreement to a document that cannot be produced recreates the exact defect ' +
       'the register exists to remove — and doing it silently is worse than an error');

  } finally {
    // Put the register back exactly as it was found, whatever happened above.
    await prisma.privacyNotice.deleteMany({ where: { version: { startsWith: '2999-' } } });
    if (restorePoint) {
      await prisma.privacyNotice.updateMany({
        where: { status: 'PUBLISHED' },
        data: { status: 'SUPERSEDED' },
      });
      await prisma.privacyNotice.update({
        where: { id: restorePoint.id },
        data: { status: 'PUBLISHED' },
      });
    }
  }

  // ── A firm answering the half of a request that is its own ─────────────

  // A real second practice: this person engaged two firms, which is the shape
  // that breaks a design where the first firm to answer closes the request.
  const secondPractice = await prisma.lawFirm.create({
    data: { name: `${TAG} Second Firm`, slug: `${TAG}-2`, firmType: 'SOLE_PRACTITIONER' },
  });

  const dsr = await prisma.dataSubjectRequest.create({
    data: {
      userId: subject.id,
      type: 'ERASURE',
      status: 'AWAITING_FIRM',
      referredFirmIds: [firm.id, secondPractice.id],
      dueBy: subjectRequestDueDate(),
    },
  });

  ok('a firm cannot answer a request that was not referred to it',
     !(await recordFirmResponse({
       requestId: dsr.id,
       firmId: 'a-firm-this-request-never-went-to',
       outcome: 'NO_DATA',
       reason: 'We hold nothing at all for this person.',
       respondedById: attorneyUser.id,
     })).ok,
     'otherwise any firm could write onto any person’s request — and would learn it exists');

  ok('an outcome with a one-word reason is refused',
     !assertFirmReason('REFUSED_RETAINED', 'no').ok,
     'a refusal that does not name the duty is not a defensible refusal, and the person is ' +
       'shown these words verbatim');

  const firstFirm = await recordFirmResponse({
    requestId: dsr.id,
    firmId: firm.id,
    outcome: 'REFUSED_RETAINED',
    reason: 'We must retain the file under our professional record-keeping obligations.',
    respondedById: attorneyUser.id,
  });

  ok('one firm answering does NOT close a request referred to two',
     firstFirm.ok &&
       firstFirm.allFirmsResponded === false &&
       (await prisma.dataSubjectRequest.findUnique({ where: { id: dsr.id } }))?.status ===
         'AWAITING_FIRM',
     'the second firm’s client would be told their matter had been dealt with by a practice ' +
       'that never looked at it');

  const secondFirm = await recordFirmResponse({
    requestId: dsr.id,
    firmId: secondPractice.id,
    outcome: 'NO_DATA',
    reason: 'We do not hold a matter for this person at this practice.',
    respondedById: attorneyUser.id,
  });

  ok('a request closes as PARTIALLY_FULFILLED when any firm retained the file',
     secondFirm.ok &&
       secondFirm.allFirmsResponded === true &&
       (await prisma.dataSubjectRequest.findUnique({ where: { id: dsr.id } }))?.status ===
         'PARTIALLY_FULFILLED',
     'a clean COMPLETED over a firm that is still holding the file is a false answer to a ' +
       'statutory request');

  // "Erased" used to be the correction here. It is no longer an answer a firm can
  // give (firmOutcomes.ts), so the correction is to a different allowed outcome —
  // and the outcome is checked, or a refused correction would pass this vacuously.
  ok('a firm re-deciding corrects its own row rather than adding a second answer',
     await (async () => {
       const corrected = await recordFirmResponse({
         requestId: dsr.id,
         firmId: firm.id,
         outcome: 'NO_DATA',
         reason: 'On review this practice holds no matter for this person after all.',
         respondedById: attorneyUser.id,
       });
       const rows = await prisma.subjectRequestFirmResponse.findMany({
         where: { requestId: dsr.id, firmId: firm.id },
       });
       return corrected.ok && rows.length === 1 && rows[0].outcome === 'NO_DATA';
     })(),
     'two answers to one question from one firm leaves nobody able to say what it decided');

  // ── The answer has to fit the question ─────────────────────────────────
  ok('a firm cannot answer "erased" to a deletion request',
     !(await recordFirmResponse({
       requestId: dsr.id,
       firmId: firm.id,
       outcome: 'ERASED',
       reason: 'We deleted the whole matter file for this person.',
       respondedById: attorneyUser.id,
     })).ok,
     'there is no tool for a firm to delete a matter here, so the person would be told their ' +
       'file was gone while we still held it');

  ok('"erased" is offered for no request type',
     !['ACCESS', 'PORTABILITY', 'ERASURE'].some((t) => isOutcomeAllowed(t, 'ERASED')),
     'the same false answer, from any direction');

  ok('a deletion request cannot be answered "gave them a copy"',
     !isOutcomeAllowed('ERASURE', 'RELEASED'),
     'the answer has to be to the question asked');

  // The general forms must still be answerable — a rule that refuses every
  // answer is as broken as one that accepts every answer.
  ok('a deletion request CAN be answered "kept — a duty requires it"',
     isOutcomeAllowed('ERASURE', 'REFUSED_RETAINED'),
     'retention duties are the normal reason a firm keeps a file');

  ok('a copy request CAN be answered "gave them a copy" or "we hold nothing"',
     isOutcomeAllowed('ACCESS', 'RELEASED') && isOutcomeAllowed('PORTABILITY', 'NO_DATA'),
     'otherwise a firm could never fulfil an access request');

  ok('a firm response holds no matter content column',
     !Object.keys(
       (await prisma.subjectRequestFirmResponse.findFirst({ where: { requestId: dsr.id } })) ?? {}
     ).some((k) => ['description', 'content', 'notes', 'matterDetail'].includes(k)),
     'the same rule as DataAccessLog: a second store of privileged material with different ' +
       'access rules and a different retention period');

  await prisma.subjectRequestFirmResponse.deleteMany({ where: { requestId: dsr.id } });
  await prisma.dataSubjectRequest.delete({ where: { id: dsr.id } });
  await prisma.lawFirm.delete({ where: { id: secondPractice.id } });

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
