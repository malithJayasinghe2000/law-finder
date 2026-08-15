/**
 * Firm onboarding check.
 *
 * Run with: npm run check:firm
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this exists as a runnable script.
 *
 * `npm run build` and `npx tsc --noEmit` both pass happily on a version of
 * src/lib/firms/invitations.ts that lets an unverified attorney become a
 * partner, or that moves an attorney between practices while they still hold
 * a client's live matter. Neither is a type error; both are professional-conduct
 * problems.
 *
 * The second is the one worth understanding. A client engages a FIRM — that is
 * the party to the retainer (guardrail rule 7). Letting an attorney carry their
 * matters into a different practice would change who the client is retained by
 * without telling them. So the rule is: close or hand over first.
 *
 * Builds its own fixtures against a real database and cleans up after itself, so
 * it can run twice in a row. That is deliberate — Phase 6 shipped a check that
 * could not run on the database its own documentation told you to seed.
 *
 * See docs/restructure/HOW-IT-WORKS.md Part 1 and LEGAL-GUARDRAILS.md.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import prisma from '../src/lib/db';
import {
  checkJoinEligibility,
  admitMemberToFirm,
  invitationExpiry,
  newInvitationToken,
  expireStaleInvitations,
} from '../src/lib/firms/invitations';

const TAG = `chk-firm-${Date.now()}`;
const results: [string, boolean, string][] = [];
const ok = (label: string, cond: boolean, why = '') => results.push([label, cond, why]);

console.log('\nFirm onboarding — who may join a practice, and on what terms\n');

(async () => {
  // Two firms, so "moving practice" is expressible.
  const mk = async (name: string) => prisma.lawFirm.create({
    data: { slug: `${TAG}-${name}`, name: `${TAG} ${name}`, firmType: 'SOLE_PRACTITIONER', isSoloPractice: true, verificationStatus: 'VERIFIED' },
  });
  const firmA = await mk('a');
  const firmB = await mk('b');

  const mkUser = (email: string, role: 'CLIENT' | 'LAWYER') =>
    prisma.user.create({ data: { email: `${TAG}-${email}@example.com`, fullName: email, role } });

  const verifiedAtt = await mkUser('verified', 'LAWYER');
  const vProfile = await prisma.lawyerProfile.create({
    data: { userId: verifiedAtt.id, fullName: 'Verified Att', baslNumber: `${TAG}-V`, isVerified: true, firmId: firmB.id },
  });
  await prisma.firmMember.create({ data: { firmId: firmB.id, userId: verifiedAtt.id, role: 'FIRM_OWNER', status: 'ACTIVE' } });

  const unverifiedAtt = await mkUser('unverified', 'LAWYER');
  await prisma.lawyerProfile.create({
    data: { userId: unverifiedAtt.id, fullName: 'Unverified Att', baslNumber: `${TAG}-U`, isVerified: false },
  });

  const plainClient = await mkUser('clerk', 'CLIENT');

  // --- Rule 1: only an admitted attorney may hold an attorney role.
  const r1 = await checkJoinEligibility({ firmId: firmA.id, role: 'ATTORNEY', userId: plainClient.id });
  ok('a non-attorney cannot be invited as ATTORNEY', !r1.ok);

  const r1b = await checkJoinEligibility({ firmId: firmA.id, role: 'PARALEGAL', userId: plainClient.id });
  ok('...but CAN be invited as a paralegal', r1b.ok);

  const r1c = await checkJoinEligibility({ firmId: firmA.id, role: 'FIRM_ADMIN', userId: plainClient.id });
  ok('...and as a practice manager (need not be admitted)', r1c.ok);

  // --- Rule 2: unverified attorney refused an attorney role.
  const r2 = await checkJoinEligibility({ firmId: firmA.id, role: 'ATTORNEY', userId: unverifiedAtt.id });
  ok('an attorney without BASL verification cannot be a partner', !r2.ok);

  // --- Rule 3: a verified attorney with NO open matters may move practice.
  const r3 = await checkJoinEligibility({ firmId: firmA.id, role: 'ATTORNEY', userId: verifiedAtt.id });
  ok('a verified attorney with no open matters may move practice', r3.ok);

  // --- Rule 4: the same attorney, now holding an open matter at firm B.
  const client2 = await mkUser('client2', 'CLIENT');
  const booking = await prisma.booking.create({
    data: {
      bookingNumber: `${TAG}-BK`, clientId: client2.id, firmId: firmB.id, lawyerId: vProfile.id,
      mode: 'ONLINE', lawyerFee: 0, totalAmount: 0, status: 'ACCEPTED',
      subject: 'x', description: 'y',
    },
  });
  const r4 = await checkJoinEligibility({ firmId: firmA.id, role: 'ATTORNEY', userId: verifiedAtt.id });
  ok('an attorney holding an OPEN matter cannot move practice', !r4.ok,
     'the client engaged that firm; moving the file silently changes who they are retained by');

  // --- Rule 5: closing the matter releases them.
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } });
  const r5 = await checkJoinEligibility({ firmId: firmA.id, role: 'ATTORNEY', userId: verifiedAtt.id });
  ok('...and CAN once that matter is closed', r5.ok);

  // --- Rule 6: joining a solo firm makes it a partnership needing re-verification.
  const owner = await mkUser('ownerA', 'LAWYER');
  const oProfile = await prisma.lawyerProfile.create({
    data: { userId: owner.id, fullName: 'Owner A', baslNumber: `${TAG}-O`, isVerified: true, firmId: firmA.id },
  });
  await prisma.firmMember.create({ data: { firmId: firmA.id, userId: owner.id, role: 'FIRM_OWNER', status: 'ACTIVE' } });

  await prisma.$transaction((tx) => admitMemberToFirm(tx, { firmId: firmA.id, userId: verifiedAtt.id, role: 'ATTORNEY' }));

  const after = await prisma.lawFirm.findUnique({ where: { id: firmA.id } });
  ok('a firm of one that gains a member becomes a PARTNERSHIP', after?.firmType === 'PARTNERSHIP');
  ok('...and loses its inherited verification', after?.verificationStatus === 'PENDING',
     'it no longer inherits its founder\'s individual standing');
  ok('...so it leaves the public directory until re-checked',
     after?.verificationStatus !== 'VERIFIED',
     'GET /api/firms lists VERIFIED only');

  const movedProfile = await prisma.lawyerProfile.findUnique({ where: { id: vProfile.id } });
  ok('the attorney\'s profile follows them to the new practice', movedProfile?.firmId === firmA.id);

  // --- Rule 7: already a member.
  const r7 = await checkJoinEligibility({ firmId: firmA.id, role: 'ATTORNEY', userId: verifiedAtt.id });
  ok('an existing active member cannot be invited again', !r7.ok);

  // --- Rule 8: an invitation for someone with no account is allowed.
  const r8 = await checkJoinEligibility({ firmId: firmA.id, role: 'ATTORNEY', userId: null });
  ok('someone with no account yet CAN be invited', r8.ok,
     'that is the whole point — a firm should not need everyone pre-registered');

  // --- Rule 9: an invitation expires, and an expired one is not PENDING.
  const inv = await prisma.firmInvitation.create({
    data: {
      firmId: firmA.id, email: `${TAG}-late@example.com`, role: 'PARALEGAL',
      token: newInvitationToken(), invitedById: owner.id,
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await expireStaleInvitations();
  const invAfter = await prisma.firmInvitation.findUnique({ where: { id: inv.id } });
  ok('a lapsed invitation is swept to EXPIRED', invAfter?.status === 'EXPIRED',
     'a pending invitation is a standing offer of access to privileged material');

  ok('a fresh invitation expiry is in the future', invitationExpiry().getTime() > Date.now());

  // --- cleanup
  await prisma.firmInvitation.deleteMany({ where: { firmId: { in: [firmA.id, firmB.id] } } });
  await prisma.booking.deleteMany({ where: { bookingNumber: `${TAG}-BK` } });
  await prisma.firmMember.deleteMany({ where: { firmId: { in: [firmA.id, firmB.id] } } });
  await prisma.lawyerProfile.deleteMany({ where: { baslNumber: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.lawFirm.deleteMany({ where: { id: { in: [firmA.id, firmB.id] } } });

  let fail = 0;
  for (const [l, cond, why] of results) {
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${l}`);
    if (!cond) { fail++; if (why) console.log(`        why it matters: ${why}`); }
  }
  console.log(`\n${results.length - fail} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
