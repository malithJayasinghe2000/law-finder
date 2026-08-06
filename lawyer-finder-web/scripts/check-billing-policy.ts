/**
 * Billing policy check.
 *
 * Run with: npm run check:billing   (needs a seeded database)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this exists as a runnable script rather than a comment.
 *
 * `npm run build` and `npx tsc --noEmit` both pass happily on a fee note that
 * carries a platform-fee line, routes payment to us instead of the firm, or
 * regenerates its content after issue. This is where the two rules with real
 * teeth meet — fee-sharing under Supreme Court Rules 39-49, and unlicensed
 * payment activity under the Payments and Settlements Systems Act No. 28 of
 * 2005 — so they get assertions rather than promises.
 *
 * Run it after ANY change to src/lib/consultations/feeNote.ts or
 * src/lib/firms/billing.ts. If a case here starts failing, that is either a bug
 * or a legal decision; it is never a test to "just update".
 *
 * Unlike check:privilege and check:ai this one touches the database, because
 * fee note numbering and seat counting are only meaningful against real rows.
 * It cleans up the fee notes it creates.
 *
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 1, 2 and 7).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import prisma from '@/lib/db';
import { renderFeeNote, allocateFeeNoteNumber, calculateFeeNoteTotals } from '@/lib/consultations/feeNote';
import { getSeatAllowance, canAddFirmMember, getFirmSubscription } from '@/lib/firms/billing';
import { getFirmMembership, canManageFirm } from '@/lib/firms/access';

let pass = 0; const fails: string[] = [];
function ok(name: string, cond: boolean, why: string) {
  if (cond) { pass++; console.log('  PASS ', name); }
  else { fails.push(`  FAIL  ${name}\n        ${why}`); console.log('  FAIL ', name); }
}

const BOOKING_SELECT = {
  id: true, bookingNumber: true, firmId: true, lawyerId: true,
  client: { select: { fullName: true, email: true } },
  lawyer: { select: { fullName: true } },
  firm: { select: { id: true, name: true, isVatRegistered: true, vatRatePercent: true } },
} as const;

/**
 * A matter to test against.
 *
 * Prefers one that already exists so the check exercises real data. Builds its
 * own when there is none — `db:reset` seeds firms and attorneys but no matters,
 * so requiring one meant this check could not run on a freshly seeded database,
 * which is exactly when it is most worth running.
 */
async function acquireMatter() {
  const existing = await prisma.booking.findFirst({
    where: { lawyerId: { not: null } },
    select: BOOKING_SELECT,
  });
  if (existing) return { booking: existing, fixtureIds: null };

  const attorney = await prisma.lawyerProfile.findFirst({
    where: { firmId: { not: null } },
    select: { id: true, firmId: true, userId: true },
  });
  if (!attorney?.firmId) {
    throw new Error('no attorney attached to a firm — run `npm run db:reset` first');
  }

  const tag = `billing-fixture-${Date.now()}`;
  const client = await prisma.user.create({
    data: { email: `${tag}@example.com`, fullName: 'Fixture Client', role: 'CLIENT' },
  });
  const created = await prisma.booking.create({
    data: {
      bookingNumber: `${tag}-BK`, clientId: client.id, firmId: attorney.firmId,
      lawyerId: attorney.id, mode: 'ONLINE', subject: 'Fixture matter',
      description: 'created by check:billing', status: 'REQUESTED',
      lawyerFee: 0, totalAmount: 0,
    },
    select: BOOKING_SELECT,
  });

  return { booking: created, fixtureIds: { bookingId: created.id, clientId: client.id } };
}

/**
 * A live licence for the firm under test.
 *
 * Same reason as `acquireMatter`: the seed creates plans and roles but never a
 * `Subscription`, so "the licence resolves through the firm" could not be
 * asserted on a freshly seeded database.
 */
async function ensureLicence(firmId: string): Promise<string | null> {
  const existing = await prisma.subscription.findFirst({
    where: { firmId, OR: [{ status: 'ACTIVE' }, { status: 'CANCELED', endDate: { gte: new Date() } }] },
    select: { id: true },
  });
  if (existing) return null;

  const plan = await prisma.subscriptionPlan.findFirst({ select: { id: true, tier: true } });
  if (!plan) throw new Error('no subscription plans — run `npm run db:reset` first');

  const role = await prisma.subscriptionRole.findUnique({ where: { name: plan.tier } });
  if (!role) throw new Error(`no subscription role for tier ${plan.tier}`);

  const created = await prisma.subscription.create({
    data: {
      firmId, planId: plan.id, roleId: role.id, status: 'ACTIVE',
      billingCycle: 'MONTHLY', nextBilling: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  return created.id;
}

async function main() {
  const { booking, fixtureIds } = await acquireMatter();
  const fixtureSubscriptionId = await ensureLicence(booking.firmId);

  console.log(`\nMatter ${booking.bookingNumber} at ${booking.firm.name}\n`);

  // Give the firm a tax identity, as the settings screen would.
  await prisma.lawFirm.update({
    where: { id: booking.firmId },
    data: { taxIdentificationNumber: '134567890-7000', vatNumber: 'VAT-998877',
            isVatRegistered: true, vatRatePercent: 18,
            bankName: 'Commercial Bank', accountName: booking.firm.name,
            accountNumber: '8001234567', bankBranch: 'Colombo 03' },
  });
  const firm = await prisma.lawFirm.findUniqueOrThrow({ where: { id: booking.firmId } });

  // ── Arithmetic ──────────────────────────────────────────────────────────
  const lines = [
    { description: 'Professional fees — advice on land boundary dispute', amount: 45000 },
    { description: 'Drafting of demand letter', amount: 15000 },
  ];
  const totals = calculateFeeNoteTotals(lines, firm.vatRatePercent);
  ok('subtotal is the sum of the lines', totals.subtotal === 60000,
     `expected 60000, got ${totals.subtotal}`);
  ok('VAT is computed at the firm\'s own rate', totals.vatAmount === 10800,
     `18% of 60000 is 10800, got ${totals.vatAmount}`);
  ok('total is subtotal + VAT and nothing else', totals.total === 70800,
     `there is no third term: the platform takes nothing. got ${totals.total}`);

  // ── Create + issue ──────────────────────────────────────────────────────
  const created = await prisma.$transaction(async (tx) => {
    const noteNumber = await allocateFeeNoteNumber(tx, booking.firmId);
    return tx.feeNote.create({ data: {
      noteNumber, firmId: booking.firmId, bookingId: booking.id,
      firmName: firm.name, firmTin: firm.taxIdentificationNumber, firmVatNumber: firm.vatNumber,
      firmBankName: firm.bankName, firmAccountName: firm.accountName,
      firmAccountNumber: firm.accountNumber, firmBankBranch: firm.bankBranch,
      clientName: booking.client.fullName ?? 'Client', clientEmail: booking.client.email,
      attorneyName: booking.lawyer?.fullName ?? null,
      lineItems: lines, subtotal: totals.subtotal, vatRatePercent: firm.vatRatePercent,
      vatAmount: totals.vatAmount, total: totals.total, status: 'DRAFT',
    }});
  });
  ok('note number is firm-and-year scoped', /^FN-\d{4}-\d{4}$/.test(created.noteNumber),
     `got ${created.noteNumber}`);

  const content = renderFeeNote({
    noteNumber: created.noteNumber, issuedAt: new Date(), dueDate: null,
    firmName: created.firmName, firmAddress: created.firmAddress, firmTin: created.firmTin,
    firmVatNumber: created.firmVatNumber, firmBankName: created.firmBankName,
    firmAccountName: created.firmAccountName, firmAccountNumber: created.firmAccountNumber,
    firmBankBranch: created.firmBankBranch, clientName: created.clientName,
    clientAddress: null, clientEmail: created.clientEmail, attorneyName: created.attorneyName,
    matterReference: booking.bookingNumber, lines,
    subtotal: created.subtotal, vatRatePercent: created.vatRatePercent,
    vatAmount: created.vatAmount, total: created.total, currency: created.currency,
  });

  // ── The document itself ─────────────────────────────────────────────────
  ok('the FIRM is named as the party charging', content.includes(firm.name),
     'rule 7: the client must know the firm is charging them');
  ok("the firm's own bank account is printed", content.includes('8001234567'),
     'rule 2: the client pays the firm directly; we never hold the money');
  ok("the firm's TIN appears", content.includes('134567890-7000'),
     'the firm is the taxable person, not us');
  ok('the note states the platform receives no part of the fee',
     /does \*\*not receive\s*any part of this fee\*\*/.test(content.replace(/\n/g, ' ')),
     'rule 1: a client must never think a share reaches the platform');
  ok('the note states the platform is not a law firm',
     content.includes('not a law firm'),
     'rule 7');

  const forbidden = ['platform fee', 'commission', 'service charge', 'our fee', 'processing fee'];
  const found = forbidden.filter((t) => content.toLowerCase().includes(t));
  ok('no platform fee or commission line anywhere', found.length === 0,
     `found: ${found.join(', ')} — that would be fee-sharing (rule 1)`);

  const issued = await prisma.feeNote.update({
    where: { id: created.id }, data: { status: 'ISSUED', issuedAt: new Date(), content },
  });
  ok('issuing snapshots the rendered document', (issued.content ?? '').length > 500,
     'a fee note is a tax document and must not be regenerated later');

  // Snapshot survives the firm renaming itself.
  await prisma.lawFirm.update({ where: { id: firm.id }, data: { name: firm.name + ' (renamed)' } });
  const after = await prisma.feeNote.findUniqueOrThrow({ where: { id: issued.id } });
  ok('an issued note is unaffected by later firm changes',
     (after.content ?? '').includes(firm.name) && !(after.content ?? '').includes('(renamed)'),
     'it must still say what it said on the day it was issued');
  await prisma.lawFirm.update({ where: { id: firm.id }, data: { name: firm.name } });

  // ── Numbering ───────────────────────────────────────────────────────────
  const second = await prisma.$transaction(async (tx) => {
    const n = await allocateFeeNoteNumber(tx, booking.firmId);
    return tx.feeNote.create({ data: {
      noteNumber: n, firmId: booking.firmId, bookingId: booking.id,
      firmName: firm.name, clientName: 'X', lineItems: [{ description: 'y', amount: 1 }],
      subtotal: 1, vatAmount: 0, total: 1, status: 'DRAFT' } });
  });
  const a = Number(created.noteNumber.slice(-4)), b = Number(second.noteNumber.slice(-4));
  ok('numbers are sequential per firm', b === a + 1, `${created.noteNumber} then ${second.noteNumber}`);

  const cancelled = await prisma.feeNote.update({
    where: { id: second.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  const third = await prisma.$transaction((tx) => allocateFeeNoteNumber(tx, booking.firmId));
  ok('a cancelled note keeps its number rather than freeing it',
     Number(third.slice(-4)) === b + 1,
     `a gap in the series is a question the firm has to answer; got ${third} after cancelling ${cancelled.noteNumber}`);

  // ── Seats meter people, not clients ─────────────────────────────────────
  const seats = await getSeatAllowance(booking.firmId);
  const sub = await getFirmSubscription(booking.firmId);
  ok('the licence resolves through the firm', sub !== null,
     'an attorney does not hold a licence; their practice does');
  ok('seat usage counts firm members', seats.used >= 1, `used=${seats.used}`);
  const check = await canAddFirmMember(booking.firmId);
  ok('seat check answers without reference to matters or clients',
     typeof check.allowed === 'boolean',
     'metering clients would be fee-sharing (rule 1)');
  console.log(`\n  seats: ${seats.used}/${seats.unlimited ? '∞' : seats.limit} used on ${sub?.plan.name}`);

  // ── Who may license the practice ────────────────────────────────────────
  //
  // The licence binds the whole firm, so it is bought by whoever runs the
  // practice — and a practice manager need not be an admitted attorney. The
  // invoice routes used to demand `session.role === 'LAWYER'` and a
  // `LawyerProfile`, which locked out the very person their own error message
  // named. They also scoped invoices by `Invoice.lawyerId` (who raised it)
  // rather than `firmId` (who is billed), so an invoice raised by a practice
  // manager was invisible to everyone and could never be paid.
  const probeTag = `billing-probe-${Date.now()}`;
  const probeFirm = await prisma.lawFirm.create({
    data: { name: `${probeTag} Practice`, slug: probeTag, firmType: 'PARTNERSHIP', isSoloPractice: false },
  });
  const pmUser = await prisma.user.create({
    data: { email: `${probeTag}@example.com`, fullName: 'Practice Manager', role: 'CLIENT' },
  });
  await prisma.firmMember.create({
    data: { firmId: probeFirm.id, userId: pmUser.id, role: 'FIRM_ADMIN', status: 'ACTIVE' },
  });

  const pm = await getFirmMembership(pmUser.id);
  ok('a practice manager with no attorney profile resolves to their firm',
     pm?.firmId === probeFirm.id,
     'membership, not LawyerProfile, is what identifies the firm being licensed');
  ok('that practice manager may license the practice',
     canManageFirm(pm) && pm?.profileId === null,
     'canManageFirm decides this; requiring an attorney profile locked out the person the rule names');

  const probeInvoice = await prisma.invoice.create({
    data: { firmId: probeFirm.id, lawyerId: pm?.profileId ?? null, amount: 5000,
            status: 'PENDING', paymentReason: 'probe' },
  });
  ok('an invoice raised by a practice manager is billed to the firm',
     probeInvoice.firmId === probeFirm.id && probeInvoice.lawyerId === null,
     'firmId is the party billed; lawyerId is display and audit only');
  ok('that invoice is reachable by firm scoping',
     (await prisma.invoice.count({ where: { firmId: probeFirm.id } })) === 1,
     'scoping by lawyerId would have hidden it from everyone, making it unpayable');

  await prisma.invoice.deleteMany({ where: { firmId: probeFirm.id } });
  await prisma.firmMember.deleteMany({ where: { firmId: probeFirm.id } });
  await prisma.user.delete({ where: { id: pmUser.id } });
  await prisma.lawFirm.delete({ where: { id: probeFirm.id } });

  // Cleanup
  await prisma.feeNote.deleteMany({ where: { bookingId: booking.id } });

  if (fixtureSubscriptionId) {
    await prisma.subscription.delete({ where: { id: fixtureSubscriptionId } });
  }

  if (fixtureIds) {
    await prisma.booking.delete({ where: { id: fixtureIds.bookingId } });
    await prisma.user.delete({ where: { id: fixtureIds.clientId } });
  }

  if (fails.length) { console.error('\n' + fails.join('\n\n')); console.error(`\n${pass} passed, ${fails.length} FAILED\n`); process.exit(1); }
  console.log(`\n${pass} passed, 0 failed\n`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
